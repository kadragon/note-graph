// Trace: SPEC-refactor-embedding-service, TASK-REFACTOR-005

import type { Env } from '../types/env';
import { getAIGatewayHeaders, getAIGatewayUrl } from '../utils/ai-gateway';

/**
 * OpenAI embedding service using AI Gateway
 */
export class OpenAIEmbeddingService {
  constructor(private env: Env) {}

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @returns Embedding vector (1536 dimensions)
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.callOpenAI([text]);
    if (!response.data[0]) {
      throw new Error('No embedding returned from OpenAI API');
    }
    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.callOpenAI(texts);
    return response.data.map((item: { embedding: number[] }) => item.embedding);
  }

  /**
   * Call OpenAI API via AI Gateway
   *
   * @param inputs - Array of texts to embed
   * @returns OpenAI API response
   */
  private async callOpenAI(inputs: string[]): Promise<{
    data: Array<{ embedding: number[]; index: number }>;
  }> {
    const url = getAIGatewayUrl(this.env, 'embeddings');

    const requestBody = {
      model: this.env.OPENAI_MODEL_EMBEDDING,
      input: inputs,
      encoding_format: 'float',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: getAIGatewayHeaders(this.env),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('AI_RATE_LIMIT: Embedding rate limit exceeded');
      }
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data as { data: Array<{ embedding: number[]; index: number }> };
  }
}
