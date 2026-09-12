import { z } from "zod";

import { streamAnswer } from "@/lib/ai/chat";
import { AiNotConfiguredError } from "@/lib/ai/errors";
import { describeAiFailure } from "@/lib/ai/failure";
import { chunkSchema, historySchema } from "@/lib/ai/schemas";
import { jsonError, limitRequest, readJson } from "@/lib/server/guard";

const MAX_QUESTION = 2_000;
const MAX_PASSAGES = 12;
const MAX_HISTORY = 20;
const MAX_BYTES = 512_000;

const requestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION),
  passages: z.array(chunkSchema).max(MAX_PASSAGES),
  history: historySchema.max(MAX_HISTORY).optional(),
});

/** Answers a question about the open report, grounded in passages the browser retrieved. */
export async function POST(request: Request): Promise<Response> {
  const limited = limitRequest(request, "chat");
  if (limited) return limited;

  const body = await readJson(request, requestSchema, {
    maxBytes: MAX_BYTES,
    shape: "{ question, passages, history? }",
  });
  if (!body.ok) return body.response;

  try {
    return streamAnswer(body.data);
  } catch (cause) {
    if (cause instanceof AiNotConfiguredError)
      return jsonError(cause.message, 503);

    console.error("[chat] request failed", cause);
    const failure = describeAiFailure(cause);
    return jsonError(failure.message, failure.status);
  }
}
