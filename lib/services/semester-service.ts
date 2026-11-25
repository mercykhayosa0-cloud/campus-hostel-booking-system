import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { allocations, applications, semesters, studentProfiles } from '@/lib/db/schema'
import { DomainError, isUniqueViolation, recordStatusChange } from './core'
import { closeAllocation } from './allocation-service'

export async function createSemester(input: {
  name: string
  startsOn: string
  endsOn: string
  offerConfirmationHours: number
}) {
  if (input.endsOn <= input.startsOn) throw new DomainError('The end date must be after the start date')
  try {
    await db.insert(semesters).values(input)
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A semester with that name already exists')
    throw error
  }
}

/** Only one semester is current; the partial unique index enforces it in the database too. */
export async function setCurrentSemester(semesterId: number) {
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(semesters).where(eq(semesters.id, semesterId))
    if (!target) throw new DomainError('Semester not found')
    await tx.update(semesters).set({ isCurrent: false }).where(eq(semesters.isCurrent, true))
    await tx.update(semesters).set({ isCurrent: true }).where(eq(semesters.id, semesterId))
  })
}

export async function updateSemesterSettings(
  semesterId: number,
  input: { applicationsOpen: boolean; offerConfirmationHours: number },
) {
  const updated = await db.update(semesters).set(input).where(eq(semesters.id, semesterId)).returning()
  if (updated.length === 0) throw new DomainError('Semester not found')
}

/**
 * End of semester: residents move to "ended", unconfirmed or unused offers are
 * cancelled, remaining applications close, and housed students are flagged as
 * housed for the next semester's ranking.
 */
export async function endSemester(semesterId: number, actorUserId: string) {
  return db.transaction(async (tx) => {
    const live = await tx
      .select({ id: allocations.id, roomId: allocations.roomId, status: allocations.status, studentUserId: allocations.studentUserId })
      .from(allocations)
      .where(and(eq(allocations.semesterId, semesterId), inArray(allocations.status, ['offered', 'confirmed', 'checked_in'])))
      .orderBy(allocations.roomId)
      .for('update')

    const housedStudentIds: string[] = []
    for (const allocation of live) {
      const to = allocation.status === 'checked_in' ? 'ended' : 'cancelled'
      if (to === 'ended') housedStudentIds.push(allocation.studentUserId)
      await closeAllocation(tx, allocation, to, actorUserId, 'Semester ended')
    }

    // The registry flag is recomputed for everyone: housed this semester or not.
    await tx.update(studentProfiles).set({ housedPreviousSemester: false })
    if (housedStudentIds.length > 0) {
      await tx
        .update(studentProfiles)
        .set({ housedPreviousSemester: true })
        .where(inArray(studentProfiles.userId, housedStudentIds))
    }

    const open = await tx
      .update(applications)
      .set({ status: 'closed', closedReason: 'Semester ended' })
      .where(and(eq(applications.semesterId, semesterId), eq(applications.status, 'active')))
      .returning({ id: applications.id })
    for (const application of open) {
      await recordStatusChange(tx, {
        entityType: 'application',
        entityId: application.id,
        fromStatus: 'active',
        toStatus: 'closed',
        actorUserId,
        reason: 'Semester ended',
      })
    }

    await tx.update(semesters).set({ applicationsOpen: false }).where(eq(semesters.id, semesterId))
    return { closedAllocations: live.length, housedStudents: housedStudentIds.length }
  })
}
