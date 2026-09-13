import { findAnalyte, normalizeName } from "./analytes";
import type { LabResult, LabRow, LabSeries } from "./types";
import { normalizeUnit, parseDate } from "./values";

/**
 * Readings of the same test share a key. Known tests group by analyte, so "ALT"
 * and "ALT (SGPT)" land together; anything else groups by name and unit.
 */
function testKey(row: LabRow): string {
  const analyte = findAnalyte(row.name);
  if (analyte) return analyte.key;
  return `${normalizeName(row.name)}|${row.unit ? normalizeUnit(row.unit) : ""}`;
}

/**
 * Oldest reading first, but only when every date is readable. One ambiguous
 * date and we keep the report's order rather than guess.
 */
function chronological(results: readonly LabResult[]): LabResult[] {
  const dated = results.map((result) => ({
    result,
    date: result.date ? parseDate(result.date) : null,
  }));
  if (dated.some((entry) => entry.date === null)) return [...results];

  // Array sort is stable, so two readings from the same day keep the order the
  // report printed them in.
  return dated
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((entry) => entry.result);
}

/**
 * Groups repeat readings of one test so the panel can show a trend, like ALT
 * going from 1001 to 90, on a single row.
 */
export function groupSeries(results: readonly LabResult[]): LabSeries[] {
  const groups = new Map<string, LabResult[]>();

  for (const result of results) {
    const key = testKey(result);
    const group = groups.get(key);
    if (group) group.push(result);
    else groups.set(key, [result]);
  }

  return [...groups].flatMap(([key, group]) => {
    const ordered = chronological(group);
    const latest = ordered.at(-1);
    if (!latest) return [];

    return {
      key,
      label: latest.analyte?.label ?? latest.name,
      name: latest.analyte?.name ?? null,
      results: ordered,
      latest,
    };
  });
}

export function isOutOfRange(series: LabSeries): boolean {
  const { status } = series.latest;
  return status === "low" || status === "high" || status === "abnormal";
}

/**
 * Adds the AI's rows to the table parser's without repeating anything. The same
 * value for the same test on the same page is taken to be one reading.
 */
export function mergeRows(
  existing: readonly LabRow[],
  incoming: readonly LabRow[],
): LabRow[] {
  const readingKey = (row: LabRow) =>
    `${row.page}|${testKey(row)}|${row.value}`;
  const seen = new Set(existing.map(readingKey));
  const merged = [...existing];

  for (const row of incoming) {
    const key = readingKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}
