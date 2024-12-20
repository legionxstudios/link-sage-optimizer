import { logger } from "../logger.ts";
import { SuggestionGeneratorOptions, Suggestion } from "./types.ts";
import { calculateRelevanceScore } from "./scoring.ts";
import { isInternalUrl, isValidContentUrl } from "./url-validator.ts";

const MATCH_TYPE_THRESHOLDS = {
  exact_match: 0.3,
  broad_match: 0.2,
  related_match: 0.1
};

export async function generateSuggestions({
  keywords,
  existingPages,
  sourceUrl
}: SuggestionGeneratorOptions): Promise<Suggestion[]> {
  try {
    logger.info('Starting suggestion generation with keywords:', keywords);
    logger.info(`Working with ${existingPages.length} existing pages`);

    if (!sourceUrl) {
      logger.error('Source URL is undefined');
      throw new Error('Source URL is required for suggestion generation');
    }

    const sourceDomain = new URL(sourceUrl).hostname;
    logger.info(`Source domain: ${sourceDomain}`);

    const suggestions: Suggestion[] = [];
    const usedUrls = new Set<string>();
    const usedAnchorTexts = new Set<string>();

    // Process each keyword type
    for (const [matchType, threshold] of Object.entries(MATCH_TYPE_THRESHOLDS)) {
      if (suggestions.length >= 20) break;

      const keywordList = keywords[matchType as keyof typeof keywords] || [];
      logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

      for (const keyword of keywordList) {
        if (suggestions.length >= 20) break;
        if (!keyword) continue;

        const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
        if (usedAnchorTexts.has(actualKeyword)) continue;

        // Filter pages for internal URLs only
        const matchingPages = existingPages.filter(page => {
          if (!page.url || usedUrls.has(page.url)) return false;
          
          try {
            return isInternalUrl(page.url, sourceDomain) && 
                   isValidContentUrl(page.url);
          } catch (error) {
            logger.error(`Error processing URL ${page.url}:`, error);
            return false;
          }
        });

        logger.info(`Found ${matchingPages.length} potential internal matches for "${actualKeyword}"`);

        // Find the best matching page
        let bestMatch = null;
        let bestScore = 0;

        for (const page of matchingPages) {
          if (!page.url) continue;

          const score = calculateRelevanceScore(actualKeyword, page);
          if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = page;
          }
        }

        if (bestMatch && !usedUrls.has(bestMatch.url)) {
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
      }
    }

    logger.info(`Generated ${suggestions.length} total suggestions`);
    return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
  } catch (error) {
    logger.error('Error in suggestion generation:', error);
    return [];
  }
}

function extractContext(content: string, keyword: string): string {
  try {
    const keywordLower = keyword.toLowerCase();
    const contentLower = content.toLowerCase();
    const keywordIndex = contentLower.indexOf(keywordLower);
    
    if (keywordIndex === -1) return "";
    
    const start = Math.max(0, keywordIndex - 100);
    const end = Math.min(content.length, keywordIndex + keyword.length + 100);
    let context = content.slice(start, end).trim();
    
    const regex = new RegExp(keyword, 'gi');
    context = context.replace(regex, `[${keyword}]`);
    
    return context;
  } catch (error) {
    logger.error(`Error extracting context for keyword "${keyword}":`, error);
    return "";
  }
}