import { SuggestionGenerator } from './modules/suggestion-generator';
import { logger } from './modules/logger';

export async function generateSuggestions(content: string, url: string) {
  try {
    logger.info('Starting suggestion generation for:', url);
    logger.info('Content length:', content.length);

    const generator = new SuggestionGenerator();
    const suggestions = await generator.generateSuggestions(content, url);

    return {
      outboundSuggestions: suggestions
    };
  } catch (error) {
    logger.error('Error in suggestion generation:', error);
    throw error;
  }
}