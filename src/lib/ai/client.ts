import type { GroundedRows } from "@/lib/labs";
import type { Chunk } from "@/lib/pdf";

import type { ChatMessage } from "./prompt";
import { readEventStream } from "./transport";

/**
 * The server answered 503: there's no AI key for this feature. Components catch
 * this and hide the control, since there's nothing the reader can do about it.
 */
export class AiUnavailableError extends Error {
  override name = "AiUnavailableError";
}

/**
 * The request reached the server and failed there, because of a rate limit or a
 * busy model for example. The message is written for the reader, so it's safe
 * to show as it is.
 */
export class AiRequestFailedError extends Error {
  override name = "AiRequestFailedError";

  constructor(
    message: string,
    /**
     * Whatever part of a streamed answer made it through before things broke.
     */
    readonly partial = "",
  ) {
    super(message);
  }
}

/**
 * Prefers the server's explanation. Anything else, a dropped connection for
 * instance, gets the component's own fallback wording.
 */
export function failureMessage(cause: unknown, fallback: string): string {
  return cause instanceof AiRequestFailedError ? cause.message : fallback;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const { error } = (await response.json()) as { error?: unknown };
    if (typeof error === "string" && error.length > 0) return error;
  } catch {
    // Not every failure comes with a JSON body (a proxy timeout, say), but the
    // status code is still worth reporting.
  }
  return `The request failed (${response.status}).`;
}

/**
 * Every AI call from the browser goes through our own routes, so the provider
 * key stays on the server.
 */
async function post(
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (response.status === 503) {
    throw new AiUnavailableError("Cloud AI is not configured.");
  }
  if (!response.ok)
    throw new AiRequestFailedError(await errorMessage(response));
  return response;
}

interface StreamOptions {
  signal?: AbortSignal;
  /**
   * Called with each piece of text as it streams in, so the answer appears
   * while it's being written.
   */
  onDelta?: (delta: string) => void;
}

async function streamAnswer(
  endpoint: string,
  payload: unknown,
  { signal, onDelta }: StreamOptions,
): Promise<string> {
  const response = await post(endpoint, payload, signal);
  if (!response.body) {
    throw new AiRequestFailedError(`The request failed (${response.status}).`);
  }

  const { text, failure } = await readEventStream(response.body, onDelta);
  if (failure !== null) throw new AiRequestFailedError(failure, text);
  return text;
}

/**
 * Asks a question about the open report and resolves with the full answer once
 * the stream ends.
 */
export function askQuestion({
  question,
  passages,
  history,
  ...options
}: StreamOptions & {
  question: string;
  passages: readonly Chunk[];
  history?: readonly ChatMessage[];
}): Promise<string> {
  return streamAnswer("/api/chat", { question, passages, history }, options);
}

/**
 * Asks for a plain language definition of highlighted text, sending the
 * passages that show it in this report.
 */
export function explainTerm({
  term,
  passages,
  mode = "explain",
  ...options
}: StreamOptions & {
  term: string;
  passages: readonly Chunk[];
  /**
   * "explain" grounds the answer in the report's own passages. "exact" skips
   * the report and gives the plain dictionary definition of the term.
   */
  mode?: "explain" | "exact";
}): Promise<string> {
  return streamAnswer("/api/define", { term, passages, mode }, options);
}

/**
 * Rewrites an answer already on screen so a fifth grader could follow it.
 */
export function simplifyText({
  text,
  ...options
}: StreamOptions & { text: string }): Promise<string> {
  return streamAnswer("/api/simplify", { text }, options);
}

/**
 * Sends the passages most likely to hold lab results. What comes back has
 * already been checked against those passages on the server.
 */
export async function readLabsWithAi(
  passages: readonly Chunk[],
  signal?: AbortSignal,
): Promise<GroundedRows> {
  const response = await post("/api/labs", { passages }, signal);
  return (await response.json()) as GroundedRows;
}

/**
 * Embeds passages with the cloud model, for readers who chose it over on-device
 * search. Returns one vector per value, in order.
 */
export async function embedViaApi(
  values: readonly string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const response = await post("/api/embed", { values }, signal);
  const { embeddings } = (await response.json()) as { embeddings: number[][] };
  return embeddings;
}
