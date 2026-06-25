import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { env } from '@config/env';
import { EmbeddingUnavailableError } from './errors/catalog.errors';

@Injectable()
export class EmbeddingsClientService {
  private readonly logger = new Logger(EmbeddingsClientService.name);
  private readonly client: OpenAI;

  constructor() {
    const apiKey = env.EMBEDDINGS_API_KEY ?? env.LLM_API_KEY ?? 'placeholder';
    const baseURL = env.EMBEDDINGS_BASE_URL ?? env.LLM_BASE_URL;
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: env.LLM_TIMEOUT_MS,
      maxRetries: env.LLM_MAX_RETRIES,
    });
  }

  /** Returns an embedding vector for the given text using the configured model. */
  async embed(text: string): Promise<number[]> {
    if (env.DEMO_MODE) {
      throw new EmbeddingUnavailableError('DEMO_MODE is active');
    }

    const apiKey = env.EMBEDDINGS_API_KEY ?? env.LLM_API_KEY;
    if (!apiKey) {
      throw new EmbeddingUnavailableError('No API key configured');
    }

    try {
      const params: OpenAI.EmbeddingCreateParams = {
        model: env.EMBEDDINGS_MODEL,
        input: text,
      };
      if (env.EMBEDDINGS_DIMENSIONS) {
        params.dimensions = env.EMBEDDINGS_DIMENSIONS;
      }

      const response = await this.client.embeddings.create(params);
      return response.data[0].embedding;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({ event: 'embedding_failed', message });
      throw new EmbeddingUnavailableError(message);
    }
  }
}
