import { afterEach, describe, expect, it, vi } from "vitest";

import { askQuestion } from "./chat-client";
import { AiRequestFailedError, AiUnavailableError } from "./errors";
import { encodeEvent } from "./transport";

function respond(body: BodyInit, init: ResponseInit = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, init)),
  );
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
      {
        status: 429,
      },
    );

    await expect(
      askQuestion({ question: "Hi", passages: [] }),
    ).rejects.toMatchObject({
      name: "AiRequestFailedError",
      message: "Too many requests. Try again in 9 seconds.",
    });
  });

  it("keeps a half written answer when the stream fails midway", async () => {
    respond(
      encodeEvent({ type: "delta", text: "Partial" }) +
        encodeEvent({
          type: "error",
          message: "The AI model is busy right now.",
        }),
    );

    const failure = await askQuestion({ question: "Hi", passages: [] }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AiRequestFailedError);
    expect((failure as AiRequestFailedError).partial).toBe("Partial");
  });

  it("reports an unconfigured server as unavailable", async () => {
    respond(JSON.stringify({ error: "No AI provider" }), { status: 503 });
    await expect(
      askQuestion({ question: "Hi", passages: [] }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
