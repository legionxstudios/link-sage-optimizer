import { logger } from "../logger.ts";
import { ExistingPage } from "./types.ts";

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  try {
    if (!page.url) return 0;
    
    let score = 0;
    const keywordLower = keyword.toLowerCase();
    
    // URL slug match (highest weight)
    const urlSlug = new URL(page.url).pathname.toLowerCase();
    if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
      score += 0.6;
      logger.info(`URL match found for "${keyword}" in ${page.url}`);
    }
    
    // Title match (medium weight)
    if (page.title?.toLowerCase().includes(keywordLower)) {
      score += 0.3;
      logger.info(`Title match found for "${keyword}" in ${page.title}`);
    }
    
    // Content match (lower weight)
    if (page.content?.toLowerCase().includes(keywordLower)) {
      const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
      score += Math.min(0.1, frequency * 0.02);
      logger.info(`Content matches found for "${keyword}": ${frequency} occurrences`);
    }
    
    logger.info(`Final relevance score for "${keyword}" -> ${page.url}: ${score}`);
    return Math.min(1.0, score);
  } catch (error) {
    logger.error(`Error calculating relevance score for URL ${page.url}:`, error);
    return 0;
  }
}