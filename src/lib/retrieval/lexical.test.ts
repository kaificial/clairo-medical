import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { lexicalStrategy, tokenize } from "./lexical";

describe("tokenize", () => {
  it("lowercases and drops punctuation", () => {
    expect(tokenize("Acute kidney injury.")).toEqual([
      "acute",
      "kidney",
      "injury",
    ]);
  });

  it("keeps decimal results whole", () => {
    expect(tokenize("Lactate 6.1 mmol/L")).toContain("6.1");
  });

  it("splits a unit into searchable parts", () => {
    expect(tokenize("450 IU/L")).toEqual(["450", "iu"]);
  });

  it("drops stop words", () => {
    expect(tokenize("the patient was in the hospital")).toEqual([
      "patient",
      "hospital",
    ]);
  });

  it("matches a plural query to a singular term", () => {
    expect(tokenize("kidneys")).toEqual(tokenize("kidney"));
  });

  it("leaves words that merely end in s alone", () => {
    expect(tokenize("sepsis")).toEqual(["sepsis"]);
  });

  it("returns nothing for empty input", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

function chunk(id: string, text: string, headings: string[] = []): Chunk {
  const page = Number(id.replace(/\D/g, "")) || 1;
  return { id, text, page, endPage: page, headings, kind: "prose" };
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

async function ids(chunks: readonly Chunk[], query: string, limit = 5) {
  const hits = await lexicalStrategy(chunks)(query, limit);
  return hits.map((hit) => hit.chunk.id);
}

describe("lexicalStrategy", () => {
  it("ranks the chunk that answers the query first", async () => {
    const [top] = await lexicalStrategy(CHUNKS)("creatinine", 5);

    expect(top?.chunk.id).toBe("p2#1");
    expect(top?.score).toBeGreaterThan(0);
  });

  it("finds a chunk by a value that appears in it", async () => {
    expect((await ids(CHUNKS, "1001"))[0]).toBe("p2#2");
  });

  it("matches a section title through the heading trail", async () => {
    expect((await ids(CHUNKS, "discharge plan"))[0]).toBe("p3#1");
  });

  it("matches a plural query against singular text", async () => {
    expect((await ids(CHUNKS, "liver enzymes"))[0]).toBe("p2#2");
  });

  it("returns nothing when no chunk contains the query", async () => {
    expect(await ids(CHUNKS, "radiotherapy")).toEqual([]);
  });

  it("returns nothing for an empty query or document", async () => {
    expect(await ids(CHUNKS, "   ")).toEqual([]);
    expect(await ids([], "creatinine")).toEqual([]);
  });

  it("honours the result limit", async () => {
    expect(await ids(CHUNKS, "discharge", 1)).toHaveLength(1);
  });

  it("prefers the shorter chunk when a term appears in both", async () => {
    const chunks = [
      chunk("p1#1", "Sodium normal."),
      chunk(
        "p1#2",
        `Sodium normal. ${"Additional unrelated narrative text. ".repeat(20)}`,
      ),
    ];

    expect((await ids(chunks, "sodium"))[0]).toBe("p1#1");
  });

  it("orders equally scoring chunks deterministically", async () => {
    const chunks = [
      chunk("p2#1", "Fever noted."),
      chunk("p1#1", "Fever noted."),
    ];

    expect(await ids(chunks, "fever")).toEqual(["p1#1", "p2#1"]);
  });
});
