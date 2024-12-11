import { logger } from './logger';

export class HuggingFaceAPI {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api-inference.huggingface.co/models';
  private readonly model = 'facebook/bart-large-mnli';

  constructor() {
    const apiKey = Deno.env.get('HUGGING_FACE_API_KEY');
    if (!apiKey) {
      throw new Error('HUGGING_FACE_API_KEY is not set');
    }
    this.apiKey = apiKey;
  }

  async classifyText(payload: any) {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('HuggingFace API error:', error);
      throw error;
    }
  }
}