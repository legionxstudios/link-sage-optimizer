import { logger } from "./logger.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function analyzeWithOpenAI(content: string, existingPages: any[]) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Analyzing content with OpenAI...');
    
    // Truncate content to avoid token limits
    const truncatedContent = content.substring(0, 3000);
    
    // Create context about existing pages for OpenAI
    const pagesContext = existingPages.map(page => ({
      url: page.url,
      title: page.title || '',
      summary: page.content?.substring(0, 200) || ''
    }));

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
            content: `You are an SEO expert. Extract keywords and suggest relevant internal linking opportunities from the provided list of pages. Return a JSON object with:
            1. keywords categorized into arrays (exact_match, broad_match, related_match)
            2. outboundSuggestions array with specific anchor text and target URLs from the provided pages list.
            Each suggestion should include suggestedAnchorText, targetUrl, context, and relevanceScore.`
          },
          {
            role: 'user',
            content: `Analyze this content and suggest links to these existing pages:\n\nContent: ${truncatedContent}\n\nAvailable pages: ${JSON.stringify(pagesContext)}`
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

    // Parse the response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      logger.error('Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    logger.info('Successfully parsed OpenAI response');

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