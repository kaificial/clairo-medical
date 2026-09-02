import type { Chunk } from "@/lib/pdf";

import type { Vector } from "./similarity";

/** One embedded chunk. The chunk travels with the vector so a hit needs no second lookup. */
export interface VectorRecord {
  chunk: Chunk;
  vector: Vector;
}

export interface VectorMatch {
  chunk: Chunk;
  score: number;
}

/**
 * Storage for one embedded document at a time, keyed by a caller-chosen id.
 * IndexedDB backs the local store; Postgres with pgvector backs the synced one.
 */
export interface VectorStore {
  put(documentId: string, records: readonly VectorRecord[]): Promise<void>;
  search(
    documentId: string,
    query: Vector,
    limit?: number,
  ): Promise<VectorMatch[]>;
  has(documentId: string): Promise<boolean>;
  remove(documentId: string): Promise<void>;
  clear(): Promise<void>;
}
