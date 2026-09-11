import type { Chunk } from "@/lib/pdf";

import { AiRequestFailedError, AiUnavailableError } from "./errors";
import type { ChatMessage } from "./prompt";

const ENDPOINT = "/api/chat";

export interface AskOptions {
  question: string;
  passages: readonly Chunk[];
  history?: readonly ChatMessage[];
  signal?: AbortSignal;
  /** Called with each chunk of the answer when it arrives. */
  onDelta?: (delta: string) => void;
}

/**
 * Ask a question about the open report and stream the answer back. Resolves
 * with the answer once the stream ends.
 */
export async function askQuestion({
  question,
  passages,
  history,
  signal,
  onDelta,
}: AskOptions): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, passages, history }),
    signal,
  });

  if (response.status === 503) {
    throw new AiUnavailableError("Cloud AI is not configured.");
  }
  if (!response.ok || !response.body) {
    throw new AiRequestFailedError(`The answer failed (${response.status}).`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

  let answer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        answer += value;
        onDelta?.(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return answer;
}
