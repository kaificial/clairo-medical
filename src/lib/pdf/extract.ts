import { toBlocks } from "./blocks";
import { groupIntoLines } from "./lines";
import type { ExtractedDocument, ExtractedPage, TextItem } from "./types";

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

/** Drop pdf.js marked-content entries and keep positioned text runs. */
export function fromPdfJsItems(items: readonly unknown[]): TextItem[] {
  return items.filter(isTextItem).map((item) => ({
    str: item.str,
    transform: item.transform,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
  }));
}

export function extractPage(items: TextItem[], page: number): ExtractedPage {
  return { page, blocks: toBlocks(groupIntoLines(items, page), page) };
}

export function extractDocument(pages: TextItem[][]): ExtractedDocument {
  return { pages: pages.map((items, index) => extractPage(items, index + 1)) };
}
