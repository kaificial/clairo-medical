import type { Chunk } from "@/lib/pdf";

import { byScore, type RetrievalHit } from "./search";

/**
 * Stored as float32: half the memory of a plain number array, and far more
 * precision than similarity needs.
 */
type Vector = Float32Array;

/**
 * An embedded chunk. The chunk is stored with its vector so a search hit
 * doesn't need a second lookup.
 */
export interface VectorRecord {
  chunk: Chunk;
  vector: Vector;
}

/**
 * Where embedded chunks are kept, one document per id. The viewer puts the
 * model in the id, so vectors from different models never meet.
 */
export interface VectorStore {
  put(documentId: string, records: readonly VectorRecord[]): Promise<void>;
  search(
    documentId: string,
    query: Vector,
    limit?: number,
  ): Promise<RetrievalHit[]>;
  has(documentId: string): Promise<boolean>;
}

export class DimensionMismatchError extends Error {
  override name = "DimensionMismatchError";

  constructor(expected: number, received: number) {
    super(
      `Vector has ${received} dimensions but this index holds ${expected}. ` +
        "Vectors written by a different embedding model cannot be compared.",
    );
  }
}

export function toVector(values: ArrayLike<number>): Vector {
  return Float32Array.from(values);
}

/**
 * Cosine similarity, from -1 to 1. A zero vector has no direction, so it scores
 * 0 against everything instead of dividing by zero.
 */
export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
  if (a.length !== b.length) {
    throw new DimensionMismatchError(a.length, b.length);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * An exact scan over every record. A report has a few hundred chunks at most,
 * so this is faster and simpler than keeping an approximate index in the
 * browser.
 */
export function nearest(
  records: readonly VectorRecord[],
  query: Vector,
  limit = 5,
): RetrievalHit[] {
  return records
    .map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(record.vector, query),
    }))
    .sort(byScore)
    .slice(0, Math.max(0, limit));
}

/**
 * The same store kept in a Map. The eval uses it, since Node has no IndexedDB.
 */
export function createMemoryVectorStore(): VectorStore {
  const documents = new Map<string, readonly VectorRecord[]>();

  return {
    async put(documentId, records) {
      documents.set(documentId, [...records]);
    },
    async search(documentId, query, limit) {
      return nearest(documents.get(documentId) ?? [], query, limit);
    },
    async has(documentId) {
      return documents.has(documentId);
    },
  };
}
