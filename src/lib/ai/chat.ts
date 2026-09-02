import "server-only";

import { streamText } from "ai";

import { aiEnabled, env } from "@/env";
import type { Chunk } from "@/lib/pdf";

import { AiNotConfiguredError } from "./embeddings";
import { buildChatPrompt, type ChatMessage } from "./prompt";

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
  if (!aiEnabled) throw new AiNotConfiguredError();

  const { instructions, messages } = buildChatPrompt({
    question,
    passages,
    history,
  });

  const result = streamText({
    model: env.AI_CHAT_MODEL,
    instructions,
    messages,
  });

  return result.toTextStreamResponse();
}
