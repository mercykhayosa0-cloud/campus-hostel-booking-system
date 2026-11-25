/**
 * Domain class: the deterministic, explainable ranking from rule 6.
 * Eligible applicants are ordered by:
 *   1. year of study            (higher first)
 *   2. distance from home       (farther first)
 *   3. not housed last semester (priority first)
 *   4. preference fit           (higher first)
 *   5. application time         (earlier first)
 *   6. student number           (final tie-breaker, ascending)
 */
export type RankingCandidate = {
  applicationId: number
  studentNumber: string
  yearOfStudy: number
  homeDistanceKm: number
  housedPreviousSemester: boolean
  preferenceFit: number
  submittedAt: Date
}

export type RankingFactors = {
  yearOfStudy: number
  homeDistanceKm: number
  notHousedPreviousSemester: boolean
  preferenceFit: number
  submittedAt: string
  studentNumber: string
}

export class AllocationPriorityPolicy {
  static readonly version = 'v1: year > distance > not-housed > preference-fit > time > student-no'

  compare(a: RankingCandidate, b: RankingCandidate): number {
    return (
      b.yearOfStudy - a.yearOfStudy ||
      b.homeDistanceKm - a.homeDistanceKm ||
      Number(a.housedPreviousSemester) - Number(b.housedPreviousSemester) ||
      b.preferenceFit - a.preferenceFit ||
      a.submittedAt.getTime() - b.submittedAt.getTime() ||
      a.studentNumber.localeCompare(b.studentNumber)
    )
  }

  rank<T extends RankingCandidate>(candidates: T[]): Array<T & { rank: number }> {
    return [...candidates].sort((a, b) => this.compare(a, b)).map((c, index) => ({ ...c, rank: index + 1 }))
  }

  /** The values saved with each run entry so a past ranking can be audited. */
  factorsOf(candidate: RankingCandidate): RankingFactors {
    return {
      yearOfStudy: candidate.yearOfStudy,
      homeDistanceKm: candidate.homeDistanceKm,
      notHousedPreviousSemester: !candidate.housedPreviousSemester,
      preferenceFit: candidate.preferenceFit,
      submittedAt: candidate.submittedAt.toISOString(),
      studentNumber: candidate.studentNumber,
    }
  }
}

export const allocationPriorityPolicy = new AllocationPriorityPolicy()
