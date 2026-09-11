import { AiRequestFailedError, AiUnavailableError } from "./errors";

export type AnswerEvent =
  { type: "delta"; text: string } | { type: "error"; message: string };

export const ANSWER_CONTENT_TYPE = "application/x-ndjson";

export function encodeEvent(event: AnswerEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Parse one line anything thats unrecognisable */
export function parseEvent(line: string): AnswerEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;

  if (event.type === "delta" && typeof event.text === "string") {
    return { type: "delta", text: event.text };
  }
  if (event.type === "error" && typeof event.message === "string") {
    return { type: "error", message: event.message };
  }

  return null;
}

export interface EventStreamOptions {
  deltas: AsyncIterable<string>;
  describe: (cause: unknown) => string;
  pending?: () => unknown;
}

/** Encode model output as answer events end with an error event if an error happens */
export function toEventStream({
  deltas,
  describe,
  pending,
}: EventStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      function send(event: AnswerEvent) {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      }

      try {
        for await (const text of deltas) {
          if (text.length > 0) send({ type: "delta", text });
        }
        const late = pending?.();
        if (late != null) send({ type: "error", message: describe(late) });
      } catch (cause) {
        send({ type: "error", message: describe(cause) });
      } finally {
        controller.close();
      }
    },
  });
}

export async function readAnswerStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let answer = "";
  let buffer = "";
  let failure: string | null = null;

  function handle(line: string) {
    const event = parseEvent(line);
    if (event === null) return;

    if (event.type === "delta") {
      answer += event.text;
      onDelta?.(event.text);
      return;
    }
    failure = event.message;
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }
    handle(buffer + decoder.decode());
  } finally {
    reader.releaseLock();
  }

  if (failure !== null) throw new AiRequestFailedError(failure, answer);
  return answer;
}

/** The message the server sent with a failed response, if it sent any */
async function failureMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: unknown }).error;
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // A response without a JSON body still has its status to report.
  }

  return `The request failed (${response.status}).`;
}

export interface AnswerRequestOptions {
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

/** POST a request and stream the answer back. Resolves with the whole answer. */
export async function requestAnswer(
  endpoint: string,
  payload: unknown,
  { signal, onDelta }: AnswerRequestOptions = {},
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (response.status === 503) {
    throw new AiUnavailableError("Cloud AI is not configured.");
  }
  if (!response.ok || !response.body) {
    throw new AiRequestFailedError(await failureMessage(response));
  }

  return readAnswerStream(response.body, onDelta);
}

/** Read a JSON response, turning a fail into an error messafe */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 503) {
    throw new AiUnavailableError("Cloud AI is not configured.");
  }
  if (!response.ok) {
    throw new AiRequestFailedError(await failureMessage(response));
  }

  return (await response.json()) as T;
}
