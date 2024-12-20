import { logger } from "../logger.ts";

export function validateContent(content: string | undefined | null): string {
  if (!content) {
    logger.error("No source content provided for validation");
    throw new Error("Source content is required for context extraction");
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    logger.error("Empty content provided for validation");
    throw new Error("Source content cannot be empty");
  }

  return trimmedContent;
}

export function extractContext(content: string, keyword: string, contextLength: number = 100): string {
  try {
    const validContent = validateContent(content);
    
    // Create pattern with word boundaries to find exact matches
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    const match = pattern.exec(validContent);
    
    if (!match) {
      logger.info(`No exact match found for keyword "${keyword}" in content`);
      return "";
    }

    const matchStart = match.index;
    const matchEnd = matchStart + keyword.length;
    
    // Get surrounding context
    const contextStart = Math.max(0, matchStart - contextLength);
    const contextEnd = Math.min(validContent.length, matchEnd + contextLength);
    
    // Extract the context and the exact matched text
    const exactMatch = validContent.slice(matchStart, matchEnd);
    let context = validContent.slice(contextStart, contextEnd).trim();
    
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
    throw error;
  }
}