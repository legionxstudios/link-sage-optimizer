const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');

export const analyzeKeywords = async (content: string): Promise<string[]> => {
  try {
    console.log('Starting keyword analysis...');
    
    // First get topic classification
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
              "lifestyle", "travel"
            ],
            multi_label: true
          }
        }),
      }
    );

    const topicData = await topicResponse.json();
    console.log('Topic analysis response:', topicData);
    
    if (!topicData.labels || !topicData.scores) {
      console.error('Invalid topic analysis response:', topicData);
      return [];
    }

    // Get relevant topics
    const relevantTopics = topicData.labels
      .filter((_: string, index: number) => topicData.scores[index] > 0.3);
    
    console.log('Relevant topics:', relevantTopics);

    // Now extract key phrases
    const keyPhraseResponse = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/keyword-extractor",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: content.substring(0, 2000),
          parameters: {
            max_length: 128,
            num_return_sequences: 15
          }
        }),
      }
    );

    const keyPhraseData = await keyPhraseResponse.json();
    console.log('Key phrase analysis response:', keyPhraseData);

    // Combine topics and key phrases
    const keywords = [...new Set([
      ...relevantTopics,
      ...(Array.isArray(keyPhraseData) ? keyPhraseData : [])
    ])];

    console.log('Final extracted keywords:', keywords);
    return keywords;

  } catch (error) {
    console.error('Error in keyword analysis:', error);
    return [];
  }
};