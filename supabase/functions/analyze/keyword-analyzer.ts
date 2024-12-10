const HF_API_KEY = Deno.env.get('HUGGING_FACE_API_KEY');

export const analyzeKeywords = async (content: string): Promise<string[]> => {
  try {
    const response = await fetch(
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

    const data = await response.json();
    
    if (!data.labels || !data.scores) {
      console.error('Invalid response from keyword analysis:', data);
      return [];
    }

    return data.labels.filter((_: string, index: number) => data.scores[index] > 0.3);
  } catch (error) {
    console.error('Error in keyword analysis:', error);
    return [];
  }
};