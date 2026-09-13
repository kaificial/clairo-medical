import { describe, expect, it, vi } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { lexicalStrategy } from "./lexical";
import {
  fuseRankings,
  hybridSearch,
  type RetrievalHit,
  type Strategy,
} from "./search";

function hit(id: string, score = 1): RetrievalHit {
  const chunk: Chunk = {
    id,
    text: id,
    page: 1,
    endPage: 1,
    headings: [],
    kind: "prose",
  };
  return { chunk, score };
}

function ids(hits: RetrievalHit[]): string[] {
  return hits.map((h) => h.chunk.id);
}

function returning(hits: RetrievalHit[] | Error): Strategy {
  return () =>
    hits instanceof Error ? Promise.reject(hits) : Promise.resolve(hits);
}

describe("fuseRankings", () => {
  it("ranks a chunk both lists agree on above one only a single list found", () => {
    const lexical = [hit("a", 9), hit("b", 8)];
    const dense = [hit("c", 0.9), hit("a", 0.8)];

    expect(ids(fuseRankings([lexical, dense]))[0]).toBe("a");
  });

  it("keeps chunks that appear in only one list", () => {
    const fused = fuseRankings([[hit("a")], [hit("b")]]);
    expect(ids(fused).sort()).toEqual(["a", "b"]);
  });

  it("ignores the incomparable scores of the inputs", () => {
    const lexical = [hit("a", 1000), hit("b", 1)];
    const dense = [hit("b", 0.99), hit("a", 0.01)];
    const fused = fuseRankings([lexical, dense]);

    expect(fused[0]?.score).toBeCloseTo(fused[1]?.score ?? 0);
  });

  it("passes a single list through in its original order", () => {
    const single = [hit("a", 3), hit("b", 2), hit("c", 1)];
    expect(ids(fuseRankings([single]))).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for no rankings", () => {
    expect(fuseRankings([])).toEqual([]);
    expect(fuseRankings([[], []])).toEqual([]);
  });

  it("honours the limit", () => {
    expect(fuseRankings([[hit("a"), hit("b"), hit("c")]], 2)).toHaveLength(2);
  });

  it("breaks ties deterministically", () => {
    expect(ids(fuseRankings([[hit("p2#1")], [hit("p1#1")]]))).toEqual([
      "p1#1",
      "p2#1",
    ]);
  });
});

describe("hybridSearch", () => {
  const chunks = [
    hit("p1#1").chunk,
    { ...hit("p1#2").chunk, text: "Ciprofloxacin 500 mg twice daily." },
  ];

  it("passes a single strategy through", async () => {
    const search = hybridSearch([lexicalStrategy(chunks)]);
    expect(ids(await search("ciprofloxacin"))).toEqual(["p1#2"]);
  });

  it("fuses two strategies", async () => {
    const search = hybridSearch([
      returning([hit("a"), hit("b")]),
      returning([hit("b"), hit("a")]),
    ]);

    expect(await search("anything")).toHaveLength(2);
  });

  it("still answers when a strategy fails", async () => {
    const search = hybridSearch([
      returning(new Error("network down")),
      returning([hit("a")]),
    ]);

    expect(ids(await search("creatinine"))).toEqual(["a"]);
  });

  it("returns nothing when every strategy fails or there are none", async () => {
    const failing = hybridSearch([returning(new Error("down"))]);

    expect(await failing("creatinine")).toEqual([]);
    expect(await hybridSearch([])("creatinine")).toEqual([]);
  });

  it("returns nothing for an empty query without calling a strategy", async () => {
    const strategy = vi.fn<Strategy>();

    expect(await hybridSearch([strategy])("   ")).toEqual([]);
    expect(strategy).not.toHaveBeenCalled();
  });

  it("asks each strategy for more than the caller wants", async () => {
    const strategy = vi.fn<Strategy>().mockResolvedValue([]);
    await hybridSearch([strategy])("x", 3);

    expect(strategy).toHaveBeenCalledWith("x", 10);
  });

  it("honours the limit after fusion", async () => {
    const search = hybridSearch([
      returning([hit("a"), hit("b")]),
      returning([hit("a"), hit("b")]),
    ]);

    expect(await search("anything", 1)).toHaveLength(1);
  });
});
