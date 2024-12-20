import { ExistingPage } from "../types.ts";
import { logger } from "../logger.ts";
import { isValidContentUrl } from "./url-filters.ts";

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  try {
    let score = 0;
    const keywordLower = keyword.toLowerCase();
    
    if (!page.url || !isValidContentUrl(page.url)) return 0;
    
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

export function extractContext(content: string, keyword: string, contextLength: number = 100): string {
  try {
    if (!content || !keyword) {
      logger.warn('Missing content or keyword for context extraction');
      return "";
    }

    // Create pattern with word boundaries to find exact matches
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    const match = pattern.exec(content);
    
    if (!match) {
      logger.info(`No exact match found for keyword "${keyword}" in content`);
      return "";
    }

    const matchStart = match.index;
    const matchEnd = matchStart + keyword.length;
    
    // Get surrounding context
    const contextStart = Math.max(0, matchStart - contextLength);
    const contextEnd = Math.min(content.length, matchEnd + contextLength);
    
    // Extract the context and the exact matched text
    const exactMatch = content.slice(matchStart, matchEnd);
    let context = content.slice(contextStart, contextEnd).trim();
    
    // Replace the exact match with a highlighted version
    context = context.replace(exactMatch, `[${exactMatch}]`);
    
    // Clean up the context
    context = context
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n+/g, ' ')  // Replace newlines with spaces
      .trim();
    
    logger.info(`Extracted context for "${keyword}": ${context}`);
    return context;
    
  } catch (error) {
    logger.error(`Error extracting context for keyword "${keyword}":`, error);
    return "";
  }
}