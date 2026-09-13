import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import {
  classify,
  firstRelevantRank,
  isRelevant,
  scoreRetrieval,
} from "./metrics";

const chunk = (text: string, headings: string[] = []): Chunk => ({
  id: text,
  text,
  page: 1,
  endPage: 1,
  headings,
  kind: "prose",
});

describe("relevance", () => {
  it("matches a phrase in the body or the heading trail, ignoring case", () => {
    expect(isRelevant(chunk("Potassium 5.4"), ["potassium"])).toBe(true);
    expect(
      isRelevant(chunk("1. Appendicitis", ["IMPRESSION"]), ["Impression"]),
    ).toBe(true);
    expect(isRelevant(chunk("Sodium 139"), ["potassium"])).toBe(false);
  });

  it("finds the rank of the first relevant hit", () => {
    const hits = [chunk("Sodium"), chunk("Chloride"), chunk("Potassium")].map(
      (c) => ({ chunk: c }),
    );
    expect(firstRelevantRank(hits, ["potassium"])).toBe(3);
    expect(firstRelevantRank(hits, ["calcium"])).toBeNull();
  });
});

describe("scores", () => {
  it("computes recall at k and mean reciprocal rank", () => {
    expect(scoreRetrieval([1, 2, null, 4])).toEqual({
      questions: 4,
      recallAt1: 0.25,
      recallAt3: 0.5,
      recallAt5: 0.75,
      mrr: (1 + 0.5 + 0 + 0.25) / 4,
    });
  });

  it("computes precision, recall and F1, treating empty sets as perfect", () => {
    expect(classify(8, 2, 0)).toMatchObject({ precision: 0.8, recall: 1 });
    expect(classify(0, 0, 0)).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });
});
