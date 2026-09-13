import type { Chunk } from "@/lib/pdf";

export interface RetrievalHit {
  chunk: Chunk;
  score: number;
}

/**
 * One way of ranking a document's chunks for a query: keywords, section routing
 * or vectors.
 */
export type Strategy = (
  query: string,
  limit: number,
) => Promise<RetrievalHit[]>;

/** Search over one document, combining every strategy it was built with. */
export type Search = (query: string, limit?: number) => Promise<RetrievalHit[]>;

const DEFAULT_LIMIT = 5;
/**
 * The constant from the original reciprocal rank fusion paper. It keeps one
 * list's top hit from outvoting everything else on its own.
 */
const RRF_K = 60;
/**
 * Each strategy is asked for at least this many hits, more than the caller
 * wants, so fusion has something to work with.
 */
const MIN_POOL = 10;

/**
 * Best first. Ties are broken by chunk id so the same search always comes back
 * in the same order.
 */
export function byScore(a: RetrievalHit, b: RetrievalHit): number {
  return b.score === a.score
    ? a.chunk.id.localeCompare(b.chunk.id)
    : b.score - a.score;
}

/**
 * Combines ranked lists with reciprocal rank fusion. Only each list's order
 * counts, because BM25 scores and cosine similarities aren't on a scale you can
 * compare.
 */
export function fuseRankings(
  rankings: readonly (readonly RetrievalHit[])[],
  limit = DEFAULT_LIMIT,
): RetrievalHit[] {
  const fused = new Map<string, RetrievalHit>();

  for (const ranking of rankings) {
    ranking.forEach((hit, index) => {
      const current = fused.get(hit.chunk.id) ?? { chunk: hit.chunk, score: 0 };
      current.score += 1 / (RRF_K + index + 1);
      fused.set(hit.chunk.id, current);
    });
  }

  return [...fused.values()].sort(byScore).slice(0, Math.max(0, limit));
}

/**
 * Runs every strategy and fuses what comes back. A strategy that fails is
 * dropped instead of failing the whole search, so if the cloud embedding call
 * errors, the reader still gets keyword results.
 */
export function hybridSearch(strategies: readonly Strategy[]): Search {
  return async (query, limit = DEFAULT_LIMIT) => {
    if (query.trim().length === 0) return [];

    const pool = Math.max(limit * 2, MIN_POOL);
    const settled = await Promise.allSettled(
      strategies.map((strategy) => strategy(query, pool)),
    );

    return fuseRankings(
      settled.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      ),
      limit,
    );
  };
}
