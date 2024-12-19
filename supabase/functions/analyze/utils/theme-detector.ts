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
    const content = data.choices[0].message.content.trim();
    
    // Remove any markdown formatting or extra text
    const cleanContent = content.replace(/```json\n|\n```|```/g, '').trim();
    
    let themes: string[];
    try {
      themes = JSON.parse(cleanContent);
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