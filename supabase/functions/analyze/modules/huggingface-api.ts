interface ClassifyTextParams {
  inputs: string;
  parameters: {
    candidate_labels: string[];
  };
}

interface ClassifyTextResponse {
  labels?: string[];
  scores?: number[];
}

export class HuggingFaceAPI {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get('HUGGING_FACE_API_KEY') || '';
    if (!this.apiKey) {
      console.warn('No Hugging Face API key found');
    }
  }

  async classifyText(params: ClassifyTextParams): Promise<ClassifyTextResponse> {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling Hugging Face API:', error);
      return {};
    }
  }
}