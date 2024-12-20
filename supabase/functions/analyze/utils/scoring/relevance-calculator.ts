import { logger } from "../logger";
import { calculateThemeScore } from "./theme-scorer";
import { calculateContentScore } from "./content-scorer";
import { calculateUrlScore } from "./url-scorer";
import { ExistingPage } from "../types";

const SCORE_WEIGHTS = {
  theme: 0.4,    // Theme relevance (40%)
  url: 0.3,      // URL relevance (30%)
  title: 0.2,    // Title relevance (20%)
  content: 0.1   // Content relevance (10%)
} as const;

export function calculateRelevanceScore(keyword: string, page: ExistingPage): number {
  let finalScore = 0;
  
  // Theme-based scoring (40%)
  const themeScore = calculateThemeScore(keyword, page.metadata?.detected_themes as string[]);
  finalScore += themeScore * SCORE_WEIGHTS.theme;
  
  // URL relevance (30%)
  const urlScore = calculateUrlScore(keyword, page.url);
  finalScore += urlScore * SCORE_WEIGHTS.url;
  
  // Title relevance (20%)
  const titleScore = page.title ? calculateContentScore(keyword, page.title) : 0;
  finalScore += titleScore * SCORE_WEIGHTS.title;
  
  // Content relevance (10%)
  const contentScore = calculateContentScore(keyword, page.content);
  finalScore += contentScore * SCORE_WEIGHTS.content;

  logger.info(`Relevance scores for "${keyword}":`, {
    theme: themeScore,
    url: urlScore,
    title: titleScore,
    content: contentScore,
    final: finalScore
  });

  return Math.min(1.0, finalScore);
}