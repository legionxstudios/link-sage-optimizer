import { logger } from "./utils/logger.ts";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";

const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Initialize OpenAI configuration
const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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
      
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo", // Using a valid model name
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
      });

      if (!completion.data.choices?.[0]?.message?.content) {
        logger.error('Invalid OpenAI response format:', completion.data);
        throw new Error('Invalid OpenAI response format');
      }

      const openAIKeywords = JSON.parse(completion.data.choices[0].message.content);
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