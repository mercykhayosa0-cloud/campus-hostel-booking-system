/**
 * Project assumptions that are policy decisions rather than hard requirements.
 * They live in one place so they are visible, explainable in the defence, and
 * easy to change if the lecturer or OOAD pack says otherwise.
 */
export const policyConfig = {
  /** If no room matches the preferred room type, offer another compatible type. */
  allowRoomTypeFallback: true,
  /** If no room in the preferred hall is available, offer another compatible hall. */
  allowHallFallback: true,
  /**
   * Preference fit (ranking factor 4) = how many of the applicant's stated
   * preferences can be met from capacity available when the run starts:
   * +1 preferred hall, +1 preferred room type, +1 valid mutual roommate pair.
   */
  preferenceFitWeights: { hall: 1, roomType: 1, mutualRoommate: 1 },
  /** Default hours a student has to confirm an offer (overridable per semester). */
  defaultOfferConfirmationHours: 72,
} as const
