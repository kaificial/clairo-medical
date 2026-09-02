import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { buildLexicalIndex } from "./bm25";

function chunk(id: string, text: string, headings: string[] = []): Chunk {
  return {
    id,
    text,
    page: Number(id.replace(/\D/g, "")) || 1,
    endPage: Number(id.replace(/\D/g, "")) || 1,
    headings,
    kind: "prose",
  };
}

const CHUNKS: Chunk[] = [
  chunk("p1#1", "Patient presented with fever and urinary frequency.", [
    "COURSE WHILE IN HOSPITAL",
  ]),
  chunk("p2#1", "Creatinine 170 umol/L on admission, 66 on discharge.", [
    "Investigations",
  ]),
  chunk("p2#2", "Liver enzymes remain elevated. ALT 1001 IU/L.", [
    "Investigations",
  ]),
  chunk("p3#1", "Ciprofloxacin 500 mg twice daily for 7 days.", [
    "DISCHARGE PLAN",
  ]),
];

describe("buildLexicalIndex", () => {
  it("reports how many chunks it holds", () => {
    expect(buildLexicalIndex(CHUNKS).size).toBe(4);
  });

  it("ranks the chunk that answers the query first", () => {
    const hits = buildLexicalIndex(CHUNKS).search("creatinine");

    expect(hits[0]?.chunk.id).toBe("p2#1");
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it("finds a chunk by a value that appears in it", () => {
    const hits = buildLexicalIndex(CHUNKS).search("1001");
    expect(hits[0]?.chunk.id).toBe("p2#2");
  });

  it("matches a section title through the heading trail", () => {
    const hits = buildLexicalIndex(CHUNKS).search("discharge plan");
    expect(hits[0]?.chunk.id).toBe("p3#1");
  });

  it("matches a plural query against singular text", () => {
    const hits = buildLexicalIndex(CHUNKS).search("liver enzymes");
    expect(hits[0]?.chunk.id).toBe("p2#2");
  });

  it("returns nothing when no chunk contains the query", () => {
    expect(buildLexicalIndex(CHUNKS).search("radiotherapy")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(buildLexicalIndex(CHUNKS).search("   ")).toEqual([]);
  });

  it("handles an empty document", () => {
    const index = buildLexicalIndex([]);
    expect(index.size).toBe(0);
    expect(index.search("creatinine")).toEqual([]);
  });

  it("honours the result limit", () => {
    expect(buildLexicalIndex(CHUNKS).search("discharge", 1)).toHaveLength(1);
  });

  it("prefers the shorter chunk when a term appears in both", () => {
    const hits = buildLexicalIndex([
      chunk("p1#1", "Sodium normal."),
      chunk(
        "p1#2",
        `Sodium normal. ${"Additional unrelated narrative text. ".repeat(20)}`,
      ),
    ]).search("sodium");

    expect(hits[0]?.chunk.id).toBe("p1#1");
  });

  it("orders equally scoring chunks deterministically", () => {
    const twice = () =>
      buildLexicalIndex([
        chunk("p2#1", "Fever noted."),
        chunk("p1#1", "Fever noted."),
      ])
        .search("fever")
        .map((hit) => hit.chunk.id);

    expect(twice()).toEqual(["p1#1", "p2#1"]);
    expect(twice()).toEqual(twice());
  });
});
