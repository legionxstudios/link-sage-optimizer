import { logger } from "../logger.ts";

export function calculateTitleScore(keyword: string, title: string): number {
  if (!title) {
    logger.debug(`No title provided for keyword "${keyword}"`);
    return 0;
  }

  const keywordLower = keyword.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact match in title gets highest score
  if (titleLower.includes(keywordLower)) {
    logger.info(`Exact title match found for "${keyword}" in "${title}"`);
    return 1.0;
  }

  // Check for partial matches
  const keywordParts = keywordLower.split(' ');
  const matchCount = keywordParts.filter(part => 
    titleLower.includes(part)
  ).length;

  const score = (matchCount / keywordParts.length) * 0.8; // Partial matches get up to 80%
  logger.info(`Title score for "${keyword}": ${score} (${matchCount}/${keywordParts.length} parts matched) in "${title}"`);
  return score;
}