import type { Chunk } from "@/lib/pdf";

import type { RetrievalHit } from "./bm25";

/**
 * Damping constant from the original reciprocalrank fusion paper. Big enough
 * that a single list cant dominate on the strength of its top hit by itself.
 */
const RRF_K = 60;
const DEFAULT_LIMIT = 5;

export interface FusionOptions {
  k?: number;
  limit?: number;
}

/**
 * Combine ranked lists by reciprocal rank fusion. Scores from the inputs are
 * deliberately ignored: BM25 scores and cosine similarities are not on a
 * comparable scale so only the ordering each strategy produced is used. The
 * score on the returned hits is the fusion score.
 */
export function fuseRankings(
  rankings: readonly (readonly RetrievalHit[])[],
  options: FusionOptions = {},
): RetrievalHit[] {
  const k = options.k ?? RRF_K;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const fused = new Map<string, { chunk: Chunk; score: number }>();

  for (const ranking of rankings) {
    ranking.forEach((hit, index) => {
      const current = fused.get(hit.chunk.id) ?? { chunk: hit.chunk, score: 0 };
      current.score += 1 / (k + index + 1);
      fused.set(hit.chunk.id, current);
    });
  }

  return [...fused.values()]
    .sort((a, b) =>
      b.score === a.score
        ? a.chunk.id.localeCompare(b.chunk.id)
        : b.score - a.score,
    )
    .slice(0, Math.max(0, limit));
}
