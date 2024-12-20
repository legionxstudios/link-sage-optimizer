import { logger } from "../logger.ts";

export function calculateUrlScore(keyword: string, url: string): number {
  try {
    const urlSlug = new URL(url).pathname.toLowerCase();
    const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-');
    
    // Check for exact slug match
    if (urlSlug.includes(keywordSlug)) {
      logger.info(`Exact URL match found for "${keyword}" in ${url}`);
      return 1.0;
    }
    
    // Check for partial word matches in URL
    const keywordParts = keyword.toLowerCase().split(' ');
    let matchCount = 0;
    
    keywordParts.forEach(part => {
      if (urlSlug.includes(part)) {
        matchCount++;
      }
    });
    
    const score = (matchCount / keywordParts.length) * 0.7; // Partial matches get up to 70%
    logger.info(`URL score for "${keyword}": ${score} (${matchCount}/${keywordParts.length} parts matched) in ${url}`);
    return score;
    
  } catch (error) {
    logger.error(`Error calculating URL score for ${url}:`, error);
    return 0;
  }
}