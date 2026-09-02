/** Embeddings are stored as float32: half the memory of a JS number array. */
export type Vector = Float32Array;

export class DimensionMismatchError extends Error {
  override name = "DimensionMismatchError";

  constructor(expected: number, received: number) {
    super(
      `Vector has ${received} dimensions but this index holds ${expected}. ` +
        "Vectors written by a different embedding model cannot be compared.",
    );
  }
}

export function toVector(values: ArrayLike<number>): Vector {
  return Float32Array.from(values);
}

/**
 * Cosine similarity in [-1, 1]. A zero vector has no direction, so it scores 0
 * against everything rather than dividing by zero.
 */
export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
  if (a.length !== b.length)
    throw new DimensionMismatchError(a.length, b.length);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
