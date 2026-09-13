import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { extractLabRows } from "./lab-extraction";

const passages: Chunk[] = [
  {
    id: "p2#1",
    text: "Serum lactate was elevated at 6.1. After 12 hours serum lactate had normalized.",
    page: 2,
    endPage: 2,
    headings: ["COURSE WHILE IN HOSPITAL"],
    kind: "prose",
  },
];

function modelReturning(results: unknown[]) {
  const calls: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options.prompt);
      return {
        content: [{ type: "text", text: JSON.stringify({ results }) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, calls };
}

describe("extractLabRows", () => {
  it("keeps grounded results and discards invented ones", async () => {
    const { model, calls } = modelReturning([
      {
        name: "Serum lactate",
        value: "6.1",
        unit: null,
        referenceRange: null,
        flag: null,
        date: null,
        page: 2,
      },
      {
        name: "Serum lactate",
        value: "1.4",
        unit: "mmol/L",
        referenceRange: "0.5-2.2",
        flag: null,
        date: null,
        page: 2,
      },
    ]);

    const result = await extractLabRows({ model, passages });

    expect(result.discarded).toBe(1);
    expect(result.rows).toEqual([
      expect.objectContaining({
        name: "Serum lactate",
        value: 6.1,
        source: "model",
        page: 2,
      }),
    ]);
    expect(JSON.stringify(calls[0])).toContain("p.2");
  });

  it("does not call the model with nothing to read", async () => {
    const { model, calls } = modelReturning([]);
    expect(await extractLabRows({ model, passages: [] })).toEqual({
      rows: [],
      discarded: 0,
    });
    expect(calls).toHaveLength(0);
  });
});
