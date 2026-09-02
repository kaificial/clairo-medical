import { describe, expect, it } from "vitest";

import {
  DimensionMismatchError,
  cosineSimilarity,
  toVector,
} from "./similarity";

describe("cosineSimilarity", () => {
  it("scores identical directions as 1", () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
  });

  it("ignores magnitude", () => {
    expect(cosineSimilarity([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
  });

  it("scores orthogonal vectors as 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("scores opposites as -1", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
  });

  it("ranks a closer vector higher", () => {
    const query = [1, 0];
    const near = cosineSimilarity(query, [0.9, 0.1]);
    const far = cosineSimilarity(query, [0.2, 0.9]);

    expect(near).toBeGreaterThan(far);
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
    expect(cosineSimilarity(toVector([1, 0]), toVector([1, 0]))).toBeCloseTo(1);
  });
});

describe("toVector", () => {
  it("narrows numbers to float32", () => {
    const vector = toVector([0.1, 0.2]);

    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector).toHaveLength(2);
  });
});
