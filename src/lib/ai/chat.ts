import "server-only";

import { env } from "@/env";
import type { Chunk } from "@/lib/pdf";

import { AiNotConfiguredError } from "./errors";
import { chatEnabled, languageModel } from "./model";
import { buildChatPrompt, type ChatMessage } from "./prompt";
import { streamAnswerEvents } from "./respond";

export interface AnswerRequest {
  question: string;
  passages: readonly Chunk[];
  history?: readonly ChatMessage[];
}

/**
 * Stream a grounded answer. Retrieval happens in the browser, where the
 * document lives, so the passages arrive with the question compared to being
 * looked up here.
 */
export function streamAnswer({
  question,
  passages,
  history,
}: AnswerRequest): Response {
  if (!chatEnabled) throw new AiNotConfiguredError();

  const { instructions, messages } = buildChatPrompt({
    question,
    passages,
    history,
  });

  return streamAnswerEvents({
    model: languageModel(env.AI_CHAT_MODEL),
    instructions,
    messages,
  });
}
