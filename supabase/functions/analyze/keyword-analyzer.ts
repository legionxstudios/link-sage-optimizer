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
              content: 'You are an SEO expert. Extract keywords from the content and categorize them into three arrays: exact_match (primary keywords), broad_match (related terms), and related_match (broader topics). Return ONLY a JSON object with these three arrays.'
            },
            {
              role: 'user',
              content: `Analyze this content and return a JSON object with three arrays of keywords (exact_match, broad_match, related_match). If the content is empty or invalid, return empty arrays:\n\n${content.substring(0, 2000)}`
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

      // Ensure we have the correct structure
      return {
        exact_match: Array.isArray(parsedKeywords.exact_match) ? parsedKeywords.exact_match : [],
        broad_match: Array.isArray(parsedKeywords.broad_match) ? parsedKeywords.broad_match : [],
        related_match: Array.isArray(parsedKeywords.related_match) ? parsedKeywords.related_match : []
      };

    } catch (openAIError) {
      logger.error('OpenAI keyword extraction failed:', openAIError);
      logger.info('Falling back to Hugging Face for topic classification...');
      
      if (!HF_API_KEY) {
        logger.error('Hugging Face API key is not configured');
        throw new Error('Both OpenAI and Hugging Face API keys are not configured');
      }
      
      const topicResponse = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: content.substring(0, 1000),
            parameters: {
              candidate_labels: [
                "technology", "business", "health", "education", 
                "entertainment", "sports", "science", "politics", 
                "lifestyle", "travel", "marketing", "software",
                "ecommerce", "finance", "social media"
              ],
              multi_label: true
            }
          }),
        }
      );

      if (!topicResponse.ok) {
        const errorText = await topicResponse.text();
        logger.error(`Hugging Face API error: ${topicResponse.status} ${topicResponse.statusText}`, errorText);
        throw new Error(`Hugging Face API error: ${topicResponse.status} ${topicResponse.statusText}`);
      }

      const topicData = await topicResponse.json();
      logger.debug('Topic analysis response:', topicData);
      
      if (!topicData.labels || !topicData.scores) {
        logger.error('Invalid topic analysis response:', topicData);
        throw new Error('Invalid topic analysis response');
      }

      const relevantTopics = topicData.labels
        .filter((_: string, index: number) => topicData.scores[index] > 0.3);
      
      logger.info('Successfully extracted topics from Hugging Face:', relevantTopics);
      
      // Split the topics into three categories based on confidence scores
      return {
        exact_match: relevantTopics.slice(0, 5),
        broad_match: relevantTopics.slice(5, 10),
        related_match: relevantTopics.slice(10, 15)
      };
    }
  } catch (error) {
    logger.error('All keyword analysis methods failed:', error);
    // Return empty arrays as fallback
    return {
      exact_match: [],
      broad_match: [],
      related_match: []
    };
  }
};