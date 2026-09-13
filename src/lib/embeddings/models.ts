/**
 * A small sentence embedding model that runs in the browser through
 * transformers.js and ONNX.
 */
export interface LocalEmbeddingModel {
  key: string;
  /** Hugging Face repo with ONNX weights that transformers.js can load. */
  repo: string;
  label: string;
  /**
   * Some models, BGE for one, were trained with an instruction in front of
   * queries. It goes on questions only, never on passages.
   */
  queryPrefix: string;
  /**
   * How token vectors are pooled into one sentence vector. It has to match how
   * the model was trained, or the vectors come out worse.
   */
  pooling: "cls" | "mean";
  /**
   * Rough size of the quantized weights, shown next to the button so nobody
   * downloads a model by surprise.
   */
  downloadMb: number;
}

export const LOCAL_MODELS = {
  "bge-small": {
    key: "bge-small",
    repo: "Xenova/bge-small-en-v1.5",
    label: "BGE small",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    pooling: "cls",
    downloadMb: 34,
  },
  "gte-small": {
    key: "gte-small",
    repo: "Xenova/gte-small",
    label: "GTE small",
    queryPrefix: "",
    pooling: "mean",
    downloadMb: 34,
  },
  minilm: {
    key: "minilm",
    repo: "Xenova/all-MiniLM-L6-v2",
    label: "MiniLM L6",
    queryPrefix: "",
    pooling: "mean",
    downloadMb: 23,
  },
} as const satisfies Record<string, LocalEmbeddingModel>;

export type LocalModelKey = keyof typeof LOCAL_MODELS;

export function queryText(model: LocalEmbeddingModel, query: string): string {
  return `${model.queryPrefix}${query}`;
}

/** The messages passed between the page and the embedding worker. */
export interface EmbedRequest {
  id: number;
  model: LocalModelKey;
  texts: string[];
}

export type EmbedResponse =
  | { type: "download"; loaded: number; total: number }
  | { type: "result"; id: number; vectors: number[][] }
  | { type: "error"; id: number; message: string };
