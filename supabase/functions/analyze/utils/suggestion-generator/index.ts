import { logger } from "../logger.ts";
import { SuggestionGeneratorOptions, Suggestion } from "./types.ts";
import { calculateRelevanceScore } from "../scoring/relevance-calculator.ts";
import { extractContext } from "./scoring.ts";
import { sortSuggestions } from "./sorting.ts";
import { SUGGESTION_LIMITS } from "./constants.ts";
import { filterMatchingPages } from "./filters.ts";
import { createSupabaseClient } from "../db.ts";

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
    logger.info(`Using source domain for internal links: ${sourceDomain}`);

    const suggestions: Suggestion[] = [];
    const usedUrls = new Set<string>();
    const usedAnchorTexts = new Set<string>();

    const supabase = createSupabaseClient();

    // Process each keyword type
    for (const [matchType, threshold] of Object.entries(SUGGESTION_LIMITS.MATCH_TYPE_THRESHOLDS)) {
      if (suggestions.length >= SUGGESTION_LIMITS.MAX_SUGGESTIONS) {
        break;
      }

      const keywordList = keywords[matchType as keyof typeof keywords] || [];
      logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

      for (const keyword of keywordList) {
        if (suggestions.length >= SUGGESTION_LIMITS.MAX_SUGGESTIONS) {
          break;
        }

        if (!keyword) {
          logger.warn('Skipping empty keyword');
          continue;
        }

        const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
        
        if (usedAnchorTexts.has(actualKeyword)) {
          logger.info(`Skipping duplicate anchor text: "${actualKeyword}"`);
          continue;
        }

        // Fetch page data from database for matching URLs
        const matchingPages = filterMatchingPages(actualKeyword, existingPages, usedUrls, sourceDomain);
        logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);

        // Find the best matching page
        let bestMatch = null;
        let bestScore = 0;

        for (const page of matchingPages) {
          if (!page.url) continue;

          // Fetch full page data from database
          const { data: pageData, error } = await supabase
            .from('pages')
            .select('url, title, content')
            .eq('url', page.url)
            .single();

          if (error) {
            logger.error(`Error fetching page data for ${page.url}:`, error);
            continue;
          }

          if (!pageData) {
            logger.warn(`No page data found for ${page.url}`);
            continue;
          }

          logger.info(`Retrieved page data for ${page.url}:`, {
            title: pageData.title,
            contentLength: pageData.content?.length || 0
          });

          const score = calculateRelevanceScore(actualKeyword, {
            url: page.url,
            title: pageData.title || '',
            content: pageData.content || ''
          });

          logger.info(`Calculated score for ${page.url}: ${score}`);

          if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = {
              url: page.url,
              title: pageData.title || '',
              content: pageData.content || ''
            };
          }
        }

        if (bestMatch && !usedUrls.has(bestMatch.url)) {
          suggestions.push({
            suggestedAnchorText: keyword.split('(')[0].trim(),
            targetUrl: bestMatch.url,
            targetTitle: bestMatch.title,
            context: extractContext(bestMatch.content, actualKeyword),
            matchType: matchType,
            relevanceScore: bestScore
          });
          
          usedUrls.add(bestMatch.url);
          usedAnchorTexts.add(actualKeyword);
          logger.info(`Added suggestion for "${actualKeyword}" -> ${bestMatch.url} (score: ${bestScore})`);
        }
      }
    }

    const sortedSuggestions = sortSuggestions(suggestions);
    logger.info(`Generated ${sortedSuggestions.length} total suggestions`);
    return sortedSuggestions.slice(0, SUGGESTION_LIMITS.MAX_SUGGESTIONS);
    
  } catch (error) {
    logger.error('Error in suggestion generation:', error);
    throw error;
  }
}