import { describe, expect, it, vi } from "vitest";

import type { Chunk } from "@/lib/pdf";

import type { RetrievalHit } from "./bm25";
import {
  createRetrievalService,
  lexicalStrategy,
  type RetrievalStrategy,
} from "./service";

function chunk(id: string, text: string): Chunk {
  return { id, text, page: 1, endPage: 1, headings: [], kind: "prose" };
}

const CHUNKS = [
  chunk("p1#1", "Creatinine 170 umol/L on admission."),
  chunk("p1#2", "Ciprofloxacin 500 mg twice daily."),
];

function fakeStrategy(
  name: string,
  hits: RetrievalHit[] | Error,
): RetrievalStrategy {
  return {
    name,
    search: () =>
      hits instanceof Error ? Promise.reject(hits) : Promise.resolve(hits),
  };
}

const HIT_A: RetrievalHit = { chunk: CHUNKS[0]!, score: 1 };
const HIT_B: RetrievalHit = { chunk: CHUNKS[1]!, score: 1 };

describe("lexicalStrategy", () => {
  it("searches the chunks it was built from", async () => {
    const hits = await lexicalStrategy(CHUNKS).search("creatinine", 5);
    expect(hits[0]?.chunk.id).toBe("p1#1");
  });
});

describe("createRetrievalService", () => {
  it("names the strategies it runs", () => {
    const service = createRetrievalService([lexicalStrategy(CHUNKS)]);
    expect(service.strategies).toEqual(["lexical"]);
  });

  it("passes a single strategy through", async () => {
    const service = createRetrievalService([lexicalStrategy(CHUNKS)]);
    const hits = await service.search("ciprofloxacin");

    expect(hits.map((h) => h.chunk.id)).toEqual(["p1#2"]);
  });

  it("fuses two strategies", async () => {
    const service = createRetrievalService([
      fakeStrategy("one", [HIT_A, HIT_B]),
      fakeStrategy("two", [HIT_B, HIT_A]),
    ]);

    expect(await service.search("anything")).toHaveLength(2);
  });

  it("still answers when a strategy fails", async () => {
    const service = createRetrievalService([
      fakeStrategy("dense", new Error("gateway unreachable")),
      fakeStrategy("lexical", [HIT_A]),
    ]);

    const hits = await service.search("creatinine");
    expect(hits.map((h) => h.chunk.id)).toEqual(["p1#1"]);
  });

  it("returns nothing when every strategy fails", async () => {
    const service = createRetrievalService([
      fakeStrategy("dense", new Error("down")),
      fakeStrategy("lexical", new Error("down")),
    ]);

    expect(await service.search("creatinine")).toEqual([]);
  });

  it("returns nothing for an empty query without calling a strategy", async () => {
    const search = vi.fn();
    const service = createRetrievalService([{ name: "spy", search }]);

    expect(await service.search("   ")).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("returns nothing when there are no strategies", async () => {
    expect(await createRetrievalService([]).search("creatinine")).toEqual([]);
  });

  it("asks each strategy for more than the caller wants", async () => {
    const search = vi.fn().mockResolvedValue([]);
    await createRetrievalService([{ name: "spy", search }]).search("x", 3);

    expect(search).toHaveBeenCalledWith("x", 10);
  });

  it("honours the limit after fusion", async () => {
    const service = createRetrievalService([
      fakeStrategy("one", [HIT_A, HIT_B]),
      fakeStrategy("two", [HIT_A, HIT_B]),
    ]);

    expect(await service.search("anything", 1)).toHaveLength(1);
  });
});
