import { logger } from "./logger.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function analyzeWithOpenAI(content: string) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Analyzing content with OpenAI...');
    
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
            content: 'You are an SEO expert. Extract keywords and suggest relevant internal linking opportunities. Return a clean JSON object with keywords categorized into arrays (exact_match, broad_match, related_match) and outboundSuggestions array with specific target URLs.'
          },
          {
            role: 'user',
            content: `Analyze this content and return a JSON object with keywords and linking suggestions. Include specific target URLs for each suggestion:\n\n${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
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

    // Parse the response, ensuring it's clean JSON
    const parsedResponse = JSON.parse(data.choices[0].message.content);
    logger.info('Successfully parsed OpenAI response:', parsedResponse);

    return {
      keywords: {
        exact_match: parsedResponse.keywords?.exact_match || [],
        broad_match: parsedResponse.keywords?.broad_match || [],
        related_match: parsedResponse.keywords?.related_match || []
      },
      outboundSuggestions: parsedResponse.outboundSuggestions || []
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}