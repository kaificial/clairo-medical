import type { Chunk } from "@/lib/pdf";

import { byScore, type RetrievalHit, type Strategy } from "./search";

const K1 = 1.2;
const B = 0.75;

/**
 * Words that tell us nothing in a medical report. The list is deliberately
 * short, because units, numbers and clinical shorthand all need to survive.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

/**
 * Strips a plural "s". Crude, but queries and documents get the same treatment,
 * so "kidneys" still finds "kidney".
 */
function singular(word: string): string {
  if (word.length <= 3 || /(ss|us|is|as)$/.test(word)) return word;
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Splits text into terms we can compare. Decimals stay whole, so someone
 * searching for 6.1 still finds the row it came from.
 */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/\d+(?:\.\d+)?|[a-z]+/g) ?? [];

  return raw
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .map((token) => (/^\d/.test(token) ? token : singular(token)));
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/**
 * BM25 keyword search over one document's chunks. Headings are indexed along
 * with the text, so searching "discharge plan" finds what's under that heading
 * even when those words never appear in it.
 */
export function lexicalStrategy(chunks: readonly Chunk[]): Strategy {
  const entries = chunks.map((chunk) => {
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
    return df === 0 ? 0 : Math.log(1 + (total - df + 0.5) / (df + 0.5));
  }

  function score(entry: (typeof entries)[number], terms: string[]): number {
    const norm =
      averageLength > 0 ? 1 - B + (B * entry.length) / averageLength : 1;
    let sum = 0;

    for (const term of terms) {
      const tf = entry.terms.get(term);
      if (tf) sum += (idf(term) * (tf * (K1 + 1))) / (tf + K1 * norm);
    }
    return sum;
  }

  return async (query, limit) => {
    const terms = tokenize(query);
    if (terms.length === 0) return [];

    return entries
      .map((entry): RetrievalHit => ({
        chunk: entry.chunk,
        score: score(entry, terms),
      }))
      .filter((hit) => hit.score > 0)
      .sort(byScore)
      .slice(0, Math.max(0, limit));
  };
}
