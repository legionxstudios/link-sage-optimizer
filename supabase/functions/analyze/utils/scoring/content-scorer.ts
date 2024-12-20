import { logger } from "../logger.ts";

export function calculateContentScore(keyword: string, content: string | undefined): number {
  if (!content) {
    return 0;
  }

  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();

  // Check for exact phrase frequency
  const exactMatches = (contentLower.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
  
  // Check for partial matches (individual words)
  const keywordParts = keywordLower.split(' ');
  let partialMatches = 0;
  
  keywordParts.forEach(part => {
    const partMatches = (contentLower.match(new RegExp(`\\b${part}\\b`, 'g')) || []).length;
    partialMatches += partMatches;
  });

  // Calculate normalized scores
  const exactScore = Math.min(exactMatches / 5, 1); // Cap at 5 exact matches
  const partialScore = Math.min(partialMatches / (10 * keywordParts.length), 1); // Cap at 10 matches per word

  // Combine scores with weights
  const finalScore = (exactScore * 0.7) + (partialScore * 0.3);
  
  logger.info(`Content score for "${keyword}": ${finalScore} (exact: ${exactMatches}, partial: ${partialMatches})`);
  return finalScore;
}