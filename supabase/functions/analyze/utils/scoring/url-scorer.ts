import { logger } from "../logger.ts";

export function calculateUrlScore(keyword: string, url: string): number {
  try {
    const urlSlug = new URL(url).pathname.toLowerCase();
    const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-');
    
    // Check for exact slug match
    if (urlSlug.includes(keywordSlug)) {
      logger.info(`Exact URL match found for "${keyword}"`);
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
    
    const score = matchCount / keywordParts.length;
    logger.info(`URL score for "${keyword}": ${score} (${matchCount}/${keywordParts.length} parts matched)`);
    return score;
    
  } catch (error) {
    logger.error(`Error calculating URL score: ${error}`);
    return 0;
  }
}