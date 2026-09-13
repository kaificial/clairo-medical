import type { ExtractedDocument } from "@/lib/pdf";

import { findAnalyte, isVitalSign } from "./analytes";
import type { LabRow, PrintedFlag } from "./types";
import {
  isDateLike,
  looksLikeUnit,
  parseFlag,
  parseRange,
  parseResultValue,
  type ParsedValue,
} from "./values";

const MAX_NAME_LENGTH = 60;
const ORDINAL = /^\s*(?:\d{1,3}[.)]?|[•·*-])\s+/;
const NAME_THEN_VALUE =
  /^(.*?[a-z)\]%])\s*[:=]?\s+((?:<=|>=|≤|≥|<|>)?\s*[-−]?[\d.].*)$/i;

/** What we've learned about a row so far, walking its cells left to right. */
interface RowCells {
  name: string | null;
  parsed: ParsedValue | null;
  unit: string | null;
  date: string | null;
  rangeText: string | null;
  flag: PrintedFlag | null;
}

function cleanName(text: string): string {
  return text
    .replace(ORDINAL, "")
    .replace(/[\s:=]+$/, "")
    .trim();
}

function isNameLike(text: string): boolean {
  const letters = text.match(/[a-z]/gi)?.length ?? 0;
  return (
    letters >= 2 &&
    !isDateLike(text) &&
    parseFlag(text) === null &&
    !looksLikeUnit(text) &&
    parseRange(text) === null
  );
}

/**
 * Some reports print "Sodium 140 mmol/L" in a single cell. This splits it back
 * into a name and a result.
 */
function splitNameAndValue(
  text: string,
): { name: string; parsed: ParsedValue } | null {
  const match = NAME_THEN_VALUE.exec(text);
  if (!match) return null;

  const name = cleanName(match[1] ?? "");
  const parsed = parseResultValue(match[2] ?? "");
  return parsed && isNameLike(name) ? { name, parsed } : null;
}

/**
 * Handles a cell before the value has turned up. That's usually the test name,
 * but some layouts print the date, range or unit first.
 */
function readLeadingCell(row: RowCells, text: string): void {
  const named = row.name !== null;

  const parsed = named ? parseResultValue(text) : null;
  if (parsed) {
    row.parsed = parsed;
  } else if (isDateLike(text)) {
    row.date ??= text;
  } else if (named && parseRange(text)) {
    row.rangeText ??= text;
  } else if (named && looksLikeUnit(text)) {
    row.unit ??= text;
  } else if (isNameLike(text)) {
    const split = splitNameAndValue(text);
    row.name = split?.name ?? cleanName(text);
    row.parsed = split?.parsed ?? null;
  }
}

/**
 * Handles a cell after the value. We take the first unit, flag, range and date
 * that turn up.
 */
function readTrailingCell(row: RowCells, text: string): void {
  const flag = parseFlag(text);

  if (row.unit === null && looksLikeUnit(text)) {
    row.unit = text;
  } else if (row.flag === null && flag) {
    row.flag = flag;
  } else if (row.rangeText === null && parseRange(text)) {
    row.rangeText = text;
  } else if (row.date === null && isDateLike(text)) {
    row.date = text;
  }
}

function toLabRow(row: RowCells, page: number): LabRow | null {
  const { name, parsed } = row;
  if (!name || !parsed || name.length > MAX_NAME_LENGTH) return null;
  if (isVitalSign(name)) return null;

  const range = row.rangeText ? parseRange(row.rangeText) : null;
  const unit = parsed.unit ?? row.unit ?? range?.unit ?? null;

  // A number beside a label, like "Visit Number: 11186424686" on the sample,
  // isn't a result unless we know the test or it comes with a unit or range.
  if (!findAnalyte(name) && unit === null && range === null) return null;

  return {
    name,
    value: parsed.value,
    valueText: parsed.text,
    comparator: parsed.comparator,
    unit,
    date: row.date,
    printedRange: range?.range ?? null,
    printedRangeText: range ? row.rangeText : null,
    printedFlag: parsed.flag ?? row.flag,
    page,
    source: "table",
  };
}

/**
 * Reads one table row as a lab result: a test name, then the first value after
 * it, then whatever unit, range, flag or date follows. Cells are read by what
 * they look like rather than which column they're in, because extracted rows
 * don't always line up with their header. On the sample, the row number is
 * sometimes its own cell and sometimes glued to the name ("10 AST").
 */
export function readRow(cells: readonly string[], page: number): LabRow | null {
  const row: RowCells = {
    name: null,
    parsed: null,
    unit: null,
    date: null,
    rangeText: null,
    flag: null,
  };

  for (const cell of cells) {
    const text = cell.trim();
    if (text.length === 0) continue;

    if (row.parsed === null) readLeadingCell(row, text);
    else readTrailingCell(row, text);
  }

  return toLabRow(row, page);
}

interface DateHeader {
  cells: readonly string[];
  /** Which columns hold dates. */
  columns: number[];
}

/**
 * Finds the date columns in a header row like "Test | 12-Mar | 19-Mar". It
 * needs at least two, and a row that already holds a result is never taken for
 * a header.
 */
function dateColumns(cells: readonly string[]): number[] {
  if (cells.some((cell) => parseResultValue(cell.trim()) !== null)) return [];

  const columns = cells.flatMap((cell, index) =>
    isDateLike(cell.trim()) ? [index] : [],
  );
  return columns.length >= 2 ? columns : [];
}

/**
 * Splits a row into one reading per date column, each keeping the name, unit
 * and range cells.
 */
function readPerDate(
  cells: readonly string[],
  header: DateHeader,
  page: number,
): LabRow[] {
  return header.columns.flatMap((column) => {
    const single = cells.filter(
      (_, index) => index === column || !header.columns.includes(index),
    );
    const row = readRow(single, page);
    return row
      ? { ...row, date: row.date ?? header.cells[column] ?? null }
      : [];
  });
}

/**
 * Reads a table, including the layout where each column is a different date
 * ("Test | 12-Mar | 19-Mar | Units"). The eval caught the parser missing that
 * layout. Only rows that line up cell for cell with such a header are split per
 * date; anything else is read as an ordinary row.
 */
function readTable(rows: readonly string[][], page: number): LabRow[] {
  const results: LabRow[] = [];
  let header: DateHeader | null = null;

  for (const cells of rows) {
    if (!header) {
      const columns = dateColumns(cells);
      if (columns.length > 0) {
        header = { cells, columns };
        continue;
      }
    }

    if (header && cells.length === header.cells.length) {
      results.push(...readPerDate(cells, header, page));
      continue;
    }

    const row = readRow(cells, page);
    if (row) results.push(row);
  }

  return results;
}

/**
 * Every lab result printed in the document's tables, in reading order. This
 * runs entirely in the browser.
 */
export function readLabTables(document: ExtractedDocument): LabRow[] {
  return document.pages.flatMap((page) =>
    page.blocks.flatMap((block) =>
      block.kind === "table" ? readTable(block.rows, page.page) : [],
    ),
  );
}
