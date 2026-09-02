import type { Cell, Line, TextItem } from "./types";

/** Starts a new cell  */
const CELL_GAP_RATIO = 1.2;
/** Same line. */
const LINE_TOLERANCE_RATIO = 0.5;

export function itemX(item: TextItem): number {
  return item.transform[4] ?? 0;
}

export function itemY(item: TextItem): number {
  return item.transform[5] ?? 0;
}

export function itemFontSize(item: TextItem): number {
  const scale = Math.hypot(item.transform[1] ?? 0, item.transform[3] ?? 0);
  return scale > 0 ? scale : item.height;
}

/**
 * Split 1 item on runs 3 or more spaces. Column separated text in
 * monospaced pdf as a single item, so positional gaps by itself miss it.
 * Character width is estimated from the width
 */
function splitWideRuns(str: string, x: number, width: number): Cell[] {
  const charWidth = str.length > 0 ? width / str.length : 0;
  const out: Cell[] = [];
  let index = 0;

  for (const piece of str.split(/(\s{3,})/)) {
    if (!/^\s{3,}$/.test(piece)) {
      const text = piece.trim();
      if (text) {
        const lead = piece.length - piece.trimStart().length;
        out.push({
          text,
          x: x + (index + lead) * charWidth,
          width: text.length * charWidth,
        });
      }
    }
    index += piece.length;
  }

  return out.length > 0 ? out : [{ text: str.trim(), x, width }];
}

function toLine(items: TextItem[], page: number): Line {
  const ordered = [...items].sort((a, b) => itemX(a) - itemX(b));
  const fontSize = Math.max(...ordered.map(itemFontSize));
  const y = ordered.reduce((sum, i) => sum + itemY(i), 0) / ordered.length;

  const cells: Cell[] = [];
  for (const item of ordered) {
    for (const part of splitWideRuns(item.str, itemX(item), item.width)) {
      const last = cells.at(-1);
      if (last && part.x - (last.x + last.width) <= fontSize * CELL_GAP_RATIO) {
        last.text = `${last.text} ${part.text}`.replace(/\s+/g, " ").trim();
        last.width = part.x + part.width - last.x;
      } else {
        cells.push({ ...part });
      }
    }
  }

  return {
    page,
    y,
    fontSize,
    cells,
    text: cells.map((c) => c.text).join("  "),
  };
}

/** Cluster items into visual lines by baseline, then order each line by x */
export function groupIntoLines(items: TextItem[], page: number): Line[] {
  const usable = items.filter((item) => item.str.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => {
    const dy = itemY(b) - itemY(a);
    return Math.abs(dy) > 0.01 ? dy : itemX(a) - itemX(b);
  });

  const lines: Line[] = [];
  let bucket: TextItem[] = [];
  let bucketY = 0;

  for (const item of sorted) {
    const y = itemY(item);
    const tolerance = Math.max(1, itemFontSize(item) * LINE_TOLERANCE_RATIO);

    if (bucket.length === 0) {
      bucketY = y;
    } else if (Math.abs(y - bucketY) > tolerance) {
      lines.push(toLine(bucket, page));
      bucket = [];
      bucketY = y;
    }

    bucket.push(item);
  }

  if (bucket.length > 0) lines.push(toLine(bucket, page));
  return lines;
}
