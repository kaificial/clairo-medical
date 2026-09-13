/// <reference lib="webworker" />
import { pipeline, type ProgressInfo } from "@huggingface/transformers";

import {
  LOCAL_MODELS,
  type EmbedRequest,
  type EmbedResponse,
  type LocalModelKey,
} from "./models";

type Extractor = Awaited<ReturnType<typeof load>>;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const extractors = new Map<LocalModelKey, Promise<Extractor>>();

function post(message: EmbedResponse) {
  scope.postMessage(message);
}

function load(key: LocalModelKey) {
  return pipeline("feature-extraction", LOCAL_MODELS[key].repo, {
    dtype: "q8",
    progress_callback: (info: ProgressInfo) => {
      if (info.status === "progress_total") {
        post({ type: "download", loaded: info.loaded, total: info.total });
      }
    },
  });
}

/**
 * Each model loads once per worker. If a download fails, say the connection
 * dropped, it's forgotten so the next request tries again instead of failing
 * forever.
 */
function extractorFor(key: LocalModelKey): Promise<Extractor> {
  const cached = extractors.get(key);
  if (cached) return cached;

  const loading = load(key);
  loading.catch(() => extractors.delete(key));
  extractors.set(key, loading);
  return loading;
}

scope.onmessage = async ({ data }: MessageEvent<EmbedRequest>) => {
  const { id, model, texts } = data;

  try {
    const extract = await extractorFor(model);
    const output = await extract(texts, {
      pooling: LOCAL_MODELS[model].pooling,
      normalize: true,
    });
    post({ type: "result", id, vectors: output.tolist() as number[][] });
  } catch (cause) {
    post({
      type: "error",
      id,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
