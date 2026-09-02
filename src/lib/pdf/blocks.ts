import type { Block, Line } from "./types";

const HEADING_SIZE_RATIO = 1.12;
const MAX_HEADING_LENGTH = 70;
const MIN_TABLE_ROWS = 2;

/** Most common line font size, used as the baseline for heading detection. */
export function bodyFontSize(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.fontSize * 2) / 2;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

export function isHeading(line: Line, body: number): boolean {
  if (line.cells.length > 1) return false;

  const text = line.text.trim();
  if (text.length === 0 || text.length > MAX_HEADING_LENGTH) return false;
  if (body > 0 && line.fontSize >= body * HEADING_SIZE_RATIO) return true;

  return text === text.toUpperCase() && /[A-Z]/.test(text);
}

function headingLevel(fontSize: number, body: number): number {
  if (body <= 0) return 2;
  const ratio = fontSize / body;
  if (ratio >= 1.6) return 1;
  if (ratio >= 1.25) return 2;
  return 3;
}

function columnsAlign(anchors: number[], xs: number[], fontSize: number) {
  const tolerance = Math.max(4, fontSize * 1.5);
  let matched = 0;
  for (const x of xs) {
    if (anchors.some((anchor) => Math.abs(anchor - x) <= tolerance))
      matched += 1;
  }
  const required = Math.max(2, Math.min(anchors.length, xs.length) - 1);
  return matched >= required;
}

/** How many consecutive lines from `start` share a column layout. */
function tableRunLength(lines: Line[], start: number): number {
  const first = lines[start];
  if (!first || first.cells.length < 2) return 0;

  const anchors = first.cells.map((cell) => cell.x);
  let count = 1;

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.cells.length < 2) break;
    if (
      !columnsAlign(
        anchors,
        line.cells.map((c) => c.x),
        first.fontSize,
      )
    )
      break;
    count += 1;
  }

  return count;
}

export function toBlocks(lines: Line[], page: number): Block[] {
  const body = bodyFontSize(lines);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) break;

    if (isHeading(line, body)) {
      blocks.push({
        kind: "heading",
        page,
        text: line.text.trim(),
        level: headingLevel(line.fontSize, body),
      });
      i += 1;
      continue;
    }

    const run = tableRunLength(lines, i);
    if (run >= MIN_TABLE_ROWS) {
      const rows = lines
        .slice(i, i + run)
        .map((row) => row.cells.map((cell) => cell.text));
      blocks.push({
        kind: "table",
        page,
        rows,
        text: rows.map((row) => row.join(" | ")).join("\n"),
      });
      i += run;
      continue;
    }

    const parts: string[] = [];
    let j = i;
    while (j < lines.length) {
      const next = lines[j];
      if (!next || isHeading(next, body)) break;
      if (j > i && tableRunLength(lines, j) >= MIN_TABLE_ROWS) break;
      parts.push(next.text.trim());
      j += 1;
    }

    if (parts.length > 0) {
      blocks.push({ kind: "paragraph", page, text: parts.join(" ") });
    }
    i = Math.max(j, i + 1);
  }

  return blocks;
}
