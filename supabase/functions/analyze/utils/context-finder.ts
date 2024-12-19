import { logger } from "./logger.ts";

export function findExactPhraseContext(content: string, phrase: string): string {
  try {
    const pattern = new RegExp(`\\b${phrase}\\b`, 'i');
    const match = pattern.exec(content);
    
    if (!match) {
      logger.info(`No exact match found for phrase: ${phrase}`);
      return '';
    }

    const exactPhrase = content.slice(match.index, match.index + phrase.length);
    const contextStart = Math.max(0, match.index - 100);
    const contextEnd = Math.min(content.length, match.index + phrase.length + 100);
    let context = content.slice(contextStart, contextEnd).trim();
    
    context = context.replace(exactPhrase, `[${exactPhrase}]`);
    
    logger.info(`Found exact match for "${phrase}": ${context}`);
    return context;
  } catch (error) {
    logger.error(`Error finding context for phrase: ${phrase}`, error);
    return '';
  }
}