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
    
    // Filter for blog content pages only
    const blogPages = existingPages.filter(page => {
      // Check if URL contains /blog/ and isn't the current page
      return page.url.includes('/blog/') && 
             // Exclude common non-content paths
             !page.url.includes('/cart') &&
             !page.url.includes('/checkout') &&
             !page.url.includes('/my-account') &&
             !page.url.includes('/wp-content') &&
             // Ensure we have a title and content
             page.title &&
             page.content;
    });

    logger.info(`Found ${blogPages.length} relevant blog pages for linking`);
    logger.debug('Blog pages:', blogPages.map(p => ({ url: p.url, title: p.title })));

    // First get keywords from the content
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

    // Generate semantically relevant link suggestions
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
            1. For each target page, identify its main topic/theme from its title
            2. Find keywords from the source content that BEST DESCRIBE the target page's topic
            3. Only use keywords that appear EXACTLY in the source content
            4. The anchor text should semantically match the target page's topic
            5. Do not suggest linking back to the same page
            6. Ensure strong topical relevance between source content and target page
            
            Example:
            If target page is about "vintage photography guide", use anchor text like "vintage photography tips" that appears in source content, NOT product names like "Polaroid SX-70".
            
            Return ONLY a JSON array of suggestions with:
            - suggestedAnchorText: keyword from source that best describes target page's topic
            - targetUrl: URL of target page
            - context: Brief explanation of topical relevance
            - relevanceScore: 0-1 score based on semantic relevance
            - matchType: "keyword_based"`
          },
          {
            role: 'user',
            content: `Source content: ${content}\n\nAvailable keywords: ${JSON.stringify(keywords.exact_match)}\n\nTarget pages:\n${
              blogPages.map(page => `URL: ${page.url}\nTitle: ${page.title}\nContent: ${page.content?.substring(0, 500)}...\n---`).join('\n')
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
      logger.debug('Cleaned suggestions content:', cleanContent);
      
      suggestions = JSON.parse(cleanContent);
      logger.info(`Parsed ${suggestions.length} suggestions from OpenAI`);
      logger.debug('Raw suggestions:', suggestions);
    } catch (e) {
      logger.error('Error parsing OpenAI suggestions:', e);
      logger.error('Raw content:', suggestionsData.choices[0].message.content);
    }

    // Validate suggestions
    const validatedSuggestions = suggestions
      .filter(suggestion => {
        // Verify the suggested anchor text exists in our keywords
        if (!keywords.exact_match.includes(suggestion.suggestedAnchorText)) {
          logger.warn(`Suggestion skipped - anchor text not in exact matches: ${suggestion.suggestedAnchorText}`);
          return false;
        }
        
        // Verify target URL is a blog post
        if (!suggestion.targetUrl?.includes('/blog/')) {
          logger.warn(`Invalid URL in suggestion (not a blog post): ${suggestion.targetUrl}`);
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
    logger.debug('Validated suggestions:', validatedSuggestions);
    
    return {
      keywords,
      outboundSuggestions: validatedSuggestions
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}