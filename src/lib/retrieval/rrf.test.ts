import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import type { RetrievalHit } from "./bm25";
import { fuseRankings } from "./rrf";

function hit(id: string, score: number): RetrievalHit {
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

describe("fuseRankings", () => {
  it("ranks a chunk both lists agree on above one only a single list found", () => {
    const lexical = [hit("a", 9), hit("b", 8)];
    const dense = [hit("c", 0.9), hit("a", 0.8)];

    expect(ids(fuseRankings([lexical, dense]))[0]).toBe("a");
  });

  it("keeps chunks that appear in only one list", () => {
    const fused = fuseRankings([[hit("a", 1)], [hit("b", 1)]]);
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
    const fused = fuseRankings([[hit("a", 3), hit("b", 2), hit("c", 1)]], {
      limit: 2,
    });
    expect(fused).toHaveLength(2);
  });

  it("lets a smaller k sharpen the advantage of a top rank", () => {
    const rankings = [
      [hit("a", 1), hit("b", 1)],
      [hit("b", 1), hit("a", 1)],
    ];
    const gentle = fuseRankings(rankings, { k: 60 });
    const sharp = fuseRankings(rankings, { k: 1 });

    const spread = (hits: RetrievalHit[]) =>
      Math.abs((hits[0]?.score ?? 0) - (hits[1]?.score ?? 0));

    expect(spread(sharp)).toBeGreaterThanOrEqual(spread(gentle));
  });

  it("breaks ties deterministically", () => {
    const run = () => ids(fuseRankings([[hit("p2#1", 1)], [hit("p1#1", 1)]]));
    expect(run()).toEqual(["p1#1", "p2#1"]);
    expect(run()).toEqual(run());
  });
});
