import type { Line } from "./types";

/** Fraction of the content height at the top and bottom treated as margins. */
const EDGE_RATIO = 0.15;
const MIN_PAGES = 2;
/** Below this much vertical spread a page has no useful edges to trim. */
const MIN_EXTENT = 100;

/**
 * Page numbers and dates change from page to page, so running headers are
 * compared by shape than by their exact text.
 */
export function furnitureKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

function edgeBands(lines: Line[]): { top: number; bottom: number } | null {
  if (lines.length === 0) return null;

  const ys = lines.map((line) => line.y);
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  if (max - min < MIN_EXTENT) return null;

  const band = (max - min) * EDGE_RATIO;
  return { top: max - band, bottom: min + band };
}

function inEdgeBand(line: Line, bands: { top: number; bottom: number }) {
  return line.y >= bands.top || line.y <= bands.bottom;
}

/**
 * Drop running headers and footers: lines near the top or bottom edge where
 * shape repeats across at least half the pages.
 */
export function stripFurniture(pages: Line[][]): Line[][] {
  if (pages.length < MIN_PAGES) return pages;

  const seen = new Map<string, Set<number>>();

  pages.forEach((lines, index) => {
    const bands = edgeBands(lines);
    if (!bands) return;

    for (const line of lines) {
      if (!inEdgeBand(line, bands)) continue;
      const key = furnitureKey(line.text);
      if (!key) continue;
      const pagesWithKey = seen.get(key) ?? new Set<number>();
      pagesWithKey.add(index);
      seen.set(key, pagesWithKey);
    }
  });

  const threshold = Math.max(MIN_PAGES, Math.ceil(pages.length / 2));

  return pages.map((lines) => {
    const bands = edgeBands(lines);
    if (!bands) return lines;

    return lines.filter((line) => {
      if (!inEdgeBand(line, bands)) return true;
      const count = seen.get(furnitureKey(line.text))?.size ?? 0;
      return count < threshold;
    });
  });
}
