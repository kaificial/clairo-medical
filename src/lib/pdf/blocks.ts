import type { Block, Line, TableBlock } from "./types";

const HEADING_SIZE_RATIO = 1.12;
const TOP_HEADING_RATIO = 1.6;
const SECTION_HEADING_RATIO = 1.25;
const MAX_HEADING_LENGTH = 70;
const MIN_TABLE_ROWS = 2;
const MIN_COLUMN_TOLERANCE = 4;
const COLUMN_TOLERANCE_RATIO = 1.5;

/**
 * The most common font size rounded to half a point. That's the body text and the
 * headings are measured against it.
 */
export function bodyFontSize(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + 1);
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

/**
 * A heading is a short single cell line set bigger than body text or written in
 * capitals like "DISCHARGE PLAN, etc." on the sample.
 */
export function isHeading(line: Line, body: number): boolean {
  if (line.cells.length > 1) return false;

  const text = line.text.trim();
  if (text.length === 0 || text.length > MAX_HEADING_LENGTH) return false;
  if (body > 0 && line.fontSize >= body * HEADING_SIZE_RATIO) return true;

  const shouted = text.replace(/\([^)]*\)/g, "").trim();
  return shouted === shouted.toUpperCase() && /[A-Z]/.test(shouted);
}

function headingLevel(fontSize: number, body: number): number {
  if (body <= 0) return 2;
  const ratio = fontSize / body;
  if (ratio >= TOP_HEADING_RATIO) return 1;
  if (ratio >= SECTION_HEADING_RATIO) return 2;
  return 3;
}

/**
 * Whether a lines cells start under the first rows columns give or take a
 * little since extracted x positions drift.
 */
function alignsWith(first: Line, line: Line): boolean {
  if (line.cells.length < 2) return false;

  const tolerance = Math.max(
    MIN_COLUMN_TOLERANCE,
    first.fontSize * COLUMN_TOLERANCE_RATIO,
  );
  const anchors = first.cells.map((cell) => cell.x);
  const matched = line.cells.filter((cell) =>
    anchors.some((anchor) => Math.abs(anchor - cell.x) <= tolerance),
  ).length;

  const required = Math.max(2, Math.min(anchors.length, line.cells.length) - 1);
  return matched >= required;
}

/**
 * How many lines in a row, starting at `start` have the same column layout.
 * 2 or more make a table.
 */
function tableRunLength(lines: Line[], start: number): number {
  const first = lines[start];
  if (!first || first.cells.length < 2) return 0;

  const rest = lines.slice(start + 1);
  const breaks = rest.findIndex((line) => !alignsWith(first, line));
  return 1 + (breaks === -1 ? rest.length : breaks);
}

/** A paragraph runs until the next heading or table. */
function paragraphEnd(lines: Line[], start: number, body: number): number {
  const next = start + 1;
  const stop = lines
    .slice(next)
    .findIndex(
      (line, offset) =>
        isHeading(line, body) ||
        tableRunLength(lines, next + offset) >= MIN_TABLE_ROWS,
    );
  return stop === -1 ? lines.length : next + stop;
}

function tableBlock(lines: Line[], page: number): TableBlock {
  const rows = lines.map((line) => line.cells.map((cell) => cell.text));
  return {
    kind: "table",
    page,
    rows,
    text: rows.map((row) => row.join(" | ")).join("\n"),
  };
}

/** Sorts a pagess lines into headings, tables and paragraphs. */
export function toBlocks(lines: Line[], page: number): Block[] {
  const body = bodyFontSize(lines);
  const blocks: Block[] = [];
  let start = 0;

  while (start < lines.length) {
    const line = lines[start];
    if (!line) break;

    if (isHeading(line, body)) {
      blocks.push({
        kind: "heading",
        page,
        text: line.text.trim(),
        level: headingLevel(line.fontSize, body),
      });
      start += 1;
      continue;
    }

    const run = tableRunLength(lines, start);
    if (run >= MIN_TABLE_ROWS) {
      blocks.push(tableBlock(lines.slice(start, start + run), page));
      start += run;
      continue;
    }

    const end = paragraphEnd(lines, start, body);
    const text = lines
      .slice(start, end)
      .map((paragraphLine) => paragraphLine.text.trim())
      .join(" ");
    blocks.push({ kind: "paragraph", page, text });
    start = end;
  }

  return blocks;
}
