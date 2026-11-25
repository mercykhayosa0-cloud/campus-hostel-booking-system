/**
 * Domain concepts for Hall and Room. Pure logic, no database access.
 */
export type Gender = 'male' | 'female'
export type RoomType = 'single' | 'double' | 'shared'
export type GenderPolicy = 'male_only' | 'female_only' | 'mixed'

export const ROOM_CAPACITY: Record<RoomType, number> = { single: 1, double: 2, shared: 4 }

export const roomTypeLabel: Record<RoomType, string> = {
  single: 'Single (1 bed)',
  double: 'Double (2 beds)',
  shared: 'Shared (4 beds)',
}

export const genderPolicyLabel: Record<GenderPolicy, string> = {
  male_only: 'Male only',
  female_only: 'Female only',
  mixed: 'Mixed',
}

/** A snapshot of one room's bed state, as used by matching and the bed ledger. */
export type RoomSnapshot = {
  roomId: number
  hallId: number
  hallName: string
  hallPolicy: GenderPolicy
  roomNumber: string
  roomType: RoomType
  capacity: number
  occupiedBeds: number
  reservedBeds: number
  /** In a mixed hall each room is single-gender; null means the room is empty. */
  occupantGender: Gender | null
  isInService: boolean
}

export class Hall {
  /** Can a student of this gender live in a hall with this policy? */
  static admits(policy: GenderPolicy, gender: Gender): boolean {
    if (policy === 'mixed') return true
    return policy === (gender === 'male' ? 'male_only' : 'female_only')
  }

  /** Rooms in single-gender halls carry the hall's gender permanently. */
  static fixedRoomGender(policy: GenderPolicy): Gender | null {
    if (policy === 'male_only') return 'male'
    if (policy === 'female_only') return 'female'
    return null
  }
}

export class Room {
  static freeBeds(room: Pick<RoomSnapshot, 'capacity' | 'occupiedBeds' | 'reservedBeds'>): number {
    return room.capacity - room.occupiedBeds - room.reservedBeds
  }

  /**
   * Rule 7: only in-service rooms with a compatible gender and enough free
   * beds can be allocated.
   */
  static canAccept(room: RoomSnapshot, gender: Gender, bedsNeeded = 1): boolean {
    if (!room.isInService) return false
    if (!Hall.admits(room.hallPolicy, gender)) return false
    if (room.occupantGender && room.occupantGender !== gender) return false
    return Room.freeBeds(room) >= bedsNeeded
  }

  /** Gender the room should record after it becomes empty. */
  static genderWhenEmpty(policy: GenderPolicy): Gender | null {
    return Hall.fixedRoomGender(policy)
  }
}
