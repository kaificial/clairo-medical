import { z } from "zod";

import { streamAnswer } from "@/lib/ai/chat";
import { AiNotConfiguredError } from "@/lib/ai/embeddings";

const MAX_QUESTION = 2_000;
const MAX_PASSAGES = 12;
const MAX_HISTORY = 20;

const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  page: z.number().int().positive(),
  endPage: z.number().int().positive(),
  headings: z.array(z.string()),
  kind: z.enum(["prose", "table"]),
});

const requestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION),
  passages: z.array(chunkSchema).max(MAX_PASSAGES),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(MAX_HISTORY)
    .optional(),
});

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Answers a question about the open report, grounded in passages the browser retrieved. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Expected a JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return error("Expected { question, passages, history? }.", 400);
  }

  try {
    return streamAnswer(parsed.data);
  } catch (cause) {
    if (cause instanceof AiNotConfiguredError) return error(cause.message, 503);

    console.error("[chat] request failed", cause);
    return error("Could not answer that right now.", 502);
  }
}
