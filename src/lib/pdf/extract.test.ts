import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { toBlocks } from "./blocks";
import {
  extractDocument,
  readPageItems,
  type TextContentSource,
} from "./extract";
import { groupIntoLines } from "./lines";
import type { ExtractedPage, TableBlock, TextItem } from "./types";

const samplePath = fileURLToPath(
  new URL("../../../public/example-medical.pdf", import.meta.url),
);

/**
 * Each page laid out on its own before running so these
 * tests see the raw layout.
 */
let pages: ExtractedPage[] = [];
let items: TextItem[][] = [];

beforeAll(async () => {
  const data = new Uint8Array(readFileSync(samplePath));
  const pdf = await getDocument({ data, isEvalSupported: false }).promise;

  items = await readPageItems(pdf);
  pages = items.map((pageItems, index) => ({
    page: index + 1,
    blocks: toBlocks(groupIntoLines(pageItems, index + 1), index + 1),
  }));
});

function rowsOf(page: ExtractedPage): string[][] {
  return page.blocks
    .filter((b): b is TableBlock => b.kind === "table")
    .flatMap((t) => t.rows);
}

function headingsOf(page: ExtractedPage): string[] {
  return page.blocks.filter((b) => b.kind === "heading").map((b) => b.text);
}

function textOf(document: { pages: ExtractedPage[] }): string {
  return document.pages
    .flatMap((page) => page.blocks.map((block) => block.text))
    .join("\n");
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
    expect(rowsOf(pages[0]!).flat()).toContain("Patient Name: Smith, John");
  });
});

describe("extracting the same report as one document", () => {
  it("drops the running page header", () => {
    expect(textOf(extractDocument(items))).not.toMatch(/Page \d of 3/);
  });

  it("keeps the clinical content", () => {
    const text = textOf(extractDocument(items));

    expect(text).toContain("Pyelonephritis");
    expect(text).toContain("Creatinine");
  });

  it("reads a section title that carries a parenthetical", () => {
    const headings = extractDocument(items).pages.flatMap(headingsOf);

    expect(headings).toContain("DIAGNOSIS (Co-Morbidities and Risks)");
  });
});

function item(str: string, x: number, y: number, size = 10) {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width: str.length * size * 0.5,
    height: size,
  };
}

function fakePdf(pageItems: unknown[][]): TextContentSource {
  return {
    numPages: pageItems.length,
    getPage: (pageNumber: number) =>
      Promise.resolve({
        getTextContent: () =>
          Promise.resolve({ items: pageItems[pageNumber - 1] ?? [] }),
      }),
  };
}

describe("readPageItems", () => {
  it("reads every page in order", async () => {
    const document = extractDocument(
      await readPageItems(
        fakePdf([[item("PAGE ONE", 72, 700)], [item("PAGE TWO", 72, 700)]]),
      ),
    );

    expect(document.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(document.pages[0]?.blocks[0]?.text).toBe("PAGE ONE");
    expect(document.pages[1]?.blocks[0]?.text).toBe("PAGE TWO");
  });

  it("handles a document with no pages", async () => {
    expect(await readPageItems(fakePdf([]))).toEqual([]);
  });

  it("drops entries that are not positioned text runs", async () => {
    const [page] = await readPageItems(
      fakePdf([[{ type: "beginMarkedContent" }, item("Sodium", 72, 700)]]),
    );

    expect(page?.map((entry) => entry.str)).toEqual(["Sodium"]);
  });

  it("reports progress per page", async () => {
    const onProgress = vi.fn();
    await readPageItems(fakePdf([[item("a", 0, 0)], [item("b", 0, 0)]]), {
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    const pdf = fakePdf([[item("a", 0, 0)], [item("b", 0, 0)]]);

    await expect(
      readPageItems(pdf, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow();
  });
});
