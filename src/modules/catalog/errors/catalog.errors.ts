/** Thrown when the embeddings API is unavailable or DEMO_MODE is active. */
export class EmbeddingUnavailableError extends Error {
  constructor(reason: string) {
    super(`Embedding unavailable: ${reason}`);
    this.name = 'EmbeddingUnavailableError';
  }
}
