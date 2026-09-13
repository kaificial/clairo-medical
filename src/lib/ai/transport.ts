/**
 * Answers stream as newline delimited JSON rather than plain text. With plain
 * text, a provider failing halfway looks exactly like an answer that just
 * stopped; an error event lets the reader see what went wrong.
 */
type AnswerEvent =
  { type: "delta"; text: string } | { type: "error"; message: string };

export const ANSWER_CONTENT_TYPE = "application/x-ndjson";

export function encodeEvent(event: AnswerEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Reads one line of the stream. Anything we don't recognise is skipped rather
 * than shown.
 */
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

/**
 * Turns model output into events. If the stream throws, or `failure` reports an
 * error the provider raised on the side, the last event says what happened.
 */
export function toEventStream({
  deltas,
  describe,
  failure,
}: {
  deltas: AsyncIterable<string>;
  describe: (cause: unknown) => string;
  failure?: () => unknown;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: AnswerEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        for await (const text of deltas) {
          if (text.length > 0) send({ type: "delta", text });
        }
        const late = failure?.();
        if (late != null) send({ type: "error", message: describe(late) });
      } catch (cause) {
        send({ type: "error", message: describe(cause) });
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Puts an answer back together from its events. `failure` is the message from
 * an error event, and `text` is whatever arrived before it, kept so a half
 * written answer isn't lost.
 */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<{ text: string; failure: string | null }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let text = "";
  let buffer = "";
  let failure: string | null = null;

  function handle(line: string) {
    const event = parseEvent(line);
    if (event?.type === "delta") {
      text += event.text;
      onDelta?.(event.text);
    } else if (event?.type === "error") {
      failure = event.message;
    }
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

  return { text, failure };
}
