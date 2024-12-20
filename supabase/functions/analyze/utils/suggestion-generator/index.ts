import { logger } from "../logger.ts";
import { SuggestionGeneratorOptions, Suggestion } from "./types.ts";
import { isValidContentUrl } from "./url-filters.ts";
import { calculateRelevanceScore } from "../scoring/relevance-calculator.ts";
import { extractContext } from "./scoring.ts";

export function generateSuggestions({
  keywords,
  existingPages,
  sourceUrl
}: SuggestionGeneratorOptions): Suggestion[] {
  try {
    logger.info('Starting suggestion generation with keywords:', keywords);
    logger.info(`Working with ${existingPages.length} existing pages`);

    if (!sourceUrl) {
      logger.error('Source URL is undefined');
      throw new Error('Source URL is required for suggestion generation');
    }

    // Get the domain from the source URL
    const sourceDomain = new URL(sourceUrl).hostname;
    logger.info(`Using source domain for internal links: ${sourceDomain}`);

    const suggestions: Suggestion[] = [];
    const usedUrls = new Set<string>();
    const usedAnchorTexts = new Set<string>();

    // Process each keyword type with different relevance thresholds
    const keywordTypes = {
      exact_match: 0.3,
      broad_match: 0.25,
      related_match: 0.2
    };

    // Process each keyword type
    for (const [matchType, threshold] of Object.entries(keywordTypes)) {
      const keywordList = keywords[matchType as keyof typeof keywords] || [];
      logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

      for (const keyword of keywordList) {
        if (!keyword) {
          logger.warn('Skipping empty keyword');
          continue;
        }

        const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
        
        if (usedAnchorTexts.has(actualKeyword)) {
          logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
          continue;
        }

        // Find matching pages for this keyword
        const matchingPages = existingPages.filter(page => {
          if (!page.url || usedUrls.has(page.url)) return false;
          
          try {
            if (!isValidContentUrl(page.url, sourceDomain)) {
              return false;
            }
            
            const urlSlug = new URL(page.url).pathname.toLowerCase();
            if (urlSlug.includes(actualKeyword.replace(/\s+/g, '-'))) {
              return true;
            }
            
            return page.title?.toLowerCase().includes(actualKeyword) ||
                   page.content?.toLowerCase().includes(actualKeyword);
          } catch (error) {
            logger.error(`Error processing page URL ${page.url}:`, error);
            return false;
          }
        });

        logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);
        
        // Find the best matching page
        let bestMatch = null;
        let bestScore = 0;

        for (const page of matchingPages) {
          const score = calculateRelevanceScore(actualKeyword, page);
          if (score > bestScore && score > threshold) {
            bestScore = score;
            bestMatch = page;
          }
        }

        if (bestMatch && bestMatch.url && !usedUrls.has(bestMatch.url)) {
          suggestions.push({
            suggestedAnchorText: keyword.split('(')[0].trim(),
            targetUrl: bestMatch.url,
            targetTitle: bestMatch.title || '',
            context: extractContext(bestMatch.content || '', actualKeyword),
            matchType: matchType,
            relevanceScore: bestScore
          });
          
          usedUrls.add(bestMatch.url);
          usedAnchorTexts.add(actualKeyword);
          logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.url} (score: ${bestScore})`);
        }

        if (suggestions.length >= 20) {
          logger.info('Reached maximum suggestion count');
          break;
        }
      }
    }

    logger.info(`Generated ${suggestions.length} total suggestions`);
    return suggestions;
  } catch (error) {
    logger.error('Error in suggestion generation:', error);
    throw error;
  }
}