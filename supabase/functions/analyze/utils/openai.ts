import { logger } from "./logger.ts";

export async function analyzeWithOpenAI(content: string) {
  try {
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Extract keywords from the content and categorize them into exact_match (primary keywords), broad_match (related terms), and related_match (broader topics). Return a JSON object with these three arrays. Do not include any markdown formatting or code blocks in your response.'
          },
          {
            role: 'user',
            content: `Analyze this content and return a JSON object with three arrays of keywords: ${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // Clean the response to remove any markdown formatting
    const cleanedContent = rawContent.replace(/```json\n|\n```/g, '').trim();
    logger.debug('Cleaned OpenAI response:', cleanedContent);
    
    const result = JSON.parse(cleanedContent);
    
    return {
      exact_match: result.exact_match || [],
      broad_match: result.broad_match || [],
      related_match: result.related_match || []
    };
  } catch (error) {
    logger.error('Error in OpenAI analysis:', error);
    throw error;
  }
}