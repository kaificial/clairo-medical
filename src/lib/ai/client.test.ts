import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiRequestFailedError,
  AiUnavailableError,
  askQuestion,
  embedViaApi,
  failureMessage,
} from "./client";
import { encodeEvent } from "./transport";

function respond(body: BodyInit | null, init: ResponseInit = {}) {
  const fetch = vi.fn(async () => new Response(body, init));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askQuestion", () => {
  it("reads answer events, not the raw wire format", async () => {
    respond(
      encodeEvent({ type: "delta", text: "ALT is high " }) +
        encodeEvent({ type: "delta", text: "[p.2]." }),
    );

    const deltas: string[] = [];
    const answer = await askQuestion({
      question: "What is high?",
      passages: [],
      onDelta: (delta) => deltas.push(delta),
    });

    expect(answer).toBe("ALT is high [p.2].");
    expect(deltas).toEqual(["ALT is high ", "[p.2]."]);
  });

  it("surfaces the server's own message when it refuses", async () => {
    respond(
      JSON.stringify({ error: "Too many requests. Try again in 9 seconds." }),
      { status: 429 },
    );

    await expect(
      askQuestion({ question: "Hi", passages: [] }),
    ).rejects.toMatchObject({
      name: "AiRequestFailedError",
      message: "Too many requests. Try again in 9 seconds.",
    });
  });

  it("falls back to the status when a failure has no body", async () => {
    respond(null, { status: 500 });

    await expect(askQuestion({ question: "Hi", passages: [] })).rejects.toThrow(
      "(500)",
    );
  });

  it("keeps a half written answer when the stream fails midway", async () => {
    respond(
      encodeEvent({ type: "delta", text: "Partial" }) +
        encodeEvent({ type: "error", message: "The AI model is busy." }),
    );

    const failure = await askQuestion({ question: "Hi", passages: [] }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AiRequestFailedError);
    expect((failure as AiRequestFailedError).message).toBe(
      "The AI model is busy.",
    );
    expect((failure as AiRequestFailedError).partial).toBe("Partial");
  });

  it("reports an unconfigured server as unavailable", async () => {
    respond(JSON.stringify({ error: "No AI provider" }), { status: 503 });

    await expect(
      askQuestion({ question: "Hi", passages: [] }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe("embedViaApi", () => {
  it("posts the values and returns one vector per value", async () => {
    const fetch = respond(JSON.stringify({ embeddings: [[1, 0]] }));
    const controller = new AbortController();

    expect(await embedViaApi(["creatinine"], controller.signal)).toEqual([
      [1, 0],
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/embed",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ values: ["creatinine"] }),
        signal: controller.signal,
      }),
    );
  });

  it("treats any other failure as an error worth surfacing", async () => {
    respond(JSON.stringify({ error: "upstream" }), { status: 502 });

    await expect(embedViaApi(["x"])).rejects.toThrow(AiRequestFailedError);
  });
});

describe("failureMessage", () => {
  it("prefers the server's explanation", () => {
    expect(failureMessage(new AiRequestFailedError("Busy."), "Failed.")).toBe(
      "Busy.",
    );
    expect(failureMessage(new TypeError("fetch failed"), "Failed.")).toBe(
      "Failed.",
    );
  });
});
