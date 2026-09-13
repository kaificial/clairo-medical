import type { Embedder } from "@/lib/retrieval";

import {
  LOCAL_MODELS,
  queryText,
  type EmbedRequest,
  type EmbedResponse,
  type LocalEmbeddingModel,
  type LocalModelKey,
} from "./models";

/**
 * MiniLM won `pnpm eval`: the best hybrid score of the three local models, and
 * at 23 MB the smallest download.
 */
const DEFAULT_MODEL: LocalModelKey = "minilm";

const BATCH = 8;

export type LocalProgress =
  | { stage: "download"; loaded: number; total: number }
  | { stage: "embed"; done: number; total: number };

interface LocalEmbedder {
  model: LocalEmbeddingModel;
  /**
   * Embeds passages a batch at a time, so the UI can show progress on a long
   * report.
   */
  passages(
    texts: readonly string[],
    onProgress?: (progress: LocalProgress) => void,
  ): Promise<number[][]>;
  query: Embedder;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (vectors: number[][]) => void; reject: (error: Error) => void }
>();
const downloadListeners = new Set<(loaded: number, total: number) => void>();

/**
 * One worker for the whole page. The model downloads and compiles once, and
 * every document opened afterwards reuses it.
 */
function connection(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./embed.worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = ({ data }: MessageEvent<EmbedResponse>) => {
    if (data.type === "download") {
      for (const listener of downloadListeners) {
        listener(data.loaded, data.total);
      }
      return;
    }

    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);

    if (data.type === "result") request.resolve(data.vectors);
    else request.reject(new Error(data.message));
  };

  worker.onerror = (event) => {
    const error = new Error(
      event.message || "The on-device model could not start.",
    );
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
}

function embed(model: LocalModelKey, texts: string[]): Promise<number[][]> {
  const id = (nextId += 1);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: EmbedRequest = { id, model, texts };
    connection().postMessage(request);
  });
}

/**
 * Cheap to create. The worker and the model only load the first time something
 * is embedded.
 */
export function createLocalEmbedder(
  key: LocalModelKey = DEFAULT_MODEL,
): LocalEmbedder {
  const model = LOCAL_MODELS[key];

  return {
    model,

    async passages(texts, onProgress) {
      const listener = (loaded: number, total: number) =>
        onProgress?.({ stage: "download", loaded, total });
      downloadListeners.add(listener);

      try {
        const vectors: number[][] = [];
        for (let start = 0; start < texts.length; start += BATCH) {
          vectors.push(
            ...(await embed(key, texts.slice(start, start + BATCH))),
          );
          onProgress?.({
            stage: "embed",
            done: vectors.length,
            total: texts.length,
          });
        }
        return vectors;
      } finally {
        downloadListeners.delete(listener);
      }
    },

    query: (texts) =>
      embed(
        key,
        texts.map((text) => queryText(model, text)),
      ),
  };
}
