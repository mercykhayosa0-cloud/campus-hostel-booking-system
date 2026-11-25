import 'server-only'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '@/lib/db'
import { halls, rooms, statusChanges } from '@/lib/db/schema'
import { Room, type Gender, type RoomSnapshot } from '@/lib/domain/room'

/** A business-rule violation whose message is safe to show to the user. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Executor = typeof db | Tx

/** Validate FormData against a zod schema; the first problem becomes the error message. */
export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, FormDataEntryValue> = {}
  for (const [key, value] of formData.entries()) raw[key] = value
  const result = schema.safeParse(raw)
  if (!result.success) throw new DomainError(result.error.issues[0]?.message ?? 'Invalid input')
  return result.data
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code
  return code === '23505'
}

type HistoryEntry = {
  entityType: 'application' | 'allocation' | 'transfer_request' | 'room' | 'damage_finding'
  entityId: number
  fromStatus: string | null
  toStatus: string
  actorUserId: string | null
  reason?: string | null
}

/** Every status change is written here so decisions can be explained later. */
export async function recordStatusChange(exec: Executor, entry: HistoryEntry) {
  await exec.insert(statusChanges).values({ ...entry, reason: entry.reason ?? null })
}

const roomSnapshotColumns = {
  roomId: rooms.id,
  hallId: rooms.hallId,
  hallName: halls.name,
  hallPolicy: halls.genderPolicy,
  caretakerUserId: halls.caretakerUserId,
  roomNumber: rooms.roomNumber,
  roomType: rooms.roomType,
  capacity: rooms.capacity,
  occupiedBeds: rooms.occupiedBeds,
  reservedBeds: rooms.reservedBeds,
  occupantGender: rooms.occupantGender,
  isInService: rooms.isInService,
}

export type LockedRoom = RoomSnapshot & { caretakerUserId: string }

/**
 * Bed ledger, part 1: lock a room row (SELECT ... FOR UPDATE) so no other
 * transaction can change its bed counts until this one commits.
 */
export async function lockRoom(tx: Tx, roomId: number): Promise<LockedRoom> {
  const [room] = await tx
    .select(roomSnapshotColumns)
    .from(rooms)
    .innerJoin(halls, eq(halls.id, rooms.hallId))
    .where(eq(rooms.id, roomId))
    .for('update', { of: rooms })
  if (!room) throw new DomainError('Room not found')
  return room
}

/** Lock every room in id order (a fixed order prevents deadlocks). */
export async function lockAllRooms(tx: Tx): Promise<LockedRoom[]> {
  return tx
    .select(roomSnapshotColumns)
    .from(rooms)
    .innerJoin(halls, eq(halls.id, rooms.hallId))
    .orderBy(rooms.id)
    .for('update', { of: rooms })
}

export async function readAllRooms(exec: Executor): Promise<LockedRoom[]> {
  return exec.select(roomSnapshotColumns).from(rooms).innerJoin(halls, eq(halls.id, rooms.hallId)).orderBy(rooms.id)
}

/**
 * Bed ledger, part 2: change a locked room's reserved/occupied counters.
 * Never lets a count go below zero or above capacity, and keeps the
 * single-gender rule for rooms in mixed halls.
 */
export async function adjustBeds(
  tx: Tx,
  room: RoomSnapshot,
  delta: { reserved?: number; occupied?: number },
  gender: Gender,
) {
  const reservedBeds = room.reservedBeds + (delta.reserved ?? 0)
  const occupiedBeds = room.occupiedBeds + (delta.occupied ?? 0)
  if (reservedBeds < 0 || occupiedBeds < 0) throw new Error(`Bed ledger underflow for room ${room.roomId}`)
  if (reservedBeds + occupiedBeds > room.capacity) {
    throw new DomainError(`Room ${room.roomNumber} has no free bed`)
  }
  const occupantGender =
    reservedBeds + occupiedBeds === 0 ? Room.genderWhenEmpty(room.hallPolicy) : (room.occupantGender ?? gender)

  await tx.update(rooms).set({ reservedBeds, occupiedBeds, occupantGender }).where(eq(rooms.id, room.roomId))
  Object.assign(room, { reservedBeds, occupiedBeds, occupantGender })
}
