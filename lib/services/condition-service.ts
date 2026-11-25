import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { allocations, damageCharges, damageFindings, inspections, roomServiceEvents, rooms } from '@/lib/db/schema'
import { DomainError, lockRoom, recordStatusChange, type LockedRoom } from './core'

export type RoomCondition = 'good' | 'fair' | 'needs_repair' | 'unsafe'

function assertCaretakerOf(caretakerUserId: string, room: LockedRoom) {
  if (room.caretakerUserId !== caretakerUserId) throw new DomainError(`You are not the caretaker for ${room.hallName}`)
}

/**
 * Rule 11: a caretaker records an inspection. A room in "needs repair" can be
 * closed; an "unsafe" room is always closed. Closing does not move existing
 * residents; the officer handles them through transfers.
 */
export async function recordInspection(
  caretakerUserId: string,
  input: { roomId: number; condition: RoomCondition; notes: string | null; closeRoom: boolean },
) {
  return db.transaction(async (tx) => {
    const room = await lockRoom(tx, input.roomId)
    assertCaretakerOf(caretakerUserId, room)

    const mustClose = input.condition === 'unsafe'
    const wantsClose = input.closeRoom || mustClose
    if (wantsClose && input.condition !== 'needs_repair' && input.condition !== 'unsafe') {
      throw new DomainError('Only a room that needs repair or is unsafe can be taken out of service')
    }

    const [inspection] = await tx
      .insert(inspections)
      .values({ roomId: room.roomId, caretakerUserId, condition: input.condition, notes: input.notes })
      .returning({ id: inspections.id })

    let closed = false
    if (wantsClose && room.isInService) {
      const reason = input.notes ?? `Inspection found the room ${input.condition.replace('_', ' ')}`
      await tx.update(rooms).set({ isInService: false }).where(eq(rooms.id, room.roomId))
      await tx.insert(roomServiceEvents).values({
        roomId: room.roomId,
        action: 'closed',
        inspectionId: inspection.id,
        recordedByUserId: caretakerUserId,
        reason,
      })
      await recordStatusChange(tx, {
        entityType: 'room',
        entityId: room.roomId,
        fromStatus: 'in_service',
        toStatus: 'out_of_service',
        actorUserId: caretakerUserId,
        reason,
      })
      closed = true
    }
    return { closed, residentsAffected: room.occupiedBeds + room.reservedBeds }
  })
}

/** The only way a closed room returns to service. */
export async function clearRepair(caretakerUserId: string, roomId: number, notes: string) {
  await db.transaction(async (tx) => {
    const room = await lockRoom(tx, roomId)
    assertCaretakerOf(caretakerUserId, room)
    if (room.isInService) throw new DomainError('This room is already in service')
    await tx.update(rooms).set({ isInService: true }).where(eq(rooms.id, roomId))
    await tx.insert(roomServiceEvents).values({ roomId, action: 'repair_cleared', recordedByUserId: caretakerUserId, reason: notes })
    await recordStatusChange(tx, {
      entityType: 'room',
      entityId: roomId,
      fromStatus: 'out_of_service',
      toStatus: 'in_service',
      actorUserId: caretakerUserId,
      reason: notes,
    })
  })
}

/** Rule 12: evidence is recorded against the room AND the occupancy period it happened in. */
export async function recordDamageFinding(
  caretakerUserId: string,
  input: { roomId: number; allocationId: number; description: string; evidenceNotes: string | null; estimatedCost: number | null },
) {
  await db.transaction(async (tx) => {
    const room = await lockRoom(tx, input.roomId)
    assertCaretakerOf(caretakerUserId, room)
    const [allocation] = await tx.select().from(allocations).where(eq(allocations.id, input.allocationId))
    if (!allocation || allocation.roomId !== room.roomId || !allocation.checkedInAt) {
      throw new DomainError('Choose an occupancy period that belongs to this room')
    }
    const [finding] = await tx
      .insert(damageFindings)
      .values({ ...input, recordedByUserId: caretakerUserId })
      .returning({ id: damageFindings.id })
    await recordStatusChange(tx, {
      entityType: 'damage_finding',
      entityId: finding.id,
      fromStatus: null,
      toStatus: 'pending_review',
      actorUserId: caretakerUserId,
      reason: input.description,
    })
  })
}

/** An authorized officer approves (with an amount) or declines a charge, always with a reason. */
export async function decideDamageCharge(
  officerUserId: string,
  input: { findingId: number; decision: 'approved' | 'declined'; amount: number | null; reason: string },
) {
  if (input.decision === 'approved' && (input.amount === null || input.amount <= 0)) {
    throw new DomainError('Enter the charge amount to approve')
  }
  await db.transaction(async (tx) => {
    const [finding] = await tx.select().from(damageFindings).where(eq(damageFindings.id, input.findingId)).for('update')
    if (!finding || finding.status !== 'pending_review') throw new DomainError('This finding has already been decided')
    const toStatus = input.decision === 'approved' ? 'charge_approved' : 'charge_declined'
    await tx.insert(damageCharges).values({
      damageFindingId: finding.id,
      decision: input.decision,
      amount: input.decision === 'approved' ? input.amount : null,
      decidedByUserId: officerUserId,
      decisionReason: input.reason,
    })
    await tx.update(damageFindings).set({ status: toStatus }).where(eq(damageFindings.id, finding.id))
    await recordStatusChange(tx, {
      entityType: 'damage_finding',
      entityId: finding.id,
      fromStatus: 'pending_review',
      toStatus,
      actorUserId: officerUserId,
      reason: input.reason,
    })
  })
}
