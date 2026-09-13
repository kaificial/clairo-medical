import type { Chunk } from "@/lib/pdf";

import { nameForms, normalizeName } from "./analytes";
import type { LabRow, ReferenceRange } from "./types";
import {
  looksLikeUnit,
  parseFlag,
  parseRange,
  parseResultValue,
} from "./values";

export const MAX_LAB_PASSAGES = 12;

const MEASUREMENT =
  /\d\s*\|?\s*(?:mmol|µmol|umol|nmol|pmol|mg|g\/|ng|pg|u\/l|iu|meq|%|x?10\^|fl\b)/i;
const LAB_WORDS =
  /\b(?:labs?|laborator(?:y|ies)|results?|serum|plasma|blood|panel|count|level|test)\b/i;
const LEADING_COMPARATOR = /^[<>=≤≥\s]+/;

/**
 * How likely a passage is to hold lab results. Digits alone aren't enough: a
 * table of names, dates of birth and phone numbers has plenty, and there's no
 * reason for that to leave the device.
 */
function labSignal(chunk: Chunk): number {
  if (!/\d/.test(chunk.text)) return 0;

  const signal =
    (MEASUREMENT.test(chunk.text) ? 2 : 0) +
    (LAB_WORDS.test(chunk.text) ? 1 : 0);
  if (signal === 0) return 0;

  return signal + (chunk.kind === "table" ? 1 : 0);
}

/**
 * Picks the passages worth sending for AI lab extraction. When there are too
 * many we keep the strongest, but send them in reading order so the model sees
 * the report as it's laid out.
 */
export function labPassages(
  chunks: readonly Chunk[],
  limit = MAX_LAB_PASSAGES,
): Chunk[] {
  return chunks
    .map((chunk, index) => ({ chunk, index, signal: labSignal(chunk) }))
    .filter((entry) => entry.signal > 0)
    .sort((a, b) => b.signal - a.signal || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.chunk);
}

/**
 * A result as the model reports it, with every field copied from the page as
 * text.
 */
export interface ModelLabRow {
  name: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: string | null;
  date: string | null;
  page: number;
}

interface SourcePassage {
  text: string;
  page: number;
  endPage: number;
}

export interface GroundedRows {
  rows: LabRow[];
  /**
   * How many results the model reported that we couldn't find in the text. The
   * panel shows this, so the reader knows the check did something.
   */
  discarded: number;
}

/**
 * Lowercases and drops thousands separators, so "1,001" in the report matches
 * "1001" from the model.
 */
function forMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\s+/g, " ");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether a number appears on its own. "6.1" shouldn't count as found just
 * because the page says "16.1" or "6.15".
 */
function containsNumber(text: string, number: string): boolean {
  const needle = escapeRegExp(number.replace(/,/g, ""));
  return new RegExp(`(?<![\\d.])${needle}(?![\\d]|\\.\\d)`).test(text);
}

function pageText(passages: readonly SourcePassage[], page: number): string {
  return forMatching(
    passages
      .filter((passage) => passage.page <= page && page <= passage.endPage)
      .map((passage) => passage.text)
      .join(" "),
  );
}

/**
 * Keeps the range the model reported only if every number in it is actually on
 * the page. A model will happily fill in a textbook range when the report has
 * none.
 */
function groundedRange(
  printed: string | null,
  text: string,
): { range: ReferenceRange; printed: string } | null {
  if (!printed) return null;

  const parsed = parseRange(printed);
  const numbers = printed.match(/\d+(?:\.\d+)?/g) ?? [];
  const found = numbers.every((number) => containsNumber(text, number));
  return parsed && found ? { range: parsed.range, printed } : null;
}

/**
 * Rebuilds one model row from what the page supports. If the test name or the
 * value isn't there, the whole row is dropped.
 */
function groundRow(
  row: ModelLabRow,
  passages: readonly SourcePassage[],
): LabRow | null {
  const text = pageText(passages, row.page);
  const parsed = parseResultValue(row.value);
  if (!parsed) return null;

  const words = normalizeName(text);
  const nameFound = nameForms(row.name).some((form) => words.includes(form));
  const number = parsed.text.replace(LEADING_COMPARATOR, "").replace("−", "-");
  if (!nameFound || !containsNumber(text, number)) return null;

  const range = groundedRange(row.referenceRange, text);
  const unit = parsed.unit ?? row.unit;
  const dateFound =
    row.date !== null && text.includes(forMatching(row.date.trim()));

  return {
    name: row.name.trim(),
    value: parsed.value,
    valueText: parsed.text,
    comparator: parsed.comparator,
    unit: unit && looksLikeUnit(unit) ? unit : null,
    date: dateFound ? row.date : null,
    printedRange: range?.range ?? null,
    printedRangeText: range?.printed ?? null,
    printedFlag: parsed.flag ?? (row.flag ? parseFlag(row.flag) : null),
    page: row.page,
    source: "model",
  };
}

/**
 * Keeps only what the passages actually say. The test name and the value must
 * both appear on the page the model cited, and a range or date we can't find is
 * stripped from the row rather than trusted.
 */
export function groundModelRows(
  rows: readonly ModelLabRow[],
  passages: readonly SourcePassage[],
): GroundedRows {
  const grounded = rows.flatMap((row) => groundRow(row, passages) ?? []);
  return { rows: grounded, discarded: rows.length - grounded.length };
}
