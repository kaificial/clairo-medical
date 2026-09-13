import { toBlocks } from "./blocks";
import { stripFurniture } from "./furniture";
import { groupIntoLines } from "./lines";
import type { ExtractedDocument, TextItem } from "./types";

/**
 * Just the part of pdf.js's PDFDocumentProxy we use to read text
 */
export interface TextContentSource {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: readonly unknown[] }>;
  }>;
}

function isTextItem(value: unknown): value is TextItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<TextItem>;
  return (
    typeof item.str === "string" &&
    Array.isArray(item.transform) &&
    typeof item.width === "number" &&
    typeof item.height === "number"
  );
}

/**
 * pdf.js mixes marked content entries in with the text
 * We only want the positioned runs of text.
 */
function fromPdfJsItems(items: readonly unknown[]): TextItem[] {
  return items.filter(isTextItem).map((item) => ({
    str: item.str,
    transform: item.transform,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
  }));
}

/**
 * The positioned text of every page before any layout analysis.
 * So OCR results can be swapped in later.
 */
export async function readPageItems(
  pdf: TextContentSource,
  {
    signal,
    onProgress,
  }: {
    signal?: AbortSignal;
    onProgress?: (page: number, total: number) => void;
  } = {},
): Promise<TextItem[][]> {
  const pages: TextItem[][] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    signal?.throwIfAborted();
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(fromPdfJsItems(content.items));
    onProgress?.(pageNumber, pdf.numPages);
  }

  return pages;
}

/**
 * Turns every page text into headings, paragraphs and tables. Running headers
 * and footers only show up when you compare pages so this works on the whole
 * document
 */
export function extractDocument(pages: TextItem[][]): ExtractedDocument {
  const lines = pages.map((items, index) => groupIntoLines(items, index + 1));

  return {
    pages: stripFurniture(lines).map((pageLines, index) => ({
      page: index + 1,
      blocks: toBlocks(pageLines, index + 1),
    })),
  };
}
