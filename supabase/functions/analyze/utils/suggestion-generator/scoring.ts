import { logger } from "../logger.ts";
import { ExistingPage } from "./types.ts";

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  try {
    if (!page.url) return 0;
    
    let score = 0;
    const keywordLower = keyword.toLowerCase();
    
    // URL scoring (highest weight - 0.5 max)
    try {
      const urlSlug = new URL(page.url).pathname.toLowerCase();
      
      // Exact keyword match in URL slug
      if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
        score += 0.5;
      } else {
        // Partial word matches in URL
        const keywordParts = keywordLower.split(' ');
        const matchCount = keywordParts.filter(part => 
          urlSlug.includes(part.replace(/\s+/g, '-'))
        ).length;
        score += (matchCount / keywordParts.length) * 0.3;
      }
    } catch (error) {
      logger.error(`Error processing URL ${page.url}:`, error);
    }
    
    // Title scoring (medium weight - 0.3 max)
    if (page.title) {
      const titleLower = page.title.toLowerCase();
      if (titleLower.includes(keywordLower)) {
        score += 0.3;
      } else {
        // Partial word matches in title
        const keywordParts = keywordLower.split(' ');
        const matchCount = keywordParts.filter(part => 
          titleLower.includes(part)
        ).length;
        score += (matchCount / keywordParts.length) * 0.2;
      }
    }
    
    // Content scoring (lower weight - 0.2 max)
    if (page.content) {
      const contentLower = page.content.toLowerCase();
      // Calculate keyword density
      const keywordCount = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
      const wordCount = contentLower.split(/\s+/).length;
      const density = keywordCount / wordCount;
      
      // Ideal density is between 1-3%
      score += Math.min(0.2, density * 10);
    }
    
    logger.info(`Relevance score for "${keyword}" -> ${page.url}: ${score} (URL: ${page.url}, Title: ${page.title?.substring(0, 50)})`);
    return Math.min(1.0, score);
  } catch (error) {
    logger.error(`Error calculating relevance score for URL ${page.url}:`, error);
    return 0;
  }
}