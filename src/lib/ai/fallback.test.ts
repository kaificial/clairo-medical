import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  firstThatAnswers,
  streamFirstThatAnswers,
  type NamedModel,
} from "./fallback";
import type { ChatPrompt } from "./prompt";

const prompt: ChatPrompt = {
  instructions: "Answer briefly.",
  messages: [{ role: "user", content: "What is potassium?" }],
};

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

type StreamPart =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "error"; error: unknown };

function streaming(id: string, parts: StreamPart[]): NamedModel {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          ...parts,
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ],
      }),
    }),
  });
  return { id, model };
}

function says(id: string, ...words: string[]): NamedModel {
  return streaming(
    id,
    words.map((delta) => ({ type: "text-delta", id: "t", delta })),
  );
}

function refuses(id: string, error = new Error("overloaded")): NamedModel {
  const model = new MockLanguageModelV4({
    doStream: async () => {
      throw error;
    },
    doGenerate: async () => {
      throw error;
    },
  });
  return { id, model };
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const delta of stream) text += delta;
  return text;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamFirstThatAnswers", () => {
  it("uses the main model when it answers", async () => {
    const { deltas, failure } = await streamFirstThatAnswers(
      [says("main", "Hello", " there"), says("backup", "Nope")],
      prompt,
    );

    expect(await collect(deltas)).toBe("Hello there");
    expect(failure()).toBeUndefined();
  });

  it("moves to the backup when the main model fails before answering", async () => {
    const { deltas, failure } = await streamFirstThatAnswers(
      [refuses("main"), says("backup", "From", " the backup")],
      prompt,
    );

    expect(await collect(deltas)).toBe("From the backup");
    expect(failure()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "[ai] main failed, trying backup",
    );
  });

  it("keeps the partial answer and reports the error when a model breaks midway", async () => {
    const backup = says("backup", "Should not appear");
    const { deltas, failure } = await streamFirstThatAnswers(
      [
        streaming("main", [
          { type: "text-delta", id: "t", delta: "Half an" },
          { type: "error", error: new Error("connection reset") },
        ]),
        backup,
      ],
      prompt,
    );

    expect(await collect(deltas)).toBe("Half an");
    expect(failure()).toBeInstanceOf(Error);
    expect((backup.model as MockLanguageModelV4).doStreamCalls).toHaveLength(0);
  });

  it("reports the last error when every model fails", async () => {
    const last = new Error("backup is down too");
    const { deltas, failure } = await streamFirstThatAnswers(
      [refuses("main"), refuses("backup", last)],
      prompt,
    );

    expect(await collect(deltas)).toBe("");
    expect(failure()).toBe(last);
  });
});

describe("firstThatAnswers", () => {
  it("returns the first success", async () => {
    const run = vi.fn(async ({ id }: NamedModel) => {
      if (id === "main") throw new Error("busy");
      return `answered by ${id}`;
    });

    await expect(
      firstThatAnswers([refuses("main"), says("backup")], run),
    ).resolves.toBe("answered by backup");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when every model fails", async () => {
    const last = new Error("still busy");
    const run = vi.fn(async ({ id }: NamedModel) => {
      throw id === "backup" ? last : new Error("busy");
    });

    await expect(
      firstThatAnswers([refuses("main"), refuses("backup")], run),
    ).rejects.toBe(last);
  });

  it("stops at once when the reader has gone", async () => {
    const controller = new AbortController();
    controller.abort();
    const run = vi.fn(async () => {
      throw new Error("aborted");
    });

    await expect(
      firstThatAnswers(
        [refuses("main"), refuses("backup")],
        run,
        controller.signal,
      ),
    ).rejects.toThrow("aborted");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
