import 'server-only'
import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  allocationRunEntries,
  allocationRuns,
  allocations,
  applications,
  semesters,
  studentProfiles,
  user,
} from '@/lib/db/schema'
import { Allocation, allocationStatusLabel, type AllocationStatus } from '@/lib/domain/allocation'
import { AllocationPriorityPolicy, allocationPriorityPolicy } from '@/lib/domain/allocation-priority-policy'
import { eligibilityPolicy } from '@/lib/domain/eligibility-policy'
import type { Gender, RoomSnapshot } from '@/lib/domain/room'
import { roomMatcher } from '@/lib/domain/room-matcher'
import { roommatePairing, type PairingOutcome } from '@/lib/domain/roommate-pairing'
import {
  DomainError,
  adjustBeds,
  lockAllRooms,
  lockRoom,
  readAllRooms,
  recordStatusChange,
  type Executor,
  type Tx,
} from './core'

const ALLOCATION_LOCK_NAMESPACE = 4201

// ---------------------------------------------------------------------------
// Shared lifecycle helpers
// ---------------------------------------------------------------------------

async function genderOf(exec: Executor, studentUserId: string): Promise<Gender> {
  const [profile] = await exec
    .select({ gender: studentProfiles.gender })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
  if (!profile) throw new DomainError('Student record not found')
  return profile.gender
}

/**
 * Move an allocation into a final status and release the bed it was holding
 * (a reservation for offered/confirmed, an occupied bed for checked_in).
 */
export async function closeAllocation(
  tx: Tx,
  allocation: { id: number; roomId: number; status: AllocationStatus; studentUserId: string },
  to: AllocationStatus,
  actorUserId: string | null,
  reason: string,
  patch: Partial<typeof allocations.$inferInsert> = {},
) {
  if (!Allocation.canTransition(allocation.status, to)) {
    throw new DomainError(
      `Cannot change an allocation from ${allocationStatusLabel[allocation.status]} to ${allocationStatusLabel[to]}`,
    )
  }
  const kind = Allocation.bedKind(allocation.status)
  const room = await lockRoom(tx, allocation.roomId)
  const gender = await genderOf(tx, allocation.studentUserId)
  await adjustBeds(tx, room, kind === 'reserved' ? { reserved: -1 } : { occupied: -1 }, gender)
  await tx
    .update(allocations)
    .set({ status: to, closedAt: new Date(), ...patch })
    .where(eq(allocations.id, allocation.id))
  await recordStatusChange(tx, {
    entityType: 'allocation',
    entityId: allocation.id,
    fromStatus: allocation.status,
    toStatus: to,
    actorUserId,
    reason,
  })
}

/** A lapsed or declined offer closes the application so it is not re-offered automatically. */
async function closeApplication(tx: Tx, applicationId: number, actorUserId: string | null, reason: string) {
  const closed = await tx
    .update(applications)
    .set({ status: 'closed', closedReason: reason })
    .where(and(eq(applications.id, applicationId), eq(applications.status, 'active')))
    .returning({ id: applications.id })
  if (closed.length > 0) {
    await recordStatusChange(tx, {
      entityType: 'application',
      entityId: applicationId,
      fromStatus: 'active',
      toStatus: 'closed',
      actorUserId,
      reason,
    })
  }
}

async function lockAllocation(tx: Tx, allocationId: number) {
  const [allocation] = await tx.select().from(allocations).where(eq(allocations.id, allocationId)).for('update')
  if (!allocation) throw new DomainError('Allocation not found')
  return allocation
}

// ---------------------------------------------------------------------------
// Offer lapse (rule 8)
// ---------------------------------------------------------------------------

async function expireLapsedOffersTx(tx: Tx): Promise<number> {
  const expired = await tx
    .select()
    .from(allocations)
    .where(and(eq(allocations.status, 'offered'), lte(allocations.offerExpiresAt, new Date())))
    .orderBy(allocations.roomId)
    .for('update', { skipLocked: true })
  for (const allocation of expired) {
    await closeAllocation(tx, allocation, 'lapsed', null, 'Not confirmed before the deadline')
    await closeApplication(tx, allocation.applicationId, null, 'Offer lapsed')
  }
  return expired.length
}

/**
 * Called before any screen or operation that depends on bed availability, so
 * an offer past its deadline is always treated as lapsed and its bed released.
 */
export async function expireLapsedOffers(): Promise<number> {
  const [due] = await db
    .select({ id: allocations.id })
    .from(allocations)
    .where(and(eq(allocations.status, 'offered'), lte(allocations.offerExpiresAt, new Date())))
    .limit(1)
  if (!due) return 0
  return db.transaction(expireLapsedOffersTx)
}

// ---------------------------------------------------------------------------
// Candidate evaluation (shared by the run and the waiting-list view)
// ---------------------------------------------------------------------------

async function loadActiveApplications(exec: Executor, semesterId: number) {
  return exec
    .select({
      applicationId: applications.id,
      studentUserId: applications.studentUserId,
      studentName: user.name,
      studentNumber: studentProfiles.studentNumber,
      gender: studentProfiles.gender,
      yearOfStudy: studentProfiles.yearOfStudy,
      homeDistanceKm: studentProfiles.homeDistanceKm,
      housedPreviousSemester: studentProfiles.housedPreviousSemester,
      isEnrolled: studentProfiles.isEnrolled,
      isFeeCleared: studentProfiles.isFeeCleared,
      hasDisciplinaryHold: studentProfiles.hasDisciplinaryHold,
      preferredHallId: applications.preferredHallId,
      preferredRoomType: applications.preferredRoomType,
      preferredRoommateStudentNumber: applications.preferredRoommateStudentNumber,
      submittedAt: applications.submittedAt,
    })
    .from(applications)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentUserId))
    .innerJoin(user, eq(user.id, applications.studentUserId))
    .where(and(eq(applications.semesterId, semesterId), eq(applications.status, 'active')))
}

async function loadLiveStudentIds(exec: Executor, semesterId: number) {
  const rows = await exec
    .select({ studentUserId: allocations.studentUserId })
    .from(allocations)
    .where(and(eq(allocations.semesterId, semesterId), inArray(allocations.status, ['offered', 'confirmed', 'checked_in'])))
  return new Set(rows.map((row) => row.studentUserId))
}

type ActiveApplication = Awaited<ReturnType<typeof loadActiveApplications>>[number]

function evaluateApplicants(apps: ActiveApplication[], rooms: RoomSnapshot[], liveStudentIds: Set<string>) {
  const evaluated = apps.map((app) => ({
    ...app,
    eligibility: eligibilityPolicy.evaluate(app),
    alreadyAllocated: liveStudentIds.has(app.studentUserId),
  }))
  const pairing = roommatePairing.resolve(
    evaluated.map((app) => ({
      applicationId: app.applicationId,
      studentNumber: app.studentNumber,
      gender: app.gender,
      preferredRoommateStudentNumber: app.preferredRoommateStudentNumber,
      isEligible: app.eligibility.isEligible,
      alreadyAllocated: app.alreadyAllocated,
    })),
  )
  const rankable = evaluated
    .filter((app) => app.eligibility.isEligible && !app.alreadyAllocated)
    .map((app) => {
      const pair = pairing.get(app.applicationId) ?? ({ kind: 'none' } as PairingOutcome)
      const fit = roomMatcher.preferenceFit(
        rooms,
        { gender: app.gender, preferredHallId: app.preferredHallId, preferredRoomType: app.preferredRoomType },
        pair.kind === 'mutual',
      )
      return { ...app, pair, preferenceFit: fit.score }
    })
  return { evaluated, ranked: allocationPriorityPolicy.rank(rankable) }
}

/** Rule 14: the waiting list is computed from live data, never stored as a copy. */
export async function getRankedWaitingList(semesterId: number) {
  const [rooms, apps, live] = await Promise.all([
    readAllRooms(db),
    loadActiveApplications(db, semesterId),
    loadLiveStudentIds(db, semesterId),
  ])
  return evaluateApplicants(apps, rooms, live)
}

// ---------------------------------------------------------------------------
// Allocation run (rules 4, 6, 7, 8, 14)
// ---------------------------------------------------------------------------

export async function runAllocation(semesterId: number, actorUserId: string) {
  return db.transaction(async (tx) => {
    // Only one run per semester at a time; a second click waits, then sees the first run's results.
    await tx.execute(sql`select pg_advisory_xact_lock(${ALLOCATION_LOCK_NAMESPACE}, ${semesterId})`)

    const [semester] = await tx.select().from(semesters).where(eq(semesters.id, semesterId))
    if (!semester) throw new DomainError('Semester not found')

    await expireLapsedOffersTx(tx)
    const rooms = await lockAllRooms(tx)
    const apps = await loadActiveApplications(tx, semesterId)
    const live = await loadLiveStudentIds(tx, semesterId)
    const { evaluated, ranked } = evaluateApplicants(apps, rooms, live)

    const [run] = await tx
      .insert(allocationRuns)
      .values({
        semesterId,
        runByUserId: actorUserId,
        policyVersion: AllocationPriorityPolicy.version,
        applicantsConsidered: evaluated.length,
      })
      .returning()

    type Placement = { room: RoomSnapshot; roommateMet: boolean | null; detail: string }
    const placements = new Map<number, Placement>()
    const failedPairs = new Set<number>()
    const byId = new Map(ranked.map((c) => [c.applicationId, c]))
    const deadline = Allocation.offerDeadline(new Date(), semester.offerConfirmationHours)

    const describe = (room: RoomSnapshot, hallMatched: boolean, typeMatched: boolean) =>
      `${room.hallName} ${room.roomNumber}` +
      (hallMatched && typeMatched ? ' (matches preferences)' : ` (${[!hallMatched && 'other hall', !typeMatched && 'other room type'].filter(Boolean).join(', ')})`)

    for (const candidate of ranked) {
      if (placements.has(candidate.applicationId)) continue
      const request = {
        gender: candidate.gender,
        preferredHallId: candidate.preferredHallId,
        preferredRoomType: candidate.preferredRoomType,
      }

      if (candidate.pair.kind === 'mutual' && !failedPairs.has(candidate.applicationId)) {
        const partner = byId.get(candidate.pair.partnerApplicationId)
        if (partner && !placements.has(partner.applicationId)) {
          const match = roomMatcher.findBest(rooms, { ...request, bedsNeeded: 2 })
          if (match) {
            match.room.reservedBeds += 2
            match.room.occupantGender ??= candidate.gender
            const detail = `${describe(match.room, match.hallMatched, match.roomTypeMatched)}, with roommate`
            placements.set(candidate.applicationId, { room: match.room, roommateMet: true, detail })
            placements.set(partner.applicationId, { room: match.room, roommateMet: true, detail })
            continue
          }
          failedPairs.add(partner.applicationId)
        }
      }

      const match = roomMatcher.findBest(rooms, { ...request, bedsNeeded: 1 })
      if (match) {
        match.room.reservedBeds += 1
        match.room.occupantGender ??= candidate.gender
        placements.set(candidate.applicationId, {
          room: match.room,
          roommateMet: candidate.pair.kind === 'none' ? null : false,
          detail: describe(match.room, match.hallMatched, match.roomTypeMatched),
        })
      }
    }

    // Persist room counters. The database CHECK (occupied + reserved <= capacity) is the final guard.
    const touched = new Map<number, RoomSnapshot>()
    for (const placement of placements.values()) touched.set(placement.room.roomId, placement.room)
    for (const room of touched.values()) {
      await tx.execute(
        sql`update rooms set reserved_beds = ${room.reservedBeds}, occupant_gender = ${room.occupantGender} where id = ${room.roomId}`,
      )
    }

    const rankedById = new Map(ranked.map((c) => [c.applicationId, c]))
    for (const app of evaluated) {
      const candidate = rankedById.get(app.applicationId)
      const placement = placements.get(app.applicationId)
      const pair = candidate?.pair
      let outcome: 'offered' | 'no_room' | 'ineligible' | 'already_allocated'
      let detail: string | null = null
      if (!app.eligibility.isEligible) outcome = 'ineligible'
      else if (app.alreadyAllocated) outcome = 'already_allocated'
      else if (placement) {
        outcome = 'offered'
        detail = placement.detail
      } else {
        outcome = 'no_room'
        detail = 'No compatible room with a free bed'
      }
      if (pair?.kind === 'unmet') detail = `${detail ? `${detail}. ` : ''}Roommate not met: ${pair.reason}`
      if (pair?.kind === 'mutual' && placement && placement.roommateMet === false) {
        detail = `${detail}. Roommate not met: no room with two compatible free beds`
      }

      await tx.insert(allocationRunEntries).values({
        allocationRunId: run.id,
        applicationId: app.applicationId,
        rank: candidate?.rank ?? null,
        isEligible: app.eligibility.isEligible,
        ineligibilityReasons: app.eligibility.reasons,
        rankingFactors: candidate ? allocationPriorityPolicy.factorsOf(candidate) : {},
        outcome,
        outcomeDetail: detail,
        roommatePreferenceMet:
          placement?.roommateMet ?? (app.preferredRoommateStudentNumber && outcome !== 'already_allocated' ? false : null),
      })

      if (placement) {
        const [allocation] = await tx
          .insert(allocations)
          .values({
            semesterId,
            applicationId: app.applicationId,
            studentUserId: app.studentUserId,
            roomId: placement.room.roomId,
            allocationRunId: run.id,
            status: 'offered',
            offerExpiresAt: deadline,
          })
          .returning({ id: allocations.id })
        await recordStatusChange(tx, {
          entityType: 'allocation',
          entityId: allocation.id,
          fromStatus: null,
          toStatus: 'offered',
          actorUserId,
          reason: `Allocation run #${run.id}, rank ${candidate?.rank}`,
        })
      }
    }

    await tx.update(allocationRuns).set({ offersMade: placements.size }).where(eq(allocationRuns.id, run.id))
    return { runId: run.id, considered: evaluated.length, offers: placements.size }
  })
}

// ---------------------------------------------------------------------------
// Student offer decisions
// ---------------------------------------------------------------------------

export async function confirmOffer(studentUserId: string, allocationId: number) {
  const result = await db.transaction(async (tx) => {
    const allocation = await lockAllocation(tx, allocationId)
    if (allocation.studentUserId !== studentUserId) throw new DomainError('Offer not found')
    if (allocation.status !== 'offered') {
      throw new DomainError(`This offer is already ${allocationStatusLabel[allocation.status].toLowerCase()}`)
    }
    if (Allocation.isOfferExpired(allocation.status, allocation.offerExpiresAt)) {
      await closeAllocation(tx, allocation, 'lapsed', null, 'Not confirmed before the deadline')
      await closeApplication(tx, allocation.applicationId, null, 'Offer lapsed')
      return 'lapsed' as const
    }
    await tx.update(allocations).set({ status: 'confirmed', confirmedAt: new Date() }).where(eq(allocations.id, allocationId))
    await recordStatusChange(tx, {
      entityType: 'allocation',
      entityId: allocationId,
      fromStatus: 'offered',
      toStatus: 'confirmed',
      actorUserId: studentUserId,
    })
    return 'confirmed' as const
  })
  if (result === 'lapsed') throw new DomainError('The confirmation deadline has passed, so this offer has lapsed')
}

export async function declineOffer(studentUserId: string, allocationId: number) {
  await db.transaction(async (tx) => {
    const allocation = await lockAllocation(tx, allocationId)
    if (allocation.studentUserId !== studentUserId) throw new DomainError('Offer not found')
    if (allocation.status !== 'offered' && allocation.status !== 'confirmed') {
      throw new DomainError('Only an offer that has not been checked in can be declined')
    }
    await closeAllocation(tx, allocation, 'cancelled', studentUserId, 'Declined by student')
    await closeApplication(tx, allocation.applicationId, studentUserId, 'Offer declined by student')
  })
}

export async function cancelAllocation(officerUserId: string, allocationId: number, reason: string) {
  await db.transaction(async (tx) => {
    const allocation = await lockAllocation(tx, allocationId)
    await closeAllocation(tx, allocation, 'cancelled', officerUserId, reason)
    await closeApplication(tx, allocation.applicationId, officerUserId, `Allocation cancelled: ${reason}`)
  })
}

// ---------------------------------------------------------------------------
// Physical occupancy (rule 9): check-in, check-out, early vacation
// ---------------------------------------------------------------------------

type Actor = { id: string; role: 'officer' | 'caretaker' | 'student' }

function assertHallAccess(actor: Actor, room: { caretakerUserId: string; hallName: string }) {
  if (actor.role === 'officer') return
  if (actor.role === 'caretaker' && room.caretakerUserId === actor.id) return
  throw new DomainError(`You are not the caretaker for ${room.hallName}`)
}

export async function checkIn(actor: Actor, allocationId: number) {
  await db.transaction(async (tx) => {
    const allocation = await lockAllocation(tx, allocationId)
    if (allocation.status !== 'confirmed') {
      throw new DomainError(
        allocation.status === 'offered'
          ? 'The student must confirm the offer before check-in'
          : `Cannot check in an allocation that is ${allocationStatusLabel[allocation.status].toLowerCase()}`,
      )
    }
    const room = await lockRoom(tx, allocation.roomId)
    assertHallAccess(actor, room)
    const gender = await genderOf(tx, allocation.studentUserId)
    await adjustBeds(tx, room, { reserved: -1, occupied: 1 }, gender)
    await tx.update(allocations).set({ status: 'checked_in', checkedInAt: new Date() }).where(eq(allocations.id, allocationId))
    await recordStatusChange(tx, {
      entityType: 'allocation',
      entityId: allocationId,
      fromStatus: 'confirmed',
      toStatus: 'checked_in',
      actorUserId: actor.id,
    })
  })
}

/** A check-out before the semester's end date is recorded as an early vacation. */
export async function checkOut(actor: Actor, allocationId: number, note: string | null) {
  return db.transaction(async (tx) => {
    const allocation = await lockAllocation(tx, allocationId)
    if (allocation.status !== 'checked_in') throw new DomainError('Only a checked-in resident can be checked out')
    const room = await lockRoom(tx, allocation.roomId)
    assertHallAccess(actor, room)
    const [semester] = await tx.select().from(semesters).where(eq(semesters.id, allocation.semesterId))
    const today = new Date().toISOString().slice(0, 10)
    const vacatedEarly = today < semester.endsOn
    const reason = [vacatedEarly ? 'Early vacation' : 'End-of-stay check-out', note].filter(Boolean).join(': ')
    await closeAllocation(tx, allocation, 'checked_out', actor.id, reason, { checkedOutAt: new Date(), vacatedEarly })
    return { vacatedEarly }
  })
}
