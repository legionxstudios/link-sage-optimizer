import { logger } from "./logger.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function detectTheme(content: string): Promise<string[]> {
  try {
    logger.info("Starting theme detection");
    
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
            content: 'You are a content analyzer. Return ONLY a JSON array of 3-5 theme keywords, no other text or formatting.'
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
    if (!data.choices?.[0]?.message?.content) {
      logger.error('Invalid OpenAI response structure:', data);
      return [];
    }

    const responseContent = data.choices[0].message.content.trim();
    logger.info('Raw OpenAI response:', responseContent);
    
    // Clean the response content by removing any markdown formatting
    const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
    logger.info('Cleaned content:', cleanContent);
    
    let themes: string[];
    try {
      themes = JSON.parse(cleanContent);
      if (!Array.isArray(themes)) {
        logger.error('OpenAI response is not an array:', cleanContent);
        return [];
      }
    } catch (e) {
      logger.error('Error parsing themes:', e);
      logger.error('Raw content:', cleanContent);
      return [];
    }

    logger.info('Detected themes:', themes);
    return themes;
  } catch (error) {
    logger.error('Error detecting themes:', error);
    return [];
  }
}