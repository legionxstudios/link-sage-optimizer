import { logger } from "./logger.ts";
import { findExactPhraseContext } from "./context-finder.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function extractKeywords(content: string, themes: string[]): Promise<string[]> {
  try {
    logger.info('Extracting keywords based on themes:', themes);
    logger.debug('Content sample:', content.substring(0, 200));
    
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
            content: `You are an SEO expert analyzing content about: ${themes.join(', ')}. 
                     Extract ONLY 2-3 word phrases that exist EXACTLY in the content.
                     Rules:
                     1. Each phrase must be 2-3 words long
                     2. Phrases must exist VERBATIM in the content
                     3. Focus on key topics and themes
                     4. Return as a JSON array of strings
                     5. Do not include single words or phrases longer than 3 words
                     6. Do not include URLs or navigation text`
          },
          {
            role: 'user',
            content: `Extract ONLY 2-3 word phrases that appear EXACTLY in this content:\n\n${content}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      logger.error('Invalid OpenAI response structure:', data);
      return [];
    }

    const responseContent = data.choices[0].message.content.trim();
    logger.info('Raw OpenAI response:', responseContent);
    
    // Clean the response content
    const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
    logger.info('Cleaned content:', cleanContent);
    
    let phrases: string[];
    try {
      phrases = JSON.parse(cleanContent);
      if (!Array.isArray(phrases)) {
        logger.error('OpenAI response is not an array:', cleanContent);
        return [];
      }
    } catch (e) {
      logger.error('Error parsing phrases:', e);
      logger.error('Raw content:', cleanContent);
      return [];
    }

    // Verify each phrase exists in content
    const verifiedPhrases = [];
    const contentLower = content.toLowerCase();
    
    for (const phrase of phrases) {
      if (typeof phrase !== 'string') {
        logger.warn('Invalid phrase type:', typeof phrase);
        continue;
      }
      
      const phraseLower = phrase.toLowerCase();
      // Check if phrase exists with word boundaries
      if (new RegExp(`\\b${phraseLower}\\b`).test(contentLower)) {
        const context = findExactPhraseContext(content, phrase);
        if (context) {
          verifiedPhrases.push(phrase);
          logger.info(`Verified phrase: "${phrase}" with context: ${context}`);
        }
      } else {
        logger.warn(`Phrase not found in content: ${phrase}`);
      }
    }

    logger.info('Extracted verified phrases:', verifiedPhrases);
    return verifiedPhrases;
  } catch (error) {
    logger.error('Error extracting keywords:', error);
    return [];
  }
}