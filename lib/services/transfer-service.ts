import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { allocations, studentProfiles, transferRequests } from '@/lib/db/schema'
import { Allocation } from '@/lib/domain/allocation'
import { Room, type RoomType } from '@/lib/domain/room'
import { DomainError, adjustBeds, isUniqueViolation, lockRoom, recordStatusChange } from './core'

export async function requestTransfer(
  studentUserId: string,
  input: { allocationId: number; reason: string; preferredHallId: number | null; preferredRoomType: RoomType | null },
) {
  const [allocation] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.id, input.allocationId), eq(allocations.studentUserId, studentUserId)))
  if (!allocation) throw new DomainError('Allocation not found')
  if (allocation.status !== 'confirmed' && allocation.status !== 'checked_in') {
    throw new DomainError('You can request a transfer once your offer is confirmed')
  }
  try {
    const [request] = await db
      .insert(transferRequests)
      .values({
        allocationId: allocation.id,
        studentUserId,
        reason: input.reason,
        preferredHallId: input.preferredHallId,
        preferredRoomType: input.preferredRoomType,
      })
      .returning({ id: transferRequests.id })
    await recordStatusChange(db, {
      entityType: 'transfer_request',
      entityId: request.id,
      fromStatus: null,
      toStatus: 'pending',
      actorUserId: studentUserId,
      reason: input.reason,
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('You already have a pending transfer request')
    throw error
  }
}

export async function cancelTransfer(studentUserId: string, requestId: number) {
  const updated = await db
    .update(transferRequests)
    .set({ status: 'cancelled', decidedAt: new Date() })
    .where(
      and(
        eq(transferRequests.id, requestId),
        eq(transferRequests.studentUserId, studentUserId),
        eq(transferRequests.status, 'pending'),
      ),
    )
    .returning({ id: transferRequests.id })
  if (updated.length === 0) throw new DomainError('No pending transfer request to cancel')
  await recordStatusChange(db, {
    entityType: 'transfer_request',
    entityId: requestId,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorUserId: studentUserId,
  })
}

/**
 * Rule 10: approval moves the student to a compatible bed in one transaction.
 * The old allocation is kept (status "transferred") and the new one points
 * back to it, so the full history survives.
 */
export async function approveTransfer(officerUserId: string, requestId: number, targetRoomId: number, reason: string) {
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(transferRequests).where(eq(transferRequests.id, requestId)).for('update')
    if (!request || request.status !== 'pending') throw new DomainError('This request has already been decided')

    const [old] = await tx.select().from(allocations).where(eq(allocations.id, request.allocationId)).for('update')
    if (!old || (old.status !== 'confirmed' && old.status !== 'checked_in')) {
      throw new DomainError('The student no longer holds an active allocation')
    }
    if (old.roomId === targetRoomId) throw new DomainError('Choose a different room from the current one')

    const [profile] = await tx.select().from(studentProfiles).where(eq(studentProfiles.userId, old.studentUserId))

    // Lock both rooms in id order to avoid deadlocks with other transfers.
    const [firstId, secondId] = [old.roomId, targetRoomId].sort((a, b) => a - b)
    const first = await lockRoom(tx, firstId)
    const second = await lockRoom(tx, secondId)
    const oldRoom = first.roomId === old.roomId ? first : second
    const newRoom = first.roomId === targetRoomId ? first : second

    if (!Room.canAccept(newRoom, profile.gender, 1)) {
      throw new DomainError(`${newRoom.hallName} ${newRoom.roomNumber} is not compatible or has no free bed`)
    }

    const kind = Allocation.bedKind(old.status)
    const delta = kind === 'occupied' ? 'occupied' : 'reserved'
    await adjustBeds(tx, oldRoom, { [delta]: -1 }, profile.gender)
    await adjustBeds(tx, newRoom, { [delta]: 1 }, profile.gender)

    // Close the old allocation first: the database allows only one live allocation per student.
    await tx.update(allocations).set({ status: 'transferred', closedAt: new Date() }).where(eq(allocations.id, old.id))
    const [created] = await tx
      .insert(allocations)
      .values({
        semesterId: old.semesterId,
        applicationId: old.applicationId,
        studentUserId: old.studentUserId,
        roomId: newRoom.roomId,
        status: old.status,
        offerExpiresAt: old.offerExpiresAt,
        confirmedAt: old.confirmedAt,
        checkedInAt: old.status === 'checked_in' ? new Date() : null,
        transferredFromAllocationId: old.id,
      })
      .returning({ id: allocations.id })

    await tx
      .update(transferRequests)
      .set({
        status: 'approved',
        decidedByUserId: officerUserId,
        decisionReason: reason,
        decidedAt: new Date(),
        newAllocationId: created.id,
      })
      .where(eq(transferRequests.id, requestId))

    const where = `${newRoom.hallName} ${newRoom.roomNumber}`
    await recordStatusChange(tx, { entityType: 'allocation', entityId: old.id, fromStatus: old.status, toStatus: 'transferred', actorUserId: officerUserId, reason: `Moved to ${where}` })
    await recordStatusChange(tx, { entityType: 'allocation', entityId: created.id, fromStatus: null, toStatus: old.status, actorUserId: officerUserId, reason: `Transfer from allocation #${old.id}` })
    await recordStatusChange(tx, { entityType: 'transfer_request', entityId: requestId, fromStatus: 'pending', toStatus: 'approved', actorUserId: officerUserId, reason })
  })
}

export async function declineTransfer(officerUserId: string, requestId: number, reason: string) {
  const updated = await db
    .update(transferRequests)
    .set({ status: 'declined', decidedByUserId: officerUserId, decisionReason: reason, decidedAt: new Date() })
    .where(and(eq(transferRequests.id, requestId), eq(transferRequests.status, 'pending')))
    .returning({ id: transferRequests.id })
  if (updated.length === 0) throw new DomainError('This request has already been decided')
  await recordStatusChange(db, {
    entityType: 'transfer_request',
    entityId: requestId,
    fromStatus: 'pending',
    toStatus: 'declined',
    actorUserId: officerUserId,
    reason,
  })
}
