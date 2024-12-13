import { logger } from "./utils/logger.ts";

const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export const analyzeKeywords = async (content: string): Promise<string[]> => {
  try {
    logger.info('Starting keyword analysis...');
    logger.debug('Content length:', content.length);
    
    // Log a sample of the content to verify what we're analyzing
    logger.debug('Content sample:', content.substring(0, 500));
    
    if (!OPENAI_API_KEY) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }
    
    // First try OpenAI for keyword extraction
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
              content: `You are an SEO expert specialized in keyword extraction. 
              Analyze the content and extract exactly 15 keywords/phrases, categorized as follows:
              - 5 exact match keywords (highest relevance)
              - 5 broad match keywords (medium relevance)
              - 5 related keywords (lower relevance)
              Each keyword/phrase should be 1-3 words long.
              Return ONLY a JSON object with these three arrays.`
            },
            {
              role: 'user',
              content: `Extract and categorize keywords from this content. If the content is too short or empty, return empty arrays:\n\n${content.substring(0, 2000)}`
            }
          ],
          temperature: 0.3, // Lower temperature for more focused results
          max_tokens: 500
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

      const openAIKeywords = JSON.parse(data.choices[0].message.content);
      logger.info('Successfully extracted keywords from OpenAI:', openAIKeywords);
      return openAIKeywords;

    } catch (openAIError) {
      logger.error('OpenAI keyword extraction failed:', openAIError);
      logger.info('Falling back to Hugging Face for topic classification...');
      
      if (!HF_API_KEY) {
        logger.error('Hugging Face API key is not configured');
        throw new Error('Both OpenAI and Hugging Face API keys are not configured');
      }
      
      // Fallback to Hugging Face
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
      return {
        exact_match: relevantTopics.slice(0, 5),
        broad_match: relevantTopics.slice(5, 10),
        related_match: relevantTopics.slice(10, 15)
      };
    }
  } catch (error) {
    logger.error('All keyword analysis methods failed:', error);
    return {
      exact_match: [],
      broad_match: [],
      related_match: []
    };
  }
};