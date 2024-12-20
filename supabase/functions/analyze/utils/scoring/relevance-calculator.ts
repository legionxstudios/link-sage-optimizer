import { logger } from "../logger.ts";
import { calculateUrlRelevance } from "./url-relevance.ts";
import { calculateContentRelevance } from "./content-relevance.ts";
import { calculateTitleRelevance } from "./title-relevance.ts";
import type { ExistingPage } from "../types.ts";

// Scoring weights for different components
const WEIGHTS = {
  url: 0.3,     // URL relevance (30%)
  title: 0.3,   // Title relevance (30%)
  content: 0.4  // Content relevance (40%)
} as const;

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  try {
    if (!page.url) return 0;
    
    // Calculate individual component scores
    const urlScore = calculateUrlRelevance(keyword, page.url);
    const titleScore = calculateTitleRelevance(keyword, page.title);
    const contentScore = calculateContentRelevance(keyword, page.content);
    
    // Calculate weighted final score
    const finalScore = (
      urlScore * WEIGHTS.url +
      titleScore * WEIGHTS.title +
      contentScore * WEIGHTS.content
    );
    
    logger.info(`Final relevance scores for "${keyword}":`, {
      url: urlScore,
      title: titleScore,
      content: contentScore,
      final: finalScore
    });
    
    return Math.min(1.0, finalScore);
    
  } catch (error) {
    logger.error(`Error calculating relevance score for "${keyword}":`, error);
    return 0;
  }
}