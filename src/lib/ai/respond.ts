import "server-only";

import { streamText, type LanguageModel } from "ai";

import { describeAiFailure } from "./failure";
import type { ChatMessage } from "./prompt";
import { ANSWER_CONTENT_TYPE, toEventStream } from "./transport";

export interface ModelRequest {
  model: LanguageModel;
  instructions: string;
  messages: ChatMessage[];
}

export function streamAnswerEvents({
  model,
  instructions,
  messages,
}: ModelRequest): Response {
  let failure: unknown;

  const result = streamText({
    model,
    instructions,
    messages,
    onError: ({ error }) => {
      failure = error;
      console.error("[ai] stream failed", error);
    },
  });

  const stream = toEventStream({
    deltas: result.textStream,
    describe: (cause) => describeAiFailure(cause).message,
    pending: () => failure,
  });

  return new Response(stream, {
    headers: {
      "content-type": ANSWER_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  });
}
