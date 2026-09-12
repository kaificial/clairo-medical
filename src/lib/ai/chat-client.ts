import type { Chunk } from "@/lib/pdf";

import type { ChatMessage } from "./prompt";
import { requestAnswer } from "./transport";

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
export function askQuestion({
  question,
  passages,
  history,
  signal,
  onDelta,
}: AskOptions): Promise<string> {
  return requestAnswer(
    ENDPOINT,
    { question, passages, history },
    { signal, onDelta },
  );
}
