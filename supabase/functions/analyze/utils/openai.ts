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
          content: `You are an SEO expert. Extract keywords from the content and return them in a specific JSON format.
          
          Rules:
          1. ONLY return a valid JSON object
          2. The JSON object must have exactly these three arrays:
             - exact_match: 2-3 word phrases that appear VERBATIM in the content
             - broad_match: Related phrases sharing keywords
             - related_match: Thematically related phrases
          3. Do not include any explanation or additional text
          4. Ensure the response is pure JSON`
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
    logger.info('Cleaned keywords content:', responseContent);
    
    // Attempt to parse the JSON response
    const keywords = JSON.parse(responseContent);
    
    // Validate the response structure
    if (!keywords.exact_match || !keywords.broad_match || !keywords.related_match) {
      throw new Error('Invalid response structure from OpenAI');
    }
    
    return {
      exact_match: keywords.exact_match,
      broad_match: keywords.broad_match,
      related_match: keywords.related_match
    };
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