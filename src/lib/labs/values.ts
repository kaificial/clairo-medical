import type { Comparator, PrintedFlag, ReferenceRange } from "./types";

const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+`;
const COMPARATOR = String.raw`<=|>=|=<|=>|≤|≥|<|>`;

const VALUE = new RegExp(
  String.raw`^(${COMPARATOR})?\s*([-−]?(?:${NUMBER}))\s*(.*)$`,
);
const BETWEEN = new RegExp(
  String.raw`^(${NUMBER})\s*(?:-|–|—|to)\s*(${NUMBER})\s*(.*)$`,
  "i",
);
const BOUND = new RegExp(
  String.raw`^(${COMPARATOR}|up to|less than|greater than)\s*(${NUMBER})\s*(.*)$`,
  "i",
);
const RANGE_LABEL =
  /^(?:ref(?:erence)?\.?(?:\s*(?:range|interval))?|normal(?:\s*range)?|range)\s*[:=]?\s*/i;
const BRACKETED = /^[([]\s*(.*?)\s*[)\]]$/;
/** A flag printed after the value: "6.1 H", "6.1 (L)", "6.1*". */
const FLAG_SUFFIX =
  /(?:\s+\(?\s*|\s*\(\s*)(hh|ll|hi|lo|high|low|abn|abnormal|h|l|a)\s*\)?$|\s*(\*+|↑|↓)$/i;

const DAY_MONTH_YEAR = /^(\d{1,2})[- ]([a-z]{3,9})\.?[-, ]?(\d{4})$/i;
const MONTH_DAY_YEAR = /^([a-z]{3,9})\.? ?(\d{1,2}),? ?(\d{4})$/i;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const NUMERIC_DATE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
const TIME_SUFFIX = /\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?$/i;

const COMPARATORS: Readonly<Record<string, Comparator>> = {
  "<": "<",
  ">": ">",
  "<=": "<=",
  "=<": "<=",
  "≤": "<=",
  ">=": ">=",
  "=>": ">=",
  "≥": ">=",
};
const UPPER_BOUNDS = new Set(["<", "<=", "=<", "≤", "up to", "less than"]);

const FLAGS: Readonly<Record<string, PrintedFlag>> = {
  h: "high",
  hh: "high",
  hi: "high",
  high: "high",
  "↑": "high",
  "crit high": "high",
  l: "low",
  ll: "low",
  lo: "low",
  low: "low",
  "↓": "low",
  "crit low": "low",
  a: "abnormal",
  abn: "abnormal",
  abnormal: "abnormal",
  "*": "abnormal",
  "**": "abnormal",
};

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const UNIT_ALIASES: Readonly<Record<string, string>> = {
  "iu/l": "u/l",
  "mu/l": "miu/l",
  "uiu/ml": "miu/l",
  "uu/ml": "miu/l",
  "k/ul": "10^9/l",
  "10^3/ul": "10^9/l",
  "10^3/mm3": "10^9/l",
  "thou/ul": "10^9/l",
  "k/mm3": "10^9/l",
  "10^6/ul": "10^12/l",
  "m/ul": "10^12/l",
  "ml/min/1.73m^2": "ml/min/1.73m2",
  "ml/min/1.73sqm": "ml/min/1.73m2",
  sec: "s",
};

const KNOWN_UNITS = new Set([
  "%",
  "fl",
  "pg",
  "s",
  "ratio",
  "u/l",
  "miu/l",
  "10^9/l",
  "10^12/l",
  "ml/min/1.73m2",
]);

/**
 * Any "amount per volume" unit such as mmol/L, ng/mL or mg/mmol. There are too
 * many to list them all.
 */
const PER_UNIT = /^[a-z0-9^.]{1,8}\/[a-z0-9^.]{1,10}$/;
const MAX_UNIT_LENGTH = 20;

function parseNumber(text: string): number {
  return Number(text.replace(/,/g, "").replace("−", "-"));
}

/**
 * Reports spell units every which way. This collapses them so "IU/L", "U/L" and
 * "u / l" all compare equal.
 */
export function normalizeUnit(unit: string): string {
  const compact = unit
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/mc(?=g)/g, "u")
    .replace(/×/g, "x")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/⁹/g, "9")
    .replace(/\s+/g, "")
    .replace(/^x(?=10)/, "")
    .replace(/10(?:e|\*|\^)?(3|6|9|12)(?=\/)/, "10^$1");

  return UNIT_ALIASES[compact] ?? compact;
}

export function looksLikeUnit(text: string): boolean {
  const unit = normalizeUnit(text);
  if (unit.length === 0 || unit.length > MAX_UNIT_LENGTH) return false;
  return KNOWN_UNITS.has(unit) || PER_UNIT.test(unit);
}

export function parseFlag(text: string): PrintedFlag | null {
  const token = text
    .trim()
    .replace(/^\((.*)\)$/, "$1")
    .trim()
    .toLowerCase();
  return FLAGS[token] ?? null;
}

export interface ParsedValue {
  value: number;
  text: string;
  comparator: Comparator | null;
  flag: PrintedFlag | null;
  unit: string | null;
}

/**
 * Reads a printed result such as "6.1", "<0.5", "1,001 H" or "140 mmol/L". If
 * anything is left over that isn't a unit, the cell isn't a result.
 */
export function parseResultValue(raw: string): ParsedValue | null {
  let text = raw.trim();
  let flag: PrintedFlag | null = null;

  const suffix = FLAG_SUFFIX.exec(text);
  if (suffix && suffix.index > 0) {
    flag = parseFlag(suffix[1] ?? suffix[2] ?? "");
    text = text.slice(0, suffix.index).trim();
  }

  const match = VALUE.exec(text);
  if (!match) return null;

  const [, comparator = "", number = "", rest = ""] = match;
  const unit = rest.trim();
  if (unit.length > 0 && !looksLikeUnit(unit)) return null;

  return {
    value: parseNumber(number),
    text,
    comparator: COMPARATORS[comparator] ?? null,
    flag,
    unit: unit || null,
  };
}

interface ParsedRange {
  range: ReferenceRange;
  unit: string | null;
}

/** Accepts a range only if whatever follows it is a unit or nothing at all. */
function withTrailingUnit(
  range: ReferenceRange,
  rest = "",
): ParsedRange | null {
  const unit = rest.trim();
  if (unit.length > 0 && !looksLikeUnit(unit)) return null;
  return { range, unit: unit || null };
}

/**
 * Reads a printed reference range: "3.5-5.0", "(3.5 to 5.0 mmol/L)", "<200", "≥
 * 60".
 */
export function parseRange(raw: string): ParsedRange | null {
  const text = raw.trim().replace(RANGE_LABEL, "").replace(BRACKETED, "$1");

  const between = BETWEEN.exec(text);
  if (between) {
    const low = parseNumber(between[1] ?? "");
    const high = parseNumber(between[2] ?? "");
    return low > high ? null : withTrailingUnit({ low, high }, between[3]);
  }

  const bound = BOUND.exec(text);
  if (bound) {
    const limit = parseNumber(bound[2] ?? "");
    const range = UPPER_BOUNDS.has((bound[1] ?? "").toLowerCase())
      ? { high: limit }
      : { low: limit };
    return withTrailingUnit(range, bound[3]);
  }

  return null;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** 1 for January, or 0 when it isn't a month at all. */
function monthNumber(name = ""): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/**
 * Reads a printed date as ISO when there's no doubt about it. Whether
 * "03/04/2015" is the 3rd of April or March 4th depends on the country, so
 * numeric dates like that are left unread on purpose.
 */
export function parseDate(raw: string): string | null {
  const text = raw
    .trim()
    .replace(TIME_SUFFIX, "")
    .replace(/\s*([-/.,])\s*/g, "$1")
    .replace(/\s+/g, " ");

  const dayFirst = DAY_MONTH_YEAR.exec(text);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return isoDate(Number(year), monthNumber(month), Number(day));
  }

  const monthFirst = MONTH_DAY_YEAR.exec(text);
  if (monthFirst) {
    const [, month, day, year] = monthFirst;
    return isoDate(Number(year), monthNumber(month), Number(day));
  }

  const iso = YEAR_MONTH_DAY.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    return isoDate(Number(year), Number(month), Number(day));
  }

  return null;
}

/**
 * Whether a cell is a date at all, including numeric ones too ambiguous to
 * read.
 */
export function isDateLike(raw: string): boolean {
  return parseDate(raw) !== null || NUMERIC_DATE.test(raw.replace(/\s+/g, ""));
}
