import { logger } from "./logger.ts";
import { findExactPhraseContext } from "./context-finder.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function extractKeywords(content: string, themes: string[]): Promise<string[]> {
  try {
    logger.info('Extracting keywords based on themes:', themes);
    
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
                     Return ONLY phrases that exist VERBATIM in the content as a JSON array of strings.
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
    const responseContent = data.choices[0].message.content.trim();
    
    // Clean the response content by removing any markdown formatting
    const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
    
    let phrases: string[];
    try {
      phrases = JSON.parse(cleanContent);
      if (!Array.isArray(phrases)) {
        logger.error('OpenAI response is not an array:', cleanContent);
        throw new Error('Phrases must be an array');
      }
    } catch (e) {
      logger.error('Error parsing phrases:', e);
      logger.error('Raw content:', cleanContent);
      return [];
    }

    // Verify each phrase exists in content
    const verifiedPhrases = [];
    for (const phrase of phrases) {
      const context = findExactPhraseContext(content, phrase);
      if (context) {
        verifiedPhrases.push(phrase);
        logger.info(`Verified phrase: "${phrase}" with context: ${context}`);
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