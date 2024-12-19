import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { extractExistingLinks } from "./link-extractor.ts";
import { findExactPhraseContext } from "./context-finder.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]): Promise<AnalysisResult> {
  try {
    if (!OPENAI_API_KEY) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    
    const existingLinks = extractExistingLinks(content);
    logger.info(`Found ${existingLinks.length} existing links in content`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: crawledPages, error: pagesError } = await supabase
      .from('pages')
      .select('url, title, content');
      
    if (pagesError) {
      logger.error('Error fetching crawled pages:', pagesError);
      throw new Error('Failed to fetch crawled pages');
    }

    logger.info(`Found ${crawledPages?.length || 0} crawled pages in database`);

    const truncatedContent = content.substring(0, 3000);
    
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
            content: `You are an SEO expert. Extract ONLY phrases that exist EXACTLY in the content.
            Rules:
            1. ONLY return phrases that exist VERBATIM in the content with word boundaries
            2. Each phrase must be 2-3 words long
            3. Do not modify or paraphrase any phrases
            4. Verify each phrase appears exactly as written
            5. Do not include single words or phrases longer than 3 words`
          },
          {
            role: 'user',
            content: `Extract ONLY 2-3 word phrases that appear EXACTLY in this content:\n\n${truncatedContent}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.debug('OpenAI raw response:', data);

    if (!data.choices?.[0]?.message?.content) {
      logger.error('Invalid OpenAI response format:', data);
      throw new Error('Invalid OpenAI response format');
    }

    const suggestedPhrases = data.choices[0].message.content
      .split('\n')
      .map(line => line.trim())
      .filter(phrase => phrase.length > 0);

    logger.info('Suggested phrases:', suggestedPhrases);

    const verifiedSuggestions = [];
    const keywords = {
      exact_match: [],
      broad_match: [],
      related_match: []
    };

    for (const phrase of suggestedPhrases) {
      const context = findExactPhraseContext(content, phrase);
      if (!context) {
        logger.info(`Skipping phrase "${phrase}" - no exact match found`);
        continue;
      }

      if (context.includes(`[${phrase}]`)) {
        keywords.exact_match.push(`${phrase} - ${context}`);
      }

      const relevantPages = crawledPages?.filter(page => 
        page.content?.toLowerCase().includes(phrase.toLowerCase()) ||
        page.title?.toLowerCase().includes(phrase.toLowerCase())
      ) || [];

      for (const page of relevantPages) {
        if (!page.url || existingLinks.some(link => link.url === page.url)) {
          continue;
        }

        const pageContext = findExactPhraseContext(page.content || '', phrase);
        if (!pageContext) continue;

        verifiedSuggestions.push({
          suggestedAnchorText: phrase,
          targetUrl: page.url,
          targetTitle: page.title || '',
          context,
          matchType: "keyword_based",
          relevanceScore: 0.8
        });
      }
    }

    logger.info('Generated suggestions:', verifiedSuggestions);

    return {
      keywords,
      outboundSuggestions: verifiedSuggestions
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}