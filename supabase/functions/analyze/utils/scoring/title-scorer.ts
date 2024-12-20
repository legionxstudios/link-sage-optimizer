import { logger } from "../logger.ts";

export function calculateTitleScore(keyword: string, title: string | undefined): number {
  if (!title) {
    return 0;
  }

  const keywordLower = keyword.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact match in title gets highest score
  if (titleLower.includes(keywordLower)) {
    logger.info(`High title relevance (0.9) for "${keyword}" in "${title}"`);
    return 0.9;
  }

  // Check for partial matches
  const keywordParts = keywordLower.split(' ');
  const matchCount = keywordParts.filter(part => 
    titleLower.includes(part)
  ).length;

  const partialScore = matchCount / keywordParts.length * 0.6;
  logger.info(`Partial title relevance (${partialScore}) for "${keyword}" in "${title}"`);
  return partialScore;
}