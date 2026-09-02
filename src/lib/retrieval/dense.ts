import type { Chunk } from "@/lib/pdf";
import { toVector, type VectorRecord, type VectorStore } from "@/lib/vector";

import type { RetrievalHit } from "./bm25";
import type { RetrievalStrategy } from "./service";

/** Embeds passages and returns one vector per passage, in the same order. */
export type Embedder = (values: readonly string[]) => Promise<number[][]>;

export interface DenseOptions {
  store: VectorStore;
  documentId: string;
  embed: Embedder;
}

/**
 * What gets embedded for a chunk. The heading trail goes in with the body so a
 * lab row still carries the name of the section it sits under.
 */
export function embeddingText(chunk: Chunk): string {
  return [...chunk.headings, chunk.text].join("\n");
}

/**
 * Embed a document's chunks and hand them to the store. Returns how many were
 * written so a caller can tell an indexed document from an empty one.
 */
export async function indexDocument({
  store,
  documentId,
  chunks,
  embed,
}: DenseOptions & { chunks: readonly Chunk[] }): Promise<number> {
  if (chunks.length === 0) return 0;

  const vectors = await embed(chunks.map(embeddingText));

  const records: VectorRecord[] = [];
  chunks.forEach((chunk, index) => {
    const vector = vectors[index];
    if (vector) records.push({ chunk, vector: toVector(vector) });
  });

  await store.put(documentId, records);
  return records.length;
}

/** Nearest-neighbour search over the embedded chunks of one document. */
export function denseStrategy({
  store,
  documentId,
  embed,
}: DenseOptions): RetrievalStrategy {
  return {
    name: "dense",

    async search(query, limit): Promise<RetrievalHit[]> {
      const [vector] = await embed([query]);
      if (!vector) return [];

      const matches = await store.search(documentId, toVector(vector), limit);
      return matches.map((match) => ({
        chunk: match.chunk,
        score: match.score,
      }));
    },
  };
}
