import type { Line } from "./types";

/**
 * The top and bottom 15% of a page's text is where running headers and footers
 * are
 */
const EDGE_RATIO = 0.15;
const MIN_PAGES = 2;
/**
 * A page with less vertical spread than this is mostly empty and doesnt have a real top
 * or bottom to trim
 */
const MIN_EXTENT = 100;

/**
 * Headers like "Page 2 of 3" change on every page so they're compared by
 * shape with the digits blanked out, rather than by the exact text.
 */
export function furnitureKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

interface EdgeBands {
  top: number;
  bottom: number;
}

function edgeBands(lines: Line[]): EdgeBands | null {
  if (lines.length === 0) return null;

  const ys = lines.map((line) => line.y);
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  if (max - min < MIN_EXTENT) return null;

  const band = (max - min) * EDGE_RATIO;
  return { top: max - band, bottom: min + band };
}

function inEdgeBand(line: Line, bands: EdgeBands): boolean {
  return line.y >= bands.top || line.y <= bands.bottom;
}

export function stripFurniture(pages: Line[][]): Line[][] {
  if (pages.length < MIN_PAGES) return pages;

  const pagesByKey = new Map<string, Set<number>>();

  pages.forEach((lines, index) => {
    const bands = edgeBands(lines);
    if (!bands) return;

    for (const line of lines) {
      if (!inEdgeBand(line, bands)) continue;
      const key = furnitureKey(line.text);
      if (!key) continue;
      const pagesWithKey = pagesByKey.get(key) ?? new Set<number>();
      pagesWithKey.add(index);
      pagesByKey.set(key, pagesWithKey);
    }
  });

  const threshold = Math.max(MIN_PAGES, Math.ceil(pages.length / 2));

  return pages.map((lines) => {
    const bands = edgeBands(lines);
    if (!bands) return lines;

    return lines.filter((line) => {
      if (!inEdgeBand(line, bands)) return true;
      const repeats = pagesByKey.get(furnitureKey(line.text))?.size ?? 0;
      return repeats < threshold;
    });
  });
}
