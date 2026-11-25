import 'server-only'
import { asc, count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  applications,
  damageFindings,
  halls,
  rooms,
  semesters,
  transferRequests,
} from '@/lib/db/schema'

export async function findCurrentSemester() {
  const [semester] = await db.select().from(semesters).where(eq(semesters.isCurrent, true))
  return semester ?? null
}

/** Bed totals per hall. Available = in-service beds not occupied or reserved. */
export async function listHallOccupancy(caretakerUserId?: string) {
  return db
    .select({
      id: halls.id,
      name: halls.name,
      code: halls.code,
      genderPolicy: halls.genderPolicy,
      roomCount: count(rooms.id),
      totalBeds: sql<number>`coalesce(sum(${rooms.capacity}), 0)::int`,
      occupiedBeds: sql<number>`coalesce(sum(${rooms.occupiedBeds}), 0)::int`,
      reservedBeds: sql<number>`coalesce(sum(${rooms.reservedBeds}), 0)::int`,
      availableBeds: sql<number>`coalesce(sum(case when ${rooms.isInService} then ${rooms.capacity} - ${rooms.occupiedBeds} - ${rooms.reservedBeds} else 0 end), 0)::int`,
      roomsOutOfService: sql<number>`count(*) filter (where ${rooms.isInService} = false)::int`,
    })
    .from(halls)
    .leftJoin(rooms, eq(rooms.hallId, halls.id))
    .where(caretakerUserId ? eq(halls.caretakerUserId, caretakerUserId) : undefined)
    .groupBy(halls.id)
    .orderBy(asc(halls.name))
}

export async function listRoomsForCaretaker(caretakerUserId: string) {
  return db
    .select({
      id: rooms.id,
      hallName: halls.name,
      roomNumber: rooms.roomNumber,
      roomType: rooms.roomType,
      capacity: rooms.capacity,
      occupiedBeds: rooms.occupiedBeds,
      reservedBeds: rooms.reservedBeds,
      isInService: rooms.isInService,
    })
    .from(rooms)
    .innerJoin(halls, eq(halls.id, rooms.hallId))
    .where(eq(halls.caretakerUserId, caretakerUserId))
    .orderBy(asc(halls.name), asc(rooms.roomNumber))
}

export async function getOfficerWorkQueue(semesterId: number | null) {
  const [activeApplications] = semesterId
    ? await db
        .select({ value: count() })
        .from(applications)
        .where(sql`${applications.semesterId} = ${semesterId} and ${applications.status} = 'active'`)
    : [{ value: 0 }]
  const [pendingTransfers] = await db
    .select({ value: count() })
    .from(transferRequests)
    .where(eq(transferRequests.status, 'pending'))
  const [pendingDamage] = await db
    .select({ value: count() })
    .from(damageFindings)
    .where(eq(damageFindings.status, 'pending_review'))
  return {
    activeApplications: activeApplications.value,
    pendingTransfers: pendingTransfers.value,
    pendingDamageReviews: pendingDamage.value,
  }
}
