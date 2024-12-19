import { ExistingPage } from "./types";
import { logger } from "./logger";
import { findBestMatchingPage } from "./url-validator";

export function generateSuggestions(
  keywords: { [key: string]: string[] },
  existingPages: ExistingPage[]
) {
  logger.info('Generating suggestions from keywords:', keywords);
  logger.info(`Working with ${existingPages.length} existing pages`);

  const suggestions = [];
  const usedUrls = new Set<string>();

  // Process each keyword type
  for (const [matchType, keywordList] of Object.entries(keywords)) {
    logger.info(`Processing ${keywordList.length} ${matchType} keywords`);

    for (const keyword of keywordList) {
      // Find best matching page for this keyword
      const matchingPage = findBestMatchingPage(keyword, existingPages, usedUrls);
      
      if (matchingPage) {
        suggestions.push({
          suggestedAnchorText: keyword,
          targetUrl: matchingPage.url,
          targetTitle: matchingPage.title || '',
          context: `The source content contains "${keyword}" which is relevant to the target page about ${matchingPage.title}`,
          matchType: "keyword_based",
          relevanceScore: 0.8
        });
        
        // Track used URL to avoid duplicates
        usedUrls.add(matchingPage.url);
        
        logger.info(`Added suggestion: ${keyword} -> ${matchingPage.url}`);
      }
    }
  }

  logger.info(`Generated ${suggestions.length} total suggestions`);
  return suggestions;
}