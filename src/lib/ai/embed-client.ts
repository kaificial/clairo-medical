import { AiRequestFailedError, AiUnavailableError } from "./errors";
import type { EmbeddingResult } from "./types";

const ENDPOINT = "/api/embed";

/**
 * Ask the server to embed passages. The browser never holds the Gateway key, so
 * every embedding round trip goes through the app's own route.
 */
export async function embedViaApi(
  values: readonly string[],
  signal?: AbortSignal,
): Promise<EmbeddingResult> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values }),
    signal,
  });

  if (response.status === 503) {
    throw new AiUnavailableError("Cloud AI is not configured.");
  }
  if (!response.ok) {
    throw new AiRequestFailedError(`Embedding failed (${response.status}).`);
  }

  return (await response.json()) as EmbeddingResult;
}
