import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import {
  cosineSimilarity,
  createMemoryVectorStore,
  DimensionMismatchError,
  toVector,
} from "./vectors";

describe("cosineSimilarity", () => {
  it("scores identical directions as 1", () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
  });

  it("ignores magnitude", () => {
    expect(cosineSimilarity([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
  });

  it("scores orthogonal vectors as 0 and opposites as -1", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
  });

  it("ranks a closer vector higher", () => {
    const query = [1, 0];
    expect(cosineSimilarity(query, [0.9, 0.1])).toBeGreaterThan(
      cosineSimilarity(query, [0.2, 0.9]),
    );
  });

  it("treats a zero vector as unrelated rather than dividing by zero", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("rejects a dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      DimensionMismatchError,
    );
  });

  it("works on the float32 vectors the store holds", () => {
    const vector = toVector([1, 0]);

    expect(vector).toBeInstanceOf(Float32Array);
    expect(cosineSimilarity(vector, toVector([1, 0]))).toBeCloseTo(1);
  });
});

describe("createMemoryVectorStore", () => {
  const chunk = (id: string): Chunk => ({
    id,
    text: id,
    page: 1,
    endPage: 1,
    headings: [],
    kind: "prose",
  });

  it("ranks the nearest record first, per document", async () => {
    const store = createMemoryVectorStore();
    await store.put("doc", [
      { chunk: chunk("far"), vector: toVector([0, 1]) },
      { chunk: chunk("near"), vector: toVector([1, 0]) },
    ]);

    const hits = await store.search("doc", toVector([1, 0]));
    expect(hits.map((hit) => hit.chunk.id)).toEqual(["near", "far"]);
    expect(await store.has("doc")).toBe(true);
    expect(await store.search("other", toVector([1, 0]))).toEqual([]);
  });
});
