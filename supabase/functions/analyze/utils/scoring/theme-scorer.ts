import { logger } from "../logger.ts";

export function calculateThemeScore(keyword: string, themes: string[] | undefined): number {
  // If no themes are available, return a low base score instead of neutral
  if (!themes || themes.length === 0) {
    logger.info(`No themes available for keyword "${keyword}", returning base score`);
    return 0.2;
  }

  // Calculate how many themes contain the keyword or vice versa
  let themeMatches = 0;
  const keywordParts = keyword.toLowerCase().split(' ');

  for (const theme of themes) {
    const themeLower = theme.toLowerCase();
    const themeParts = themeLower.split(' ');
    
    // Check for exact theme match
    if (themeLower === keyword.toLowerCase()) {
      themeMatches += 2; // Double weight for exact matches
      continue;
    }
    
    // Check for partial matches
    for (const keywordPart of keywordParts) {
      for (const themePart of themeParts) {
        if (themePart.includes(keywordPart) || keywordPart.includes(themePart)) {
          themeMatches++;
          break;
        }
      }
    }
  }

  // Calculate weighted score based on theme matches
  const maxPossibleMatches = themes.length * 2; // Account for exact matches
  const themeScore = Math.min(themeMatches / maxPossibleMatches, 1);
  
  logger.info(`Theme matches for "${keyword}": ${themeMatches}/${maxPossibleMatches} (score: ${themeScore})`);
  return themeScore;
}