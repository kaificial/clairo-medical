import "server-only";

import { google } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

import { env, providerKeys } from "@/env";

import { AiNotConfiguredError } from "./errors";
import { chooseProvider, modelName } from "./provider";

const NOT_CONFIGURED =
  'Set GOOGLE_GENERATIVE_AI_API_KEY and name a "google/*" model to switch this on.';

/**
 * Resolve a "provider/model" id against the configured key. Google called
 * directly through its SDK so nothings proxied.
 */
export function languageModel(modelId: string): LanguageModel {
  if (chooseProvider(modelId, providerKeys) === null) {
    throw new AiNotConfiguredError(
      `No key serves this chat model. ${NOT_CONFIGURED}`,
    );
  }

  return google(modelName(modelId));
}

export function embeddingModel(modelId: string): EmbeddingModel {
  if (chooseProvider(modelId, providerKeys) === null) {
    throw new AiNotConfiguredError(
      `No key serves this embedding model. ${NOT_CONFIGURED}`,
    );
  }

  return google.embeddingModel(modelName(modelId));
}

/** Whether the key can answer a question about a report. */
export const chatEnabled: boolean =
  chooseProvider(env.AI_CHAT_MODEL, providerKeys) !== null;

/** Whether it can embed one. Semantic search is the only feature that really needs this. */
export const embeddingsEnabled: boolean =
  chooseProvider(env.AI_EMBEDDING_MODEL, providerKeys) !== null;
