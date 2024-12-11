import { HuggingFaceAPI } from './huggingface-api';
import { logger } from './logger';

export class ThemeAnalyzer {
  private static readonly DEFAULT_THEMES = [
    "photography", "digital photography", "film photography",
    "camera equipment", "photo editing", "photography tutorials",
    "photography business", "photography techniques"
  ];

  static async analyzeThemes(content: string): Promise<string[]> {
    try {
      logger.info('Analyzing content themes...');
      const api = new HuggingFaceAPI();
      
      const result = await api.classifyText({
        inputs: content.slice(0, 2000), // Analyze larger content chunk
        parameters: {
          candidate_labels: ThemeAnalyzer.DEFAULT_THEMES
        }
      });

      if (!result.labels || !result.scores) {
        logger.warn('Invalid theme analysis response, using defaults');
        return ThemeAnalyzer.DEFAULT_THEMES.slice(0, 3);
      }

      const relevantThemes = result.labels
        .filter((_, i) => result.scores[i] > 0.3)
        .slice(0, 5); // Get top 5 relevant themes

      logger.info('Detected themes:', relevantThemes);
      return relevantThemes;
    } catch (error) {
      logger.error('Error analyzing themes:', error);
      return ThemeAnalyzer.DEFAULT_THEMES.slice(0, 3);
    }
  }
}