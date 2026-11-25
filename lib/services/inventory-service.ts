import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { halls, rooms, studentProfiles, user } from '@/lib/db/schema'
import { Hall, ROOM_CAPACITY, type GenderPolicy, type RoomType } from '@/lib/domain/room'
import { DomainError, isUniqueViolation } from './core'

export async function createHall(input: { name: string; code: string; genderPolicy: GenderPolicy; caretakerUserId: string }) {
  const [caretaker] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, input.caretakerUserId), eq(user.role, 'caretaker')))
  if (!caretaker) throw new DomainError('Choose a caretaker account for the hall')
  try {
    await db.insert(halls).values({ ...input, code: input.code.toUpperCase() })
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A hall with that name or code already exists')
    throw error
  }
}

export async function reassignCaretaker(hallId: number, caretakerUserId: string) {
  const [caretaker] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, caretakerUserId), eq(user.role, 'caretaker')))
  if (!caretaker) throw new DomainError('Choose a caretaker account')
  const updated = await db.update(halls).set({ caretakerUserId }).where(eq(halls.id, hallId)).returning()
  if (updated.length === 0) throw new DomainError('Hall not found')
}

/** Capacity is derived from the room type (rule 2), never typed in by hand. */
export async function createRoom(input: { hallId: number; roomNumber: string; roomType: RoomType }) {
  const [hall] = await db.select().from(halls).where(eq(halls.id, input.hallId))
  if (!hall) throw new DomainError('Hall not found')
  try {
    await db.insert(rooms).values({
      hallId: hall.id,
      roomNumber: input.roomNumber.toUpperCase(),
      roomType: input.roomType,
      capacity: ROOM_CAPACITY[input.roomType],
      occupantGender: Hall.fixedRoomGender(hall.genderPolicy),
      isInService: true,
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError(`Room ${input.roomNumber} already exists in ${hall.name}`)
    throw error
  }
}

/**
 * The system consumes eligibility values from the registry (rule 5). In this
 * release an officer maintains them here instead of an integration.
 */
export async function updateStudentRecord(
  userId: string,
  input: {
    yearOfStudy: number
    homeDistanceKm: number
    isEnrolled: boolean
    isFeeCleared: boolean
    hasDisciplinaryHold: boolean
    housedPreviousSemester: boolean
  },
) {
  const updated = await db
    .update(studentProfiles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(studentProfiles.userId, userId))
    .returning()
  if (updated.length === 0) throw new DomainError('Student record not found')
}
