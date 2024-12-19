import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { generateSuggestions } from "./suggestion-generator.ts";

export async function analyzeWithOpenAI(
  content: string, 
  existingPages: ExistingPage[]
): Promise<AnalysisResult> {
  try {
    if (!Deno.env.get('OPENAI_API_KEY')) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    logger.info(`Analyzing content with ${existingPages.length} existing pages`);

    // Extract keywords using OpenAI
    const keywords = await extractKeywords(content);
    logger.info('Extracted keywords:', keywords);

    // Generate link suggestions based on keywords and existing pages
    const suggestions = generateSuggestions(keywords, existingPages);
    logger.info(`Generated ${suggestions.length} suggestions`);
    
    return {
      keywords,
      outboundSuggestions: suggestions
    };

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}

async function extractKeywords(content: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Extract keywords and phrases from the content in these categories:
          - exact_match: Phrases that appear exactly in the content (2-3 words only)
          - broad_match: Related phrases that share keywords
          - related_match: Thematically related phrases
          Return ONLY a JSON object with these three arrays.
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

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  logger.info('Raw OpenAI keywords response:', data);

  try {
    const responseContent = data.choices[0].message.content.trim();
    const cleanContent = responseContent.replace(/```json\n|\n```|```/g, '').trim();
    logger.info('Cleaned keywords content:', cleanContent);
    
    return JSON.parse(cleanContent);
  } catch (e) {
    logger.error('Error parsing OpenAI keywords:', e);
    logger.error('Raw content:', data.choices[0].message.content);
    return {
      exact_match: [],
      broad_match: [],
      related_match: []
    };
  }
}