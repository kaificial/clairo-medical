import { z } from "zod";

import {
  EmbeddingRequestTooLargeError,
  embedValues,
  MAX_CHARS,
  MAX_VALUES,
} from "@/lib/ai/embeddings";
import { AiNotConfiguredError } from "@/lib/ai/errors";
import { describeAiFailure } from "@/lib/ai/failure";
import { jsonError, limitRequest, readJson } from "@/lib/server/guard";

const MAX_VALUE = 8_000;
const MAX_BYTES = MAX_CHARS * 3;

const requestSchema = z.object({
  values: z.array(z.string().max(MAX_VALUE)).min(1).max(MAX_VALUES),
});

/**
 * Embeds report passages, where text from the document leaves the
 * device behind an explicit call rather than running as a side
 * effect of opening a file.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = limitRequest(request, "embed");
  if (limited) return limited;

  const body = await readJson(request, requestSchema, {
    maxBytes: MAX_BYTES,
    shape: "{ values: string[] }",
  });
  if (!body.ok) return body.response;

  try {
    return Response.json(await embedValues(body.data.values));
  } catch (cause) {
    if (cause instanceof AiNotConfiguredError)
      return jsonError(cause.message, 503);
    if (cause instanceof EmbeddingRequestTooLargeError)
      return jsonError(cause.message, 413);

    console.error("[embed] request failed", cause);
    const failure = describeAiFailure(cause);
    return jsonError(failure.message, failure.status);
  }
}
