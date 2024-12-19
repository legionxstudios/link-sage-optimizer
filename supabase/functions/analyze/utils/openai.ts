import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { extractExistingLinks } from "./link-extractor.ts";
import { findExactPhraseContext } from "./context-finder.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

async function detectTheme(content: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content analyzer. Detect the main themes of the content. Return ONLY a JSON array of 3-5 theme keywords.'
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let themes: string[];
    
    try {
      // Handle both direct array responses and string responses that need parsing
      const content = data.choices[0].message.content;
      themes = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (!Array.isArray(themes)) {
        throw new Error('Themes must be an array');
      }
    } catch (e) {
      logger.error('Error parsing themes:', e);
      themes = [];
    }

    logger.info('Detected themes:', themes);
    return themes;
  } catch (error) {
    logger.error('Error detecting themes:', error);
    return [];
  }
}

async function findRelatedPages(themes: string[], crawledPages: ExistingPage[]): Promise<ExistingPage[]> {
  const relatedPages = [];
  
  for (const page of crawledPages) {
    if (!page.content) continue;
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are analyzing content relevance. The main themes are: ${themes.join(', ')}. 
                       Return ONLY a number between 0 and 1 indicating relevance.`
            },
            {
              role: 'user',
              content: page.content
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const relevanceScore = parseFloat(data.choices[0].message.content);
      
      if (relevanceScore > 0.7) {
        relatedPages.push(page);
      }
    } catch (error) {
      logger.error(`Error analyzing page ${page.url}:`, error);
    }
  }

  logger.info(`Found ${relatedPages.length} related pages`);
  return relatedPages;
}

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]): Promise<AnalysisResult> {
  try {
    if (!OPENAI_API_KEY) {
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
    
    // 4. Find keywords in content that could link to related pages
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert. Extract ONLY 2-3 word phrases that exist EXACTLY in the content and could be used as anchor text for internal linking.
                     The content themes are: ${themes.join(', ')}.
                     Return a JSON array of strings.
                     Rules:
                     1. ONLY return phrases that exist VERBATIM in the content
                     2. Each phrase must be 2-3 words
                     3. Phrases should be relevant to the themes`
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let suggestedPhrases: string[];
    
    try {
      const content = data.choices[0].message.content;
      suggestedPhrases = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (!Array.isArray(suggestedPhrases)) {
        throw new Error('Suggested phrases must be an array');
      }
    } catch (e) {
      logger.error('Error parsing suggested phrases:', e);
      suggestedPhrases = [];
    }

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

      // Add to verified keywords
      verifiedKeywords.exact_match.push(`${phrase} - ${context}`);

      // Match with related pages
      for (const page of relatedPages) {
        if (!page.url || existingLinks.some(link => link.url === page.url)) {
          continue;
        }

        suggestions.push({
          suggestedAnchorText: phrase,
          targetUrl: page.url,
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