import { z } from "zod";

import {
  AiNotConfiguredError,
  EmbeddingRequestTooLargeError,
  embedValues,
  MAX_VALUES,
} from "@/lib/ai/embeddings";

const requestSchema = z.object({
  values: z.array(z.string()).min(1).max(MAX_VALUES),
});

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Embeds report passages through the AI Gateway. This is the point where text
 * from the reader's document leaves the device, so it stays behind an explicit
 * call rather than running as a side effect of opening a file.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Expected a JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return error("Expected { values: string[] }.", 400);
  }

  try {
    const result = await embedValues(parsed.data.values);
    return Response.json(result);
  } catch (cause) {
    if (cause instanceof AiNotConfiguredError) {
      return error(cause.message, 503);
    }
    if (cause instanceof EmbeddingRequestTooLargeError) {
      return error(cause.message, 413);
    }

    console.error("[embed] request failed", cause);
    return error("Could not embed this text.", 502);
  }
}
