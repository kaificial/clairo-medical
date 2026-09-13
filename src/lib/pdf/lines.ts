import type { Cell, Line, TextItem } from "./types";

/**
 * A gap wider than this many font sizes starts a new cell (how table
 * columns come apart.)
 */
const CELL_GAP_RATIO = 1.2;
/**
 * Items where baselines are closer than this many font sizes sit on the same
 * line.
 */
const LINE_TOLERANCE_RATIO = 0.5;
/**
 * Baselines closer than this count as equal when sorting and those items are
 * ordered left to right instead.
 */
const SAME_BASELINE = 0.01;
const WIDE_GAP = /(\s{3,})/;

function itemX(item: TextItem): number {
  return item.transform[4] ?? 0;
}

function itemY(item: TextItem): number {
  return item.transform[5] ?? 0;
}

function itemFontSize(item: TextItem): number {
  const scale = Math.hypot(item.transform[1] ?? 0, item.transform[3] ?? 0);
  return scale > 0 ? scale : item.height;
}

/**
 * Splits 1 text item on runs of three or more spaces. Monospaced PDFs
 * put a whole row of columns into a single item so gaps between items
 * would miss them. Character width estimated from the items width.
 */
function splitWideRuns(str: string, x: number, width: number): Cell[] {
  const charWidth = str.length > 0 ? width / str.length : 0;
  const cells: Cell[] = [];
  let offset = 0;

  for (const piece of str.split(WIDE_GAP)) {
    const text = piece.trim();
    if (text) {
      const lead = piece.length - piece.trimStart().length;
      cells.push({
        text,
        x: x + (offset + lead) * charWidth,
        width: text.length * charWidth,
      });
    }
    offset += piece.length;
  }

  return cells.length > 0 ? cells : [{ text: str.trim(), x, width }];
}

function toLine(items: TextItem[], page: number): Line {
  const ordered = [...items].sort((a, b) => itemX(a) - itemX(b));
  const fontSize = Math.max(...ordered.map(itemFontSize));
  const y =
    ordered.reduce((sum, item) => sum + itemY(item), 0) / ordered.length;

  const cells: Cell[] = [];
  for (const item of ordered) {
    for (const part of splitWideRuns(item.str, itemX(item), item.width)) {
      const last = cells.at(-1);
      const gap = last ? part.x - (last.x + last.width) : Infinity;

      if (last && gap <= fontSize * CELL_GAP_RATIO) {
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
    text: cells.map((cell) => cell.text).join("  "),
  };
}

/**
 * Groups text items into visual lines by their baseline then orders each line
 * left to right.
 */
export function groupIntoLines(items: TextItem[], page: number): Line[] {
  const sorted = items
    .filter((item) => item.str.trim().length > 0)
    .sort((a, b) => {
      const dy = itemY(b) - itemY(a);
      return Math.abs(dy) > SAME_BASELINE ? dy : itemX(a) - itemX(b);
    });

  const lines: Line[] = [];
  let bucket: TextItem[] = [];
  let bucketY = 0;

  for (const item of sorted) {
    const y = itemY(item);
    const tolerance = Math.max(1, itemFontSize(item) * LINE_TOLERANCE_RATIO);

    if (bucket.length > 0 && Math.abs(y - bucketY) > tolerance) {
      lines.push(toLine(bucket, page));
      bucket = [];
    }
    if (bucket.length === 0) bucketY = y;
    bucket.push(item);
  }

  if (bucket.length > 0) lines.push(toLine(bucket, page));
  return lines;
}
