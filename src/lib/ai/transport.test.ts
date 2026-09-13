import { describe, expect, it } from "vitest";

import {
  encodeEvent,
  parseEvent,
  readEventStream,
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
  return new Response(stream).text();
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
        failure: () => new Error("mid-stream"),
      }),
    );

    expect(text).toBe('{"type":"error","message":"provider refused"}\n');
  });
});

describe("readEventStream", () => {
  it("reassembles deltas split across chunks", async () => {
    const seen: string[] = [];
    const { text } = await readEventStream(
      bodyOf(
        '{"type":"delta","text":"Cre"}\n{"type":"del',
        'ta","text":"a"}\n',
      ),
      (delta) => seen.push(delta),
    );

    expect(text).toBe("Crea");
    expect(seen).toEqual(["Cre", "a"]);
  });

  it("reads a final line that arrives without its newline", async () => {
    const { text } = await readEventStream(
      bodyOf('{"type":"delta","text":"x"}'),
    );
    expect(text).toBe("x");
  });

  it("reports an error event alongside what had already arrived", async () => {
    const result = await readEventStream(
      bodyOf(
        '{"type":"delta","text":"half"}\n{"type":"error","message":"busy"}\n',
      ),
    );

    expect(result).toEqual({ text: "half", failure: "busy" });
  });
});
