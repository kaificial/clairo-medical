import type { Chunk } from "@/lib/pdf";

/**
 * A chunk counts as relevant when its headings or text contain any of the
 * expected phrases.
 */
export function isRelevant(chunk: Chunk, phrases: readonly string[]): boolean {
  const text = [...chunk.headings, chunk.text].join(" ").toLowerCase();
  return phrases.some((phrase) => text.includes(phrase.toLowerCase()));
}

/**
 * Where the first relevant hit landed, counting from 1, or null if none made
 * the list.
 */
export function firstRelevantRank(
  hits: readonly { chunk: Chunk }[],
  phrases: readonly string[],
): number | null {
  const index = hits.findIndex((hit) => isRelevant(hit.chunk, phrases));
  return index === -1 ? null : index + 1;
}

export interface RetrievalScores {
  questions: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  /**
   * Mean reciprocal rank over the top 5: 1 for a first place hit, 0.5 for
   * second, and so on.
   */
  mrr: number;
}

export function scoreRetrieval(
  ranks: readonly (number | null)[],
): RetrievalScores {
  const n = ranks.length;
  const within = (k: number) =>
    n === 0 ? 0 : ranks.filter((rank) => rank !== null && rank <= k).length / n;

  return {
    questions: n,
    recallAt1: within(1),
    recallAt3: within(3),
    recallAt5: within(5),
    mrr:
      n === 0
        ? 0
        : ranks.reduce<number>(
            (sum, rank) => sum + (rank !== null && rank <= 5 ? 1 / rank : 0),
            0,
          ) / n,
  };
}

export interface Classification {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export function classify(
  truePositives: number,
  falsePositives: number,
  falseNegatives: number,
): Classification {
  const precision =
    truePositives + falsePositives === 0
      ? 1
      : truePositives / (truePositives + falsePositives);
  const recall =
    truePositives + falseNegatives === 0
      ? 1
      : truePositives / (truePositives + falseNegatives);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
  };
}

export const percent = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;
