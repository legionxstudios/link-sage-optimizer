import { Suggestion } from "./types";
import { logger } from "../logger";

export function sortSuggestions(suggestions: Suggestion[]): Suggestion[] {
  try {
    return [...suggestions].sort((a, b) => {
      // First compare by relevance score (descending)
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // Then by match type priority (exact > broad > related)
      const matchTypePriority = {
        'exact_match': 3,
        'broad_match': 2,
        'related_match': 1
      };
      const matchTypeA = matchTypePriority[a.matchType as keyof typeof matchTypePriority] || 0;
      const matchTypeB = matchTypePriority[b.matchType as keyof typeof matchTypePriority] || 0;
      
      if (matchTypeA !== matchTypeB) {
        return matchTypeB - matchTypeA;
      }
      
      // Then by anchor text length (shorter is better)
      if (a.suggestedAnchorText.length !== b.suggestedAnchorText.length) {
        return a.suggestedAnchorText.length - b.suggestedAnchorText.length;
      }
      
      // Finally by URL (alphabetically) for consistent tie-breaking
      return a.targetUrl.localeCompare(b.targetUrl);
    });
  } catch (error) {
    logger.error('Error sorting suggestions:', error);
    return suggestions;
  }
}