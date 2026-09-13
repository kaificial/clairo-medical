import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { google } from "@ai-sdk/google";
import { env as transformers, pipeline } from "@huggingface/transformers";
import { embedMany } from "ai";

import { queryText, type LocalEmbeddingModel } from "@/lib/embeddings";
import type { Embedder } from "@/lib/retrieval";

const CACHE = join(process.cwd(), "evals", ".cache");
transformers.cacheDir = join(CACHE, "models");

export interface EvalEmbedder {
  name: string;
  passages: Embedder;
  query: Embedder;
}

/**
 * Caches vectors on disk by model and text. Reruns cost nothing, and the Gemini
 * corpus only has to be embedded once, which matters on the free tier.
 */
function vectorCache(name: string) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `vectors-${name.replace(/[^\w-]/g, "_")}.json`);
  const stored: Record<string, number[]> = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, number[]>)
    : {};

  const key = (text: string) =>
    createHash("sha1").update(text).digest("hex").slice(0, 16);

  return {
    async through(
      texts: readonly string[],
      compute: (missing: string[]) => Promise<number[][]>,
    ): Promise<number[][]> {
      const missing = [...new Set(texts.filter((text) => !stored[key(text)]))];
      if (missing.length > 0) {
        const vectors = await compute(missing);
        missing.forEach((text, index) => {
          const vector = vectors[index];
          if (vector) stored[key(text)] = vector;
        });
        writeFileSync(file, JSON.stringify(stored));
      }
      return texts.map((text) => stored[key(text)] ?? []);
    },
  };
}

export async function localEmbedder(
  model: LocalEmbeddingModel,
): Promise<EvalEmbedder> {
  const extractor = await pipeline("feature-extraction", model.repo, {
    dtype: "q8",
  });
  const cache = vectorCache(`local-${model.key}`);

  const run = async (texts: string[]) => {
    const output = await extractor(texts, {
      pooling: model.pooling,
      normalize: true,
    });
    return output.tolist() as number[][];
  };

  return {
    name: model.label,
    passages: (texts) => cache.through(texts, run),
    query: (texts) =>
      cache.through(
        texts.map((text) => queryText(model, text)),
        run,
      ),
  };
}

/**
 * The Gemini comparison only runs with EVAL_CLOUD=1 and a Google key, so CI and
 * a fresh clone don't need one.
 */
export function cloudEmbedder(modelName: string): EvalEmbedder | null {
  if (process.env.EVAL_CLOUD !== "1") return null;

  // loadEnvFile won't overwrite a key that's already set in the environment.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return null;

  const model = google.embeddingModel(modelName);
  const cache = vectorCache(`cloud-${modelName}`);
  const run = async (values: string[]) =>
    (await embedMany({ model, values, maxRetries: 3 })).embeddings;

  return {
    name: `Gemini ${modelName}`,
    passages: (texts) => cache.through(texts, run),
    query: (texts) => cache.through(texts, run),
  };
}
