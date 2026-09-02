import type { Chunk } from "@/lib/pdf";

import { buildLexicalIndex, type RetrievalHit } from "./bm25";
import { fuseRankings } from "./rrf";

const DEFAULT_LIMIT = 5;
/** Each strategy is asked for more than the caller wants, so fusion has room. */
const POOL_MULTIPLIER = 2;
const MIN_POOL = 10;

export interface RetrievalStrategy {
  readonly name: string;
  search(query: string, limit: number): Promise<RetrievalHit[]>;
}

export interface RetrievalService {
  readonly strategies: readonly string[];
  search(query: string, limit?: number): Promise<RetrievalHit[]>;
}

/** BM25 over the document, wrapped in the async strategy shape. */
export function lexicalStrategy(chunks: readonly Chunk[]): RetrievalStrategy {
  const index = buildLexicalIndex(chunks);

  return {
    name: "lexical",
    search: (query, limit) => Promise.resolve(index.search(query, limit)),
  };
}

/**
 * Run every strategy and fuse what comes back. A strategy that doesnt work is
 * dropped rather than failing the search: losing the dense half to a network
 * error should still leave the reader with keyword results.
 */
export function createRetrievalService(
  strategies: readonly RetrievalStrategy[],
): RetrievalService {
  return {
    strategies: strategies.map((strategy) => strategy.name),

    async search(query, limit = DEFAULT_LIMIT) {
      if (strategies.length === 0 || query.trim().length === 0) return [];

      const pool = Math.max(limit * POOL_MULTIPLIER, MIN_POOL);
      const settled = await Promise.allSettled(
        strategies.map((strategy) => strategy.search(query, pool)),
      );

      const rankings = settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      if (rankings.length === 0) return [];
      if (rankings.length === 1) return (rankings[0] ?? []).slice(0, limit);

      return fuseRankings(rankings, { limit });
    },
  };
}
