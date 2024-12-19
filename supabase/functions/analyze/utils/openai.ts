import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { extractExistingLinks } from "./link-extractor.ts";
import { findExactPhraseContext } from "./context-finder.ts";
import { detectTheme } from "./theme-detector.ts";
import { findRelatedPages } from "./page-analyzer.ts";
import { isValidUrl, normalizeUrl } from "./url-validator.ts";

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]): Promise<AnalysisResult> {
  try {
    if (!Deno.env.get('OPENAI_API_KEY')) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    logger.info(`Analyzing content with ${existingPages.length} existing pages`);
    
    // 1. First detect the themes of the input content
    const themes = await detectTheme(content);
    logger.info('Content themes:', themes);
    
    // 2. Extract existing links to avoid duplicates
    const existingLinks = extractExistingLinks(content);
    logger.info(`Found ${existingLinks.length} existing links in content`);

    // 3. Generate link suggestions using OpenAI
    const suggestionsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert analyzing content and suggesting internal links. 
            For each existing page provided, determine if it would make a good link target based on relevance.
            Consider semantic relevance, not just keyword matches.
            Return suggestions as JSON array with fields: suggestedAnchorText, targetUrl, context, relevanceScore (0-1).`
          },
          {
            role: 'user',
            content: `Content to analyze: ${content}\n\nAvailable pages to link to:\n${
              existingPages.map(page => `URL: ${page.url}\nTitle: ${page.title}\nContent: ${page.content?.substring(0, 500)}...\n---`).join('\n')
            }`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!suggestionsResponse.ok) {
      throw new Error(`OpenAI API error: ${suggestionsResponse.status}`);
    }

    const suggestionsData = await suggestionsResponse.json();
    logger.info('Raw OpenAI suggestions:', suggestionsData);

    let suggestions = [];
    try {
      suggestions = JSON.parse(suggestionsData.choices[0].message.content);
      logger.info(`Parsed ${suggestions.length} suggestions from OpenAI`);
    } catch (e) {
      logger.error('Error parsing OpenAI suggestions:', e);
    }

    // 4. Extract keywords that could link to related pages
    const keywordsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract keywords and phrases from the content in these categories:
            - exact_match: Phrases that appear exactly in the content
            - broad_match: Related phrases that share keywords
            - related_match: Thematically related phrases
            Return as JSON with these three arrays.`
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!keywordsResponse.ok) {
      throw new Error(`OpenAI API error: ${keywordsResponse.status}`);
    }

    const keywordsData = await keywordsResponse.json();
    logger.info('Raw OpenAI keywords:', keywordsData);

    let keywords = {
      exact_match: [],
      broad_match: [],
      related_match: []
    };

    try {
      keywords = JSON.parse(keywordsData.choices[0].message.content);
      logger.info('Parsed keywords:', keywords);
    } catch (e) {
      logger.error('Error parsing OpenAI keywords:', e);
    }

    // 5. Validate and format suggestions
    const validatedSuggestions = suggestions
      .filter(suggestion => {
        if (!suggestion.targetUrl || !isValidUrl(suggestion.targetUrl)) {
          logger.warn(`Invalid URL in suggestion: ${suggestion.targetUrl}`);
          return false;
        }
        return true;
      })
      .map(suggestion => ({
        ...suggestion,
        targetUrl: normalizeUrl(suggestion.targetUrl),
        matchType: "theme_based",
        relevanceScore: suggestion.relevanceScore || 0.5
      }));

    logger.info(`Final validated suggestions: ${validatedSuggestions.length}`);
    
    return {
      keywords,
      outboundSuggestions: validatedSuggestions,
      themes
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}