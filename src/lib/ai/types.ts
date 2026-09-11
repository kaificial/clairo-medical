/** Shared between the server that calls the provider and the browser that asks it to. */
export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
}
