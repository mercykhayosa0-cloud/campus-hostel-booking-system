import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  allocations,
  applications,
  halls,
  rooms,
  studentProfiles,
} from '@/lib/db/schema'

export async function findStudentProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
  return profile ?? null
}

export async function findActiveApplication(userId: string, semesterId: number) {
  const [application] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.studentUserId, userId),
        eq(applications.semesterId, semesterId),
        eq(applications.status, 'active'),
      ),
    )
  return application ?? null
}

export async function findLiveAllocation(userId: string, semesterId: number) {
  const [row] = await db
    .select({
      id: allocations.id,
      status: allocations.status,
      offerExpiresAt: allocations.offerExpiresAt,
      roomNumber: rooms.roomNumber,
      roomType: rooms.roomType,
      hallName: halls.name,
    })
    .from(allocations)
    .innerJoin(rooms, eq(rooms.id, allocations.roomId))
    .innerJoin(halls, eq(halls.id, rooms.hallId))
    .where(
      and(
        eq(allocations.studentUserId, userId),
        eq(allocations.semesterId, semesterId),
        inArray(allocations.status, ['offered', 'confirmed', 'checked_in']),
      ),
    )
    .orderBy(desc(allocations.createdAt))
  return row ?? null
}
