import { logger } from "../logger.ts";

export function extractContext(content: string, keyword: string): string {
  try {
    if (!content || !keyword) return "";
    
    const keywordLower = keyword.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Find keyword with word boundaries
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
    const match = contentLower.match(regex);
    
    if (!match) return "";
    
    const keywordIndex = match.index!;
    const contextStart = Math.max(0, keywordIndex - 100);
    const contextEnd = Math.min(content.length, keywordIndex + keyword.length + 100);
    
    // Get the surrounding context
    let context = content.slice(contextStart, contextEnd).trim();
    
    // Highlight the keyword while preserving its case
    const originalKeyword = content.slice(
      keywordIndex,
      keywordIndex + keyword.length
    );
    context = context.replace(originalKeyword, `[${originalKeyword}]`);
    
    // Clean up the context
    context = context
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
    
    return context;
    
  } catch (error) {
    logger.error(`Error extracting context for keyword "${keyword}":`, error);
    return "";
  }
}