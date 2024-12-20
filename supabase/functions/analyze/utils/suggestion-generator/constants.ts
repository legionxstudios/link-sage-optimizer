export const SUGGESTION_LIMITS = {
  MAX_SUGGESTIONS: 5,
  MIN_RELEVANCE_SCORE: 0.3,
  MATCH_TYPE_THRESHOLDS: {
    exact_match: 0.3,
    broad_match: 0.25,
    related_match: 0.2
  }
} as const;