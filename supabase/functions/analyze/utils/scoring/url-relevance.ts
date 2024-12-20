import { logger } from "../logger.ts";

export function calculateUrlRelevance(keyword: string, url: string): number {
  try {
    if (!url) return 0;
    
    const urlPath = new URL(url).pathname.toLowerCase();
    const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-');
    
    // Exact slug match gets highest score
    if (urlPath.includes(keywordSlug)) {
      logger.info(`High URL relevance (0.8) for "${keyword}" in ${url}`);
      return 0.8;
    }
    
    // Check for partial word matches in URL
    const keywordParts = keyword.toLowerCase().split(' ');
    const matchCount = keywordParts.filter(part => 
      urlPath.includes(part.replace(/[^a-z0-9]/g, ''))
    ).length;
    
    const partialScore = matchCount / keywordParts.length * 0.5;
    logger.info(`Partial URL relevance (${partialScore}) for "${keyword}" in ${url}`);
    return partialScore;
    
  } catch (error) {
    logger.error(`Error calculating URL relevance for ${url}:`, error);
    return 0;
  }
}