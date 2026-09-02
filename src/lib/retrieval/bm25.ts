import type { Chunk } from "@/lib/pdf";

import { tokenize } from "./tokenize";

const K1 = 1.2;
const B = 0.75;
const DEFAULT_LIMIT = 5;

export interface RetrievalHit {
  chunk: Chunk;
  score: number;
}

export interface LexicalIndex {
  size: number;
  search(query: string, limit?: number): RetrievalHit[];
}

interface Entry {
  chunk: Chunk;
  terms: Map<string, number>;
  length: number;
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/**
 * BM25 over the chunks of one document. The heading trail is indexed with the
 * body so a section title can be matched by a query that never appears in the
 * prose beneath it.
 */
export function buildLexicalIndex(chunks: readonly Chunk[]): LexicalIndex {
  const entries: Entry[] = chunks.map((chunk) => {
    const tokens = tokenize([...chunk.headings, chunk.text].join(" "));
    return { chunk, terms: countTerms(tokens), length: tokens.length };
  });

  const documentFrequency = new Map<string, number>();
  for (const entry of entries) {
    for (const term of entry.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = entries.length;
  const averageLength =
    total > 0 ? entries.reduce((sum, e) => sum + e.length, 0) / total : 0;

  function idf(term: string): number {
    const df = documentFrequency.get(term) ?? 0;
    if (df === 0) return 0;
    return Math.log(1 + (total - df + 0.5) / (df + 0.5));
  }

  function score(entry: Entry, terms: string[]): number {
    let sum = 0;

    for (const term of terms) {
      const tf = entry.terms.get(term);
      if (!tf) continue;

      const norm =
        averageLength > 0
          ? 1 - B + (B * entry.length) / averageLength
          : 1 - B + B;
      sum += (idf(term) * (tf * (K1 + 1))) / (tf + K1 * norm);
    }

    return sum;
  }

  return {
    size: total,
    search(query, limit = DEFAULT_LIMIT) {
      const terms = tokenize(query);
      if (terms.length === 0 || total === 0) return [];

      return entries
        .map((entry) => ({ chunk: entry.chunk, score: score(entry, terms) }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) =>
          b.score === a.score
            ? a.chunk.id.localeCompare(b.chunk.id)
            : b.score - a.score,
        )
        .slice(0, Math.max(0, limit));
    },
  };
}
