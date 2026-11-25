import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { allocations, applications, halls, semesters, studentProfiles } from '@/lib/db/schema'
import { eligibilityPolicy } from '@/lib/domain/eligibility-policy'
import { Hall, type RoomType } from '@/lib/domain/room'
import { DomainError, isUniqueViolation, recordStatusChange } from './core'

export async function submitApplication(
  studentUserId: string,
  input: { preferredHallId: number | null; preferredRoomType: RoomType | null; preferredRoommateStudentNumber: string | null },
) {
  const [semester] = await db.select().from(semesters).where(eq(semesters.isCurrent, true))
  if (!semester) throw new DomainError('There is no current semester')
  if (!semester.applicationsOpen) throw new DomainError('Applications are closed for this semester')

  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentUserId))
  if (!profile) throw new DomainError('No registry record is linked to your account')

  const eligibility = eligibilityPolicy.evaluate(profile)
  if (!eligibility.isEligible) throw new DomainError(`You are not eligible: ${eligibility.reasons.join('; ')}`)

  if (input.preferredHallId !== null) {
    const [hall] = await db.select().from(halls).where(eq(halls.id, input.preferredHallId))
    if (!hall) throw new DomainError('Preferred hall not found')
    if (!Hall.admits(hall.genderPolicy, profile.gender)) {
      throw new DomainError(`${hall.name} does not accept ${profile.gender} students`)
    }
  }

  const roommate = input.preferredRoommateStudentNumber?.toUpperCase() ?? null
  if (roommate) {
    if (roommate === profile.studentNumber) throw new DomainError('You cannot choose yourself as a roommate')
    const [other] = await db
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.studentNumber, roommate))
    if (!other) throw new DomainError(`No student with number ${roommate} was found`)
  }

  try {
    const [application] = await db
      .insert(applications)
      .values({
        semesterId: semester.id,
        studentUserId,
        preferredHallId: input.preferredHallId,
        preferredRoomType: input.preferredRoomType,
        preferredRoommateStudentNumber: roommate,
      })
      .returning({ id: applications.id })
    await recordStatusChange(db, {
      entityType: 'application',
      entityId: application.id,
      fromStatus: null,
      toStatus: 'active',
      actorUserId: studentUserId,
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('You already have an active application this semester')
    throw error
  }
}

export async function withdrawApplication(studentUserId: string, applicationId: number) {
  await db.transaction(async (tx) => {
    const [application] = await tx
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.studentUserId, studentUserId)))
      .for('update')
    if (!application || application.status !== 'active') throw new DomainError('No active application to withdraw')

    const [live] = await tx
      .select({ id: allocations.id })
      .from(allocations)
      .where(
        and(eq(allocations.applicationId, applicationId), inArray(allocations.status, ['offered', 'confirmed', 'checked_in'])),
      )
    if (live) throw new DomainError('You hold a room offer or allocation. Decline the offer instead of withdrawing.')

    await tx
      .update(applications)
      .set({ status: 'withdrawn', withdrawnAt: new Date() })
      .where(eq(applications.id, applicationId))
    await recordStatusChange(tx, {
      entityType: 'application',
      entityId: applicationId,
      fromStatus: 'active',
      toStatus: 'withdrawn',
      actorUserId: studentUserId,
    })
  })
}
