import { logger } from "../logger.ts";
import { SuggestionGeneratorOptions, Suggestion } from "./types.ts";
import { findMatchingPages } from "./url-matcher.ts";
import { calculateRelevanceScore } from "./scoring.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MATCH_TYPE_THRESHOLDS = {
  exact_match: 0.3,
  broad_match: 0.2,
  related_match: 0.1
};

const MAX_SUGGESTIONS = 10;

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

    const suggestions: Suggestion[] = [];
    const usedUrls = new Set<string>();
    const usedAnchorTexts = new Set<string>();

    // Process each keyword type
    for (const [matchType, threshold] of Object.entries(MATCH_TYPE_THRESHOLDS)) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;

      const keywordList = keywords[matchType as keyof typeof keywords] || [];
      logger.info(`Processing ${keywordList.length} ${matchType} keywords with threshold ${threshold}`);

      for (const keyword of keywordList) {
        if (suggestions.length >= MAX_SUGGESTIONS) break;
        if (!keyword) continue;

        const actualKeyword = keyword.split('(')[0].trim().toLowerCase();
        if (usedAnchorTexts.has(actualKeyword)) continue;

        // Find matching pages based on URL patterns
        const matchingPages = findMatchingPages(actualKeyword, existingPages, usedUrls);
        logger.info(`Found ${matchingPages.length} potential matches for "${actualKeyword}"`);

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