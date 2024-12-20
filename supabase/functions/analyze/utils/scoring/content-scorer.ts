import { logger } from "../logger.ts";

export function calculateContentScore(keyword: string, content: string | undefined): number {
  if (!content) {
    return 0;
  }

  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();

  // Check for exact phrase matches with word boundaries
  const exactRegex = new RegExp(`\\b${keywordLower}\\b`, 'g');
  const exactMatches = (contentLower.match(exactRegex) || []).length;
  
  // Calculate density score (matches per 1000 words)
  const wordCount = content.split(/\s+/).length;
  const density = (exactMatches * 1000) / wordCount;
  
  // Normalize density to a 0-1 score
  // Ideal density is 0.5-2%, so scale accordingly
  const densityScore = Math.min(density / 20, 1);
  
  // Check keyword prominence (appears in first 25% of content)
  const firstQuarter = contentLower.slice(0, Math.floor(content.length * 0.25));
  const isProminent = firstQuarter.includes(keywordLower);
  
  // Calculate final content score with higher weight for exact matches
  const finalScore = (densityScore * 0.8) + (isProminent ? 0.2 : 0);

  logger.info(`Content score for "${keyword}":`, {
    exactMatches,
    density: `${(density).toFixed(2)}%`,
    densityScore,
    isProminent,
    finalScore
  });
  
  return finalScore;
}