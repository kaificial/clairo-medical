import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";

import { extractPage, fromPdfJsItems } from "./extract";
import type { ExtractedPage, TableBlock } from "./types";

const samplePath = fileURLToPath(
  new URL("../../../public/example-medical.pdf", import.meta.url),
);

let pages: ExtractedPage[] = [];

beforeAll(async () => {
  const data = new Uint8Array(readFileSync(samplePath));
  const doc = await getDocument({ data, isEvalSupported: false }).promise;

  pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(extractPage(fromPdfJsItems(content.items), n));
  }
});

function rowsOf(page: ExtractedPage): string[][] {
  return page.blocks
    .filter((b): b is TableBlock => b.kind === "table")
    .flatMap((t) => t.rows);
}

function headingsOf(page: ExtractedPage): string[] {
  return page.blocks.filter((b) => b.kind === "heading").map((b) => b.text);
}

describe("extracting a real discharge summary", () => {
  it("reads every page", () => {
    expect(pages).toHaveLength(3);
  });

  it("recognises section titles as headings", () => {
    const all = pages.flatMap(headingsOf);

    expect(all).toContain("GENERAL INTERNAL MEDICINE DISCHARGE SUMMARY");
    expect(all).toContain("VISIT ENCOUNTER");
    expect(all).toContain("DISCHARGE PLAN");
  });

  it("keeps a lab result row as separate columns", () => {
    const alt = rowsOf(pages[1]!).find((row) => row.includes("ALT"));

    expect(alt).toBeDefined();
    expect(alt).toContain("1001");
    expect(alt).toContain("IU/L");
    expect(alt!.length).toBeGreaterThanOrEqual(4);
  });

  it("does not flatten a result and its unit into one cell", () => {
    for (const row of rowsOf(pages[1]!)) {
      for (const cell of row) {
        expect(cell).not.toMatch(/\d+\s+(IU\/L|mmol\/L|mg\/dL)$/);
      }
    }
  });

  it("keeps the lab table header row", () => {
    const header = rowsOf(pages[1]!).find((row) => row[0] === "Test");

    expect(header).toEqual(["Test", "Test Date", "Results", "Units"]);
  });

  it("keeps a label and its value together in one cell", () => {
    const cells = rowsOf(pages[0]!).flat();

    expect(cells).toContain("Patient Name: Smith, John");
  });
});
