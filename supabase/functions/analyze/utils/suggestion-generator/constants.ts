export const SUGGESTION_LIMITS = {
  MAX_SUGGESTIONS: 10, // Increased from 5 to 10
  MIN_RELEVANCE_SCORE: 0.25, // Slightly lowered threshold to allow more relevant matches
  MATCH_TYPE_THRESHOLDS: {
    exact_match: 0.4,  // Increased to better differentiate exact matches
    broad_match: 0.3,  // Adjusted for clearer distinction
    related_match: 0.25 // Minimum threshold for related matches
  }
} as const;