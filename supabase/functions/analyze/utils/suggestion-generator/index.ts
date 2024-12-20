import { logger } from "../logger.ts";
import { SuggestionGeneratorOptions, Suggestion } from "./types.ts";
import { isValidContentUrl } from "./url-filters.ts";
import { calculateRelevanceScore, extractContext } from "./scoring.ts";

export function generateSuggestions({
  keywords,
  existingPages,
  sourceUrl,
  sourceContent
}: SuggestionGeneratorOptions): Suggestion[] {
  try {
    logger.info('Starting suggestion generation with keywords:', keywords);
    logger.info(`Working with ${existingPages.length} existing pages`);

    if (!sourceUrl) {
      logger.error('Source URL is undefined');
      throw new Error('Source URL is required for suggestion generation');
    }

    if (!sourceContent) {
      logger.error('Source content is undefined');
      throw new Error('Source content is required for context extraction');
    }

    if (!isValidContentUrl(sourceUrl)) {
      logger.error('Invalid source URL provided:', sourceUrl);
      throw new Error('Invalid source URL provided');
    }

    const suggestions: Suggestion[] = [];
    const usedUrls = new Set<string>();
    const usedAnchorTexts = new Set<string>();

    // Get the domain from the source URL
    const sourceDomain = new URL(sourceUrl).hostname;
    const internalDomains = new Set([sourceDomain]);
    logger.info(`Using source domain for internal links: ${sourceDomain}`);

    // Process each keyword type with different relevance thresholds
    const keywordTypes = {
      exact_match: 0.2,
      broad_match: 0.15,
      related_match: 0.1
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

        const actualKeyword = keyword.split('(')[0].trim();
        
        if (usedAnchorTexts.has(actualKeyword.toLowerCase())) {
          logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
          continue;
        }

        // Find the context in the source content first
        const context = extractContext(sourceContent, actualKeyword);
        if (!context) {
          logger.info(`No valid context found for keyword "${actualKeyword}" in source content`);
          continue;
        }

        // Find matching pages for this keyword
        const matchingPages = existingPages.filter(page => {
          if (!page.url || usedUrls.has(page.url)) return false;
          
          try {
            if (!isValidContentUrl(page.url)) {
              return false;
            }
            
            const urlSlug = new URL(page.url).pathname.toLowerCase();
            const keywordLower = actualKeyword.toLowerCase();
            
            if (urlSlug.includes(keywordLower.replace(/\s+/g, '-'))) {
              return true;
            }
            
            return page.title?.toLowerCase().includes(keywordLower) ||
                   page.content?.toLowerCase().includes(keywordLower);
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
            suggestedAnchorText: actualKeyword,
            targetUrl: bestMatch.url,
            targetTitle: bestMatch.title || '',
            context: context,
            matchType: matchType,
            relevanceScore: bestScore
          });
          
          usedUrls.add(bestMatch.url);
          usedAnchorTexts.add(actualKeyword.toLowerCase());
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