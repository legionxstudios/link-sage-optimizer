import { HuggingFaceAPI } from "./huggingface-api.ts";

export class ThemeAnalyzer {
  private static readonly DEFAULT_THEMES = [
    "photography", "digital photography", "film photography",
    "camera equipment", "photo editing", "photography tutorials",
    "photography business", "photography techniques"
  ];

  static async analyzeThemes(content: string): Promise<string[]> {
    try {
      console.log('Analyzing content themes...');
      const api = new HuggingFaceAPI();
      
      const result = await api.classifyText({
        inputs: content.slice(0, 2000), // Analyze larger content chunk
        parameters: {
          candidate_labels: ThemeAnalyzer.DEFAULT_THEMES
        }
      });

      if (!result.labels || !result.scores) {
        console.warn('Invalid theme analysis response, using defaults');
        return ThemeAnalyzer.DEFAULT_THEMES.slice(0, 3);
      }

      const relevantThemes = result.labels
        .filter((_, i) => result.scores[i] > 0.3)
        .slice(0, 5); // Get top 5 relevant themes

      console.log('Detected themes:', relevantThemes);
      return relevantThemes;
    } catch (error) {
      console.error('Error analyzing themes:', error);
      return ThemeAnalyzer.DEFAULT_THEMES.slice(0, 3);
    }
  }
}