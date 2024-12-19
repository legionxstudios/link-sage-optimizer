import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { isValidWebpageUrl } from "./url-validator.ts";

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]): Promise<AnalysisResult> {
  try {
    if (!Deno.env.get('OPENAI_API_KEY')) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    logger.info(`Analyzing content with ${existingPages.length} existing pages`);
    
    // First get keywords
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

    // Filter existing pages to only include valid HTML pages (no images)
    const validPages = existingPages.filter(page => {
      if (!page.url || !isValidWebpageUrl(page.url)) {
        return false;
      }
      // Don't include the current page
      if (page.url === content.url) {
        return false;
      }
      return true;
    });

    logger.info(`Found ${validPages.length} valid HTML pages for linking`);

    // Generate link suggestions using the extracted exact match keywords
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
            Rules:
            1. ONLY use the provided exact match keywords as anchor text
            2. ONLY suggest internal HTML pages (no images or external links)
            3. Each suggestion must use a keyword that appears EXACTLY in the source content
            4. Do not suggest linking back to the same page
            5. Verify semantic relevance between keyword and target page
            
            Return ONLY a JSON array of suggestions with:
            - suggestedAnchorText: one of the provided exact match keywords
            - targetUrl: URL of an internal HTML page
            - context: Brief description of relevance
            - relevanceScore: 0-1 score based on semantic relevance
            - matchType: "keyword_based" for suggestions using exact match keywords`
          },
          {
            role: 'user',
            content: `Content to analyze: ${content}\n\nExact match keywords: ${JSON.stringify(keywords.exact_match)}\n\nAvailable pages to link to:\n${
              validPages.map(page => `URL: ${page.url}\nTitle: ${page.title}\nContent: ${page.content?.substring(0, 500)}...\n---`).join('\n')
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

    // Additional validation of suggestions
    const validatedSuggestions = suggestions
      .filter(suggestion => {
        // Verify the suggested anchor text is from our exact match keywords
        if (!keywords.exact_match.includes(suggestion.suggestedAnchorText)) {
          logger.warn(`Suggestion skipped - anchor text not in exact matches: ${suggestion.suggestedAnchorText}`);
          return false;
        }
        
        // Verify it's a valid webpage URL
        if (!suggestion.targetUrl || !isValidWebpageUrl(suggestion.targetUrl)) {
          logger.warn(`Invalid URL in suggestion: ${suggestion.targetUrl}`);
          return false;
        }

        // Verify it's not linking to the same page
        if (suggestion.targetUrl === content.url) {
          logger.warn(`Skipping self-referential link: ${suggestion.targetUrl}`);
          return false;
        }

        return true;
      })
      .map(suggestion => ({
        ...suggestion,
        matchType: "keyword_based",
        relevanceScore: suggestion.relevanceScore || 0.5
      }));

    logger.info(`Final validated suggestions: ${validatedSuggestions.length}`);
    
    return {
      keywords,
      outboundSuggestions: validatedSuggestions
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}