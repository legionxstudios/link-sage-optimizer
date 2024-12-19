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

    // 3. First get keywords to use for suggestions
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
            - exact_match: Phrases that appear exactly in the content (2-3 words only)
            - broad_match: Related phrases that share keywords
            - related_match: Thematically related phrases
            Return ONLY a JSON object with these three arrays, no markdown formatting or additional text.
            IMPORTANT: For exact_match, only include phrases that exist VERBATIM in the content.`
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
    logger.info('Raw OpenAI keywords response:', keywordsData);

    let keywords = {
      exact_match: [],
      broad_match: [],
      related_match: []
    };

    try {
      const responseContent = keywordsData.choices[0].message.content.trim();
      const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
      logger.info('Cleaned keywords content:', cleanContent);
      
      keywords = JSON.parse(cleanContent);
      logger.info('Parsed keywords:', keywords);
    } catch (e) {
      logger.error('Error parsing OpenAI keywords:', e);
      logger.error('Raw content:', keywordsData.choices[0].message.content);
    }

    // 4. Generate link suggestions using the extracted exact match keywords
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
            Use ONLY the provided exact match keywords as anchor text for suggestions.
            For each existing page provided, determine if it would make a good link target based on relevance.
            Consider semantic relevance between the keyword and the target page content.
            Return ONLY a JSON array of suggestions, with no markdown formatting or additional text.
            Each suggestion must have:
            - suggestedAnchorText: MUST be one of the provided exact match keywords
            - targetUrl: URL of the target page
            - context: Brief description of why this link is relevant
            - relevanceScore: 0-1 score based on semantic relevance
            - matchType: "keyword_based" for suggestions using exact match keywords`
          },
          {
            role: 'user',
            content: `Content to analyze: ${content}\n\nExact match keywords: ${JSON.stringify(keywords.exact_match)}\n\nAvailable pages to link to:\n${
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
    logger.info('Raw OpenAI suggestions response:', suggestionsData);

    let suggestions = [];
    try {
      const responseContent = suggestionsData.choices[0].message.content.trim();
      const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
      logger.info('Cleaned suggestions content:', cleanContent);
      
      suggestions = JSON.parse(cleanContent);
      logger.info(`Parsed ${suggestions.length} suggestions from OpenAI`);
    } catch (e) {
      logger.error('Error parsing OpenAI suggestions:', e);
      logger.error('Raw content:', suggestionsData.choices[0].message.content);
    }

    // 5. Validate and format suggestions
    const validatedSuggestions = suggestions
      .filter(suggestion => {
        // Verify the suggested anchor text is from our exact match keywords
        if (!keywords.exact_match.includes(suggestion.suggestedAnchorText)) {
          logger.warn(`Suggestion skipped - anchor text not in exact matches: ${suggestion.suggestedAnchorText}`);
          return false;
        }
        
        if (!suggestion.targetUrl || !isValidUrl(suggestion.targetUrl)) {
          logger.warn(`Invalid URL in suggestion: ${suggestion.targetUrl}`);
          return false;
        }
        return true;
      })
      .map(suggestion => ({
        ...suggestion,
        targetUrl: normalizeUrl(suggestion.targetUrl),
        matchType: "keyword_based",
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