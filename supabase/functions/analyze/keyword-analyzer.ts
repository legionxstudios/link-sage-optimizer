import { logger } from "./utils/logger.ts";

const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export const analyzeKeywords = async (content: string): Promise<{
  exact_match: string[];
  broad_match: string[];
  related_match: string[];
}> => {
  try {
    logger.info('Starting keyword analysis...');
    logger.debug('Content length:', content.length);
    logger.debug('Content sample:', content.substring(0, 500));
    
    if (!OPENAI_API_KEY) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }
    
    try {
      logger.info('Attempting OpenAI keyword extraction...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an SEO expert. Extract ONLY keywords and phrases that EXACTLY appear in the content.
              Rules:
              1. ONLY return phrases that exist VERBATIM in the content
              2. Each phrase must be 2-3 words long
              3. Do not modify or paraphrase the phrases
              4. Verify each phrase appears exactly as written
              5. Do not include single words or phrases longer than 3 words`
            },
            {
              role: 'user',
              content: `Extract ONLY 2-3 word phrases that appear EXACTLY in this content. Return ONLY phrases that exist VERBATIM in the text:\n\n${content.substring(0, 2000)}`
            }
          ],
          temperature: 0.3
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('OpenAI response:', data);

      if (!data.choices?.[0]?.message?.content) {
        logger.error('Invalid OpenAI response format:', data);
        throw new Error('Invalid OpenAI response format');
      }

      const parsedKeywords = JSON.parse(data.choices[0].message.content);
      logger.info('Successfully extracted keywords from OpenAI:', parsedKeywords);

      // Verify each phrase exists in content
      const verifyPhrase = (phrase: string): boolean => {
        const pattern = new RegExp(`\\b${phrase.toLowerCase()}\\b`);
        return pattern.test(content.toLowerCase());
      };

      // Filter and categorize verified phrases
      const verifiedPhrases = {
        exact_match: (parsedKeywords.exact_match || [])
          .filter((phrase: string) => verifyPhrase(phrase))
          .slice(0, 10),
        broad_match: (parsedKeywords.broad_match || [])
          .filter((phrase: string) => verifyPhrase(phrase))
          .slice(0, 10),
        related_match: (parsedKeywords.related_match || [])
          .filter((phrase: string) => verifyPhrase(phrase))
          .slice(0, 10)
      };

      logger.info('Verified phrases:', verifiedPhrases);
      return verifiedPhrases;

    } catch (openAIError) {
      logger.error('OpenAI keyword extraction failed:', openAIError);
      return {
        exact_match: [],
        broad_match: [],
        related_match: []
      };
    }
  } catch (error) {
    logger.error('All keyword analysis methods failed:', error);
    return {
      exact_match: [],
      broad_match: [],
      related_match: []
    };
  }
};