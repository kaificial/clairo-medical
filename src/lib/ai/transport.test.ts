import { describe, expect, it, vi } from "vitest";

import { AiRequestFailedError, AiUnavailableError } from "./errors";
import {
  encodeEvent,
  parseEvent,
  readAnswerStream,
  requestAnswer,
  toEventStream,
} from "./transport";

async function* deltas(...values: string[]): AsyncGenerator<string> {
  for (const value of values) yield value;
}

function bodyOf(...lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

describe("parseEvent", () => {
  it("reads the events the server writes", () => {
    expect(parseEvent(encodeEvent({ type: "delta", text: "hi" }))).toEqual({
      type: "delta",
      text: "hi",
    });
  });

  it("skips anything it does not recognise", () => {
    expect(parseEvent("")).toBeNull();
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent('{"type":"delta"}')).toBeNull();
    expect(parseEvent('{"type":"other","text":"x"}')).toBeNull();
  });
});

describe("toEventStream", () => {
  it("sends each delta as its own event", async () => {
    const text = await collect(
      toEventStream({ deltas: deltas("Cre", "atinine"), describe: () => "no" }),
    );

    expect(text).toBe(
      '{"type":"delta","text":"Cre"}\n{"type":"delta","text":"atinine"}\n',
    );
  });

  it("ends with an error event when the stream throws", async () => {
    async function* failing(): AsyncGenerator<string> {
      yield "partial";
      throw new Error("upstream");
    }

    const text = await collect(
      toEventStream({ deltas: failing(), describe: () => "provider refused" }),
    );

    expect(text).toContain('{"type":"delta","text":"partial"}');
    expect(text).toContain('{"type":"error","message":"provider refused"}');
  });

  it("reports a failure the provider raised outside the text stream", async () => {
    const text = await collect(
      toEventStream({
        deltas: deltas(),
        describe: () => "provider refused",
        pending: () => new Error("mid-stream"),
      }),
    );

    expect(text).toBe('{"type":"error","message":"provider refused"}\n');
  });
});

describe("readAnswerStream", () => {
  it("reassembles deltas split across chunks", async () => {
    const seen: string[] = [];
    const answer = await readAnswerStream(
      bodyOf(
        '{"type":"delta","text":"Cre"}\n{"type":"del',
        'ta","text":"a"}\n',
      ),
      (delta) => seen.push(delta),
    );

    expect(answer).toBe("Crea");
    expect(seen).toEqual(["Cre", "a"]);
  });

  it("reads a final line that arrives without its newline", async () => {
    const answer = await readAnswerStream(
      bodyOf('{"type":"delta","text":"x"}'),
    );

    expect(answer).toBe("x");
  });

  it("throws on an error event, keeping what had already arrived", async () => {
    const failing = readAnswerStream(
      bodyOf(
        '{"type":"delta","text":"half"}\n{"type":"error","message":"card needed"}\n',
      ),
    );

    await expect(failing).rejects.toThrow(AiRequestFailedError);
    await failing.catch((cause: AiRequestFailedError) => {
      expect(cause.message).toBe("card needed");
      expect(cause.partial).toBe("half");
    });
  });
});

describe("requestAnswer", () => {
  it("reports an unconfigured server distinctly, so callers can drop the feature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, body: null }),
    );

    await expect(requestAnswer("/api/chat", {})).rejects.toThrow(
      AiUnavailableError,
    );
  });

  it("surfaces the message the server sent with a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        body: null,
        json: () => Promise.resolve({ error: "Add a card." }),
      }),
    );

    await expect(requestAnswer("/api/chat", {})).rejects.toThrow("Add a card.");
  });

  it("falls back to the status when the failure has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        json: () => Promise.reject(new Error("no body")),
      }),
    );

    await expect(requestAnswer("/api/chat", {})).rejects.toThrow("(500)");
  });
});
