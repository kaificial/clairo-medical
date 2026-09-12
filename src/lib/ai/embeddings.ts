import "server-only";

import { embed, embedMany } from "ai";

import { env } from "@/env";

import { AiNotConfiguredError } from "./errors";
import { embeddingModel, embeddingsEnabled } from "./model";
import type { EmbeddingResult } from "./types";

/** Guard rails on a route that spends money on someone else's API. */
export const MAX_VALUES = 400;
export const MAX_CHARS = 400_000;

export class EmbeddingRequestTooLargeError extends Error {
  override name = "EmbeddingRequestTooLargeError";
}

function assertWithinLimits(values: readonly string[]): void {
  if (values.length > MAX_VALUES) {
    throw new EmbeddingRequestTooLargeError(
      `Cannot embed more than ${MAX_VALUES} passages at once.`,
    );
  }

  const total = values.reduce((sum, value) => sum + value.length, 0);
  if (total > MAX_CHARS) {
    throw new EmbeddingRequestTooLargeError(
      `Cannot embed more than ${MAX_CHARS} characters at once.`,
    );
  }
}

/**
 * Embed report passages through whichever provider is configured
 */
export async function embedValues(
  values: readonly string[],
): Promise<EmbeddingResult> {
  if (!embeddingsEnabled) throw new AiNotConfiguredError();
  assertWithinLimits(values);

  const name = env.AI_EMBEDDING_MODEL;
  if (values.length === 0)
    return { embeddings: [], model: name, dimensions: 0 };

  const model = embeddingModel(name);

  if (values.length === 1) {
    const { embedding } = await embed({ model, value: values[0] ?? "" });
    return {
      embeddings: [embedding],
      model: name,
      dimensions: embedding.length,
    };
  }

  const { embeddings } = await embedMany({ model, values: [...values] });
  return { embeddings, model: name, dimensions: embeddings[0]?.length ?? 0 };
}
