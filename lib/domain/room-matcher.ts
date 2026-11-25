import { policyConfig } from './policy-config'
import { Room, type Gender, type RoomSnapshot, type RoomType } from './room'

export type MatchRequest = {
  gender: Gender
  preferredHallId: number | null
  preferredRoomType: RoomType | null
  bedsNeeded: number
  excludeRoomId?: number
}

export type MatchResult = {
  room: RoomSnapshot
  hallMatched: boolean
  roomTypeMatched: boolean
}

/**
 * Domain class: chooses the best compatible room for an applicant.
 * Search order (deterministic):
 *   1. preferred hall AND preferred room type
 *   2. preferred room type in any hall
 *   3. preferred hall, any room type
 *   4. any compatible room
 * Steps 2-4 obey the fallback switches in policyConfig. Within a step, rooms
 * are tried by hall name then room number, so the same input always gives
 * the same answer.
 */
export class RoomMatcher {
  findBest(rooms: RoomSnapshot[], request: MatchRequest): MatchResult | null {
    const candidates = rooms
      .filter((room) => room.roomId !== request.excludeRoomId)
      .filter((room) => Room.canAccept(room, request.gender, request.bedsNeeded))
      .sort(
        (a, b) =>
          a.hallName.localeCompare(b.hallName) || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
      )

    const hallOk = (room: RoomSnapshot) => request.preferredHallId === null || room.hallId === request.preferredHallId
    const typeOk = (room: RoomSnapshot) => request.preferredRoomType === null || room.roomType === request.preferredRoomType

    const tiers: Array<(room: RoomSnapshot) => boolean> = [(room) => hallOk(room) && typeOk(room)]
    if (policyConfig.allowHallFallback) tiers.push(typeOk)
    if (policyConfig.allowRoomTypeFallback) tiers.push(hallOk)
    if (policyConfig.allowHallFallback && policyConfig.allowRoomTypeFallback) tiers.push(() => true)

    for (const tier of tiers) {
      const room = candidates.find(tier)
      if (room) {
        return {
          room,
          hallMatched: request.preferredHallId === null || room.hallId === request.preferredHallId,
          roomTypeMatched: request.preferredRoomType === null || room.roomType === request.preferredRoomType,
        }
      }
    }
    return null
  }

  /** Every room that could legally take this student (used for transfer choices). */
  listCompatible(rooms: RoomSnapshot[], gender: Gender, excludeRoomId?: number): RoomSnapshot[] {
    return rooms.filter((room) => room.roomId !== excludeRoomId && Room.canAccept(room, gender, 1))
  }

  /**
   * Ranking factor "preference fit": how many stated preferences the
   * currently available capacity could satisfy.
   */
  preferenceFit(
    rooms: RoomSnapshot[],
    request: Omit<MatchRequest, 'bedsNeeded'>,
    hasMutualRoommate: boolean,
  ): { score: number; hallAvailable: boolean; roomTypeAvailable: boolean } {
    const open = rooms.filter((room) => Room.canAccept(room, request.gender, 1))
    const hallAvailable = request.preferredHallId !== null && open.some((r) => r.hallId === request.preferredHallId)
    const roomTypeAvailable =
      request.preferredRoomType !== null &&
      open.some(
        (r) =>
          r.roomType === request.preferredRoomType &&
          (request.preferredHallId === null || r.hallId === request.preferredHallId || policyConfig.allowHallFallback),
      )
    const w = policyConfig.preferenceFitWeights
    const score =
      (hallAvailable ? w.hall : 0) + (roomTypeAvailable ? w.roomType : 0) + (hasMutualRoommate ? w.mutualRoommate : 0)
    return { score, hallAvailable, roomTypeAvailable }
  }
}

export const roomMatcher = new RoomMatcher()
