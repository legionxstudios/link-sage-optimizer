import { logger } from "./logger.ts";
import { ExistingPage, AnalysisResult } from "./types.ts";
import { generateSuggestions } from "./suggestion-generator.ts";

export async function analyzeWithOpenAI(
  content: string, 
  existingPages: ExistingPage[]
): Promise<AnalysisResult> {
  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    logger.info(`Analyzing content with ${existingPages.length} existing pages`);
    logger.info('Sample of existing pages:', existingPages.slice(0, 3));

    // Extract keywords using OpenAI
    const keywords = await extractKeywords(content, openAIApiKey);
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

async function extractKeywords(content: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an SEO expert analyzing content for internal linking opportunities.
          Your task is to:
          1. Extract keywords and phrases that could be used for internal linking
          2. For each keyword, explain WHY it would make a good internal link
          3. Consider the context where each keyword appears
          
          Return a JSON object with these arrays:
          - exact_match: Phrases that appear exactly in the content (2-3 words only)
          - broad_match: Related phrases that share keywords
          - related_match: Thematically related phrases
          
          For each phrase, consider:
          - Would this make a meaningful link?
          - Is this a key topic that deserves its own page?
          - Would users benefit from more information about this topic?
          
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
    const errorText = await response.text();
    logger.error(`OpenAI API error: ${response.status}`, errorText);
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