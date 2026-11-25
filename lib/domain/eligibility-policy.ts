/**
 * Domain class: decides whether a student may be considered for allocation.
 * Pure logic with no database access, so it can be unit-tested and shown
 * directly on the OOAD class diagram.
 */
export type EligibilityInput = {
  isEnrolled: boolean
  isFeeCleared: boolean
  hasDisciplinaryHold: boolean
}

export type EligibilityResult = {
  isEligible: boolean
  reasons: string[]
}

export class EligibilityPolicy {
  evaluate(student: EligibilityInput): EligibilityResult {
    const reasons: string[] = []
    if (!student.isEnrolled) reasons.push('Not currently enrolled')
    if (!student.isFeeCleared) reasons.push('Fees not cleared')
    if (student.hasDisciplinaryHold) reasons.push('Disciplinary hold on record')
    return { isEligible: reasons.length === 0, reasons }
  }
}

export const eligibilityPolicy = new EligibilityPolicy()
