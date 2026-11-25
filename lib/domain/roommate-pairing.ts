import type { Gender } from './room'

export type PairingApplicant = {
  applicationId: number
  studentNumber: string
  gender: Gender
  preferredRoommateStudentNumber: string | null
  isEligible: boolean
  alreadyAllocated: boolean
}

export type PairingOutcome =
  | { kind: 'none' }
  | { kind: 'mutual'; partnerApplicationId: number }
  | { kind: 'unmet'; reason: string }

/**
 * Domain class: rule 4. A roommate choice is a pair preference only when
 * both students have active applications this semester, choose each other,
 * and are compatible (eligible, not already housed, same gender).
 */
export class RoommatePairing {
  resolve(applicants: PairingApplicant[]): Map<number, PairingOutcome> {
    const byNumber = new Map(applicants.map((a) => [a.studentNumber, a]))
    const outcomes = new Map<number, PairingOutcome>()

    for (const a of applicants) {
      const wanted = a.preferredRoommateStudentNumber
      if (!wanted) {
        outcomes.set(a.applicationId, { kind: 'none' })
        continue
      }
      const b = byNumber.get(wanted)
      const unmet = (reason: string) => outcomes.set(a.applicationId, { kind: 'unmet', reason })
      if (!b) unmet(`${wanted} has no active application this semester`)
      else if (b.preferredRoommateStudentNumber !== a.studentNumber) unmet(`${wanted} did not choose you back`)
      else if (b.gender !== a.gender) unmet('Roommates must be compatible with the same room gender')
      else if (!a.isEligible || !b.isEligible) unmet('Both students must be eligible')
      else if (a.alreadyAllocated || b.alreadyAllocated) unmet('One of the pair already holds a room')
      else outcomes.set(a.applicationId, { kind: 'mutual', partnerApplicationId: b.applicationId })
    }
    return outcomes
  }
}

export const roommatePairing = new RoommatePairing()
