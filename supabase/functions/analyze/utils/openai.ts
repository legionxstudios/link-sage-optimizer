import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { extractExistingLinks } from "./link-extractor.ts";
import { findExactPhraseContext } from "./context-finder.ts";
import { detectTheme } from "./theme-detector.ts";
import { findRelatedPages } from "./page-analyzer.ts";
import { extractKeywords } from "./keyword-extractor.ts";
import { isValidUrl, normalizeUrl } from "./url-validator.ts";

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]): Promise<AnalysisResult> {
  try {
    if (!Deno.env.get('OPENAI_API_KEY')) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    
    // 1. First detect the themes of the input content
    const themes = await detectTheme(content);
    logger.info('Content themes:', themes);
    
    // 2. Find related pages based on themes
    const relatedPages = await findRelatedPages(themes, existingPages);
    logger.info(`Found ${relatedPages.length} related pages`);
    
    // 3. Extract existing links to avoid duplicates
    const existingLinks = extractExistingLinks(content);
    logger.info(`Found ${existingLinks.length} existing links in content`);
    
    // 4. Extract keywords that could link to related pages
    const suggestedPhrases = await extractKeywords(content, themes);
    logger.info('Suggested anchor text phrases:', suggestedPhrases);

    // 5. Create suggestions by matching keywords with related pages
    const suggestions = [];
    const verifiedKeywords = {
      exact_match: [],
      broad_match: [],
      related_match: []
    };

    for (const phrase of suggestedPhrases) {
      // Verify phrase exists in content
      const context = findExactPhraseContext(content, phrase);
      if (!context) {
        logger.info(`Skipping phrase "${phrase}" - no exact match found`);
        continue;
      }

      // Add to verified keywords with context
      verifiedKeywords.exact_match.push(`${phrase} - ${context}`);

      // Match with related pages
      for (const page of relatedPages) {
        if (!page.url || !isValidUrl(page.url)) {
          logger.warn(`Invalid URL for page: ${page.url}`);
          continue;
        }

        const normalizedUrl = normalizeUrl(page.url);
        if (existingLinks.some(link => normalizeUrl(link.url) === normalizedUrl)) {
          logger.info(`Skipping existing link: ${normalizedUrl}`);
          continue;
        }

        suggestions.push({
          suggestedAnchorText: phrase,
          targetUrl: normalizedUrl,
          targetTitle: page.title || '',
          context,
          matchType: "theme_based",
          relevanceScore: 0.9
        });
      }
    }

    logger.info('Generated suggestions:', suggestions);
    return {
      keywords: verifiedKeywords,
      outboundSuggestions: suggestions,
      themes
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}