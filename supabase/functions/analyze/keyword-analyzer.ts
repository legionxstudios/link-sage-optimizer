import { logger } from "./utils/logger.ts";

const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export const analyzeKeywords = async (content: string): Promise<string[]> => {
  try {
    logger.info('Starting keyword analysis...');
    logger.debug('Content length:', content.length);
    
    if (!OPENAI_API_KEY) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }
    
    // First try OpenAI for keyword extraction
    try {
      logger.info('Attempting OpenAI keyword extraction...');
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are an SEO expert. Extract the most important keywords and phrases from the given content. Return ONLY a JSON array of strings, with each string being 1-3 words long.'
            },
            {
              role: 'user',
              content: `Extract the top 15 most relevant SEO keywords and phrases from this content. Each keyword/phrase should be 1-3 words long:\n\n${content.substring(0, 2000)}`
            }
          ],
        }),
      });

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        logger.error(`OpenAI API error: ${openAIResponse.status} ${openAIResponse.statusText}`, errorText);
        throw new Error(`OpenAI API error: ${openAIResponse.status} ${openAIResponse.statusText}`);
      }

      const openAIData: OpenAIResponse = await openAIResponse.json();
      logger.debug('OpenAI response:', openAIData);

      if (!openAIData.choices?.[0]?.message?.content) {
        logger.error('Invalid OpenAI response format:', openAIData);
        throw new Error('Invalid OpenAI response format');
      }

      const openAIKeywords = JSON.parse(openAIData.choices[0].message.content);
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
      return relevantTopics;
    }
  } catch (error) {
    logger.error('All keyword analysis methods failed:', error);
    return [];
  }
};