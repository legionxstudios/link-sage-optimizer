import { logger } from "./logger.ts";
import { ExistingPage } from "./types.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function findRelatedPages(themes: string[], crawledPages: ExistingPage[]): Promise<ExistingPage[]> {
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
      const relevanceScore = parseFloat(data.choices[0].message.content.trim());
      
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