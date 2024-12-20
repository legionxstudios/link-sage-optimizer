import { ExistingPage } from "../types.ts";
import { logger } from "../logger.ts";
import { isValidUrl } from "./url-utils.ts";

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  try {
    let score = 0;
    const keywordLower = keyword.toLowerCase();
    
    if (!page.url || !isValidUrl(page.url)) return 0;
    
    // Check URL slug
    const urlSlug = new URL(page.url).pathname.toLowerCase();
    if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
      score += 0.4;
    }
    
    // Check title
    if (page.title?.toLowerCase().includes(keywordLower)) {
      score += 0.3;
    }
    
    // Check content
    if (page.content?.toLowerCase().includes(keywordLower)) {
      const frequency = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
      score += Math.min(0.3, frequency * 0.05);
    }
    
    return Math.min(1.0, score);
  } catch (error) {
    logger.error(`Error calculating relevance score for URL ${page.url}:`, error);
    return 0;
  }
}

export function extractContext(content: string, keyword: string): string {
  try {
    const keywordLower = keyword.toLowerCase();
    const contentLower = content.toLowerCase();
    const keywordIndex = contentLower.indexOf(keywordLower);
    
    if (keywordIndex === -1) return "";
    
    const start = Math.max(0, keywordIndex - 100);
    const end = Math.min(content.length, keywordIndex + keyword.length + 100);
    let context = content.slice(start, end).trim();
    
    const regex = new RegExp(keyword, 'gi');
    context = context.replace(regex, `[${keyword}]`);
    
    return context;
  } catch (error) {
    logger.error(`Error extracting context for keyword "${keyword}":`, error);
    return "";
  }
}