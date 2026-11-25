/**
 * Domain class: the Allocation state machine (rule 9). Confirmation is not
 * occupancy, so each step is a separate status.
 *
 *   offered ──confirm──▶ confirmed ──check in──▶ checked_in ──check out──▶ checked_out
 *      │                    │                        │
 *      ├─deadline─▶ lapsed  ├─cancel─▶ cancelled     ├─semester end─▶ ended
 *      └─cancel──▶ cancelled└─transfer─▶ transferred └─transfer─▶ transferred
 */
export type AllocationStatus =
  | 'offered'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'lapsed'
  | 'cancelled'
  | 'ended'
  | 'transferred'

const transitions: Record<AllocationStatus, AllocationStatus[]> = {
  offered: ['confirmed', 'lapsed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'transferred'],
  checked_in: ['checked_out', 'ended', 'transferred'],
  checked_out: [],
  lapsed: [],
  cancelled: [],
  ended: [],
  transferred: [],
}

export const allocationStatusLabel: Record<AllocationStatus, string> = {
  offered: 'Offered',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  lapsed: 'Lapsed',
  cancelled: 'Cancelled',
  ended: 'Semester ended',
  transferred: 'Transferred',
}

/** Statuses that hold a bed (a reserved or an occupied one). */
export const LIVE_STATUSES = ['offered', 'confirmed', 'checked_in'] as const

export class Allocation {
  static canTransition(from: AllocationStatus, to: AllocationStatus): boolean {
    return transitions[from].includes(to)
  }

  /** Which bed counter a status uses: reserved for offers, occupied for residents. */
  static bedKind(status: AllocationStatus): 'reserved' | 'occupied' | null {
    if (status === 'offered' || status === 'confirmed') return 'reserved'
    if (status === 'checked_in') return 'occupied'
    return null
  }

  static isOfferExpired(status: AllocationStatus, offerExpiresAt: Date, now = new Date()): boolean {
    return status === 'offered' && offerExpiresAt.getTime() <= now.getTime()
  }

  static offerDeadline(from: Date, confirmationHours: number): Date {
    return new Date(from.getTime() + confirmationHours * 60 * 60 * 1000)
  }
}
