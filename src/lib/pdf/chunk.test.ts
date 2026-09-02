import { describe, expect, it } from "vitest";

import { toChunks } from "./chunk";
import type { Block, ExtractedDocument } from "./types";

function doc(...pages: Block[][]): ExtractedDocument {
  return {
    pages: pages.map((blocks, index) => ({ page: index + 1, blocks })),
  };
}

function heading(text: string, level = 1, page = 1): Block {
  return { kind: "heading", page, text, level };
}

function paragraph(text: string, page = 1): Block {
  return { kind: "paragraph", page, text };
}

function table(rows: string[][], page = 1): Block {
  return {
    kind: "table",
    page,
    rows,
    text: rows.map((row) => row.join(" | ")).join("\n"),
  };
}

describe("toChunks", () => {
  it("returns nothing for an empty document", () => {
    expect(toChunks(doc())).toEqual([]);
  });

  it("keeps short prose under one heading in a single chunk", () => {
    const chunks = toChunks(
      doc([heading("Lipid panel"), paragraph("Total cholesterol is high.")]),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("Total cholesterol is high.");
    expect(chunks[0]?.headings).toEqual(["Lipid panel"]);
    expect(chunks[0]?.kind).toBe("prose");
  });

  it("starts a new chunk at every heading", () => {
    const chunks = toChunks(
      doc([
        heading("Findings"),
        paragraph("A."),
        heading("Impression"),
        paragraph("B."),
      ]),
    );

    expect(chunks.map((c) => c.text)).toEqual(["A.", "B."]);
    expect(chunks.map((c) => c.headings)).toEqual([
      ["Findings"],
      ["Impression"],
    ]);
  });

  it("nests headings by level and pops siblings", () => {
    const chunks = toChunks(
      doc([
        heading("Results", 1),
        heading("Chemistry", 2),
        paragraph("Sodium normal."),
        heading("Haematology", 2),
        paragraph("Haemoglobin low."),
      ]),
    );

    expect(chunks[0]?.headings).toEqual(["Results", "Chemistry"]);
    expect(chunks[1]?.headings).toEqual(["Results", "Haematology"]);
  });

  it("merges consecutive paragraphs until the size limit", () => {
    const chunks = toChunks(doc([paragraph("one."), paragraph("two.")]), {
      maxChars: 100,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("one. two.");
  });

  it("splits overflowing prose and overlaps the boundary", () => {
    const chunks = toChunks(
      doc([paragraph("alpha bravo charlie."), paragraph("delta echo.")]),
      { maxChars: 24, overlapChars: 10 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]?.text).toContain("delta echo.");
    expect(chunks[1]?.text.startsWith("delta")).toBe(false);
  });

  it("never exceeds maxChars for prose", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const chunks = toChunks(doc([paragraph(`${long}.`)]), {
      maxChars: 60,
      overlapChars: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks)
      expect(chunk.text.length).toBeLessThanOrEqual(60);
  });

  it("splits a single word longer than the limit", () => {
    const chunks = toChunks(doc([paragraph("x".repeat(50))]), {
      maxChars: 20,
      overlapChars: 0,
    });

    expect(chunks.length).toBeGreaterThan(0);
  });

  it("keeps a small table whole and separate from prose", () => {
    const chunks = toChunks(
      doc([
        paragraph("Intro."),
        table([
          ["Test", "Result"],
          ["HDL", "1.2"],
        ]),
      ]),
    );

    expect(chunks.map((c) => c.kind)).toEqual(["prose", "table"]);
    expect(chunks[1]?.text).toBe("Test | Result\nHDL | 1.2");
  });

  it("repeats the header row when a table is split", () => {
    const rows = [["Test", "Result"]];
    for (let i = 0; i < 20; i += 1) rows.push([`Analyte ${i}`, `${i}`]);

    const chunks = toChunks(doc([table(rows)]), { maxChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.kind).toBe("table");
      expect(chunk.text.startsWith("Test | Result")).toBe(true);
    }
  });

  it("carries headings onto table chunks", () => {
    const chunks = toChunks(
      doc([
        heading("Lipid panel"),
        table([
          ["Test", "Result"],
          ["HDL", "1.2"],
        ]),
      ]),
    );

    expect(chunks[0]?.headings).toEqual(["Lipid panel"]);
  });

  it("records the page span of prose that crosses a page break", () => {
    const chunks = toChunks(
      doc([paragraph("Page one text.", 1)], [paragraph("Page two text.", 2)]),
      { maxChars: 200 },
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.endPage).toBe(2);
  });

  it("gives every chunk a unique id scoped to its page", () => {
    const chunks = toChunks(
      doc([
        heading("A"),
        paragraph("first."),
        heading("B"),
        paragraph("second."),
      ]),
    );

    expect(chunks.map((c) => c.id)).toEqual(["p1#1", "p1#2"]);
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it("ignores blank blocks", () => {
    expect(toChunks(doc([paragraph("   ")]))).toEqual([]);
  });
});
