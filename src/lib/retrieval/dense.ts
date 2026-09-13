import type { Chunk } from "@/lib/pdf";

import type { Strategy } from "./search";
import { toVector, type VectorRecord, type VectorStore } from "./vectors";

/**
 * Turns texts into vectors, one per text and in the same order. The local model
 * and the cloud route both fit this shape.
 */
export type Embedder = (values: readonly string[]) => Promise<number[][]>;

/**
 * What we embed for a chunk: its heading trail, then the text. A bare row like
 * "ALT | 90 | IU/L" means a lot more to the model with "Investigations" in
 * front of it.
 */
export function embeddingText(chunk: Chunk): string {
  return [...chunk.headings, chunk.text].join("\n");
}

/**
 * Embeds a document's chunks and saves them. Returns how many were written, so
 * an empty document can be told apart from an indexed one.
 */
export async function indexDocument({
  store,
  documentId,
  chunks,
  embed,
}: {
  store: VectorStore;
  documentId: string;
  chunks: readonly Chunk[];
  embed: Embedder;
}): Promise<number> {
  if (chunks.length === 0) return 0;

  const vectors = await embed(chunks.map(embeddingText));
  const records: VectorRecord[] = chunks.flatMap((chunk, index) => {
    const vector = vectors[index];
    return vector ? [{ chunk, vector: toVector(vector) }] : [];
  });

  await store.put(documentId, records);
  return records.length;
}

/**
 * Nearest neighbour search over an indexed document. Some models embed a
 * question differently from a passage, so questions get their own embedder.
 */
export function denseStrategy({
  store,
  documentId,
  embedQuery,
}: {
  store: VectorStore;
  documentId: string;
  embedQuery: Embedder;
}): Strategy {
  return async (query, limit) => {
    const [vector] = await embedQuery([query]);
    return vector ? store.search(documentId, toVector(vector), limit) : [];
  };
}
