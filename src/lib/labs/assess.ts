import { findAnalyte, typicalRange } from "./analytes";
import type {
  Analyte,
  Comparator,
  LabResult,
  LabRow,
  LabStatus,
  PrintedFlag,
  RangeBasis,
  ReferenceRange,
} from "./types";

/**
 * Where a value sits against a range. A censored value like "<0.5" is only
 * judged when every number it could stand for falls on the same side; otherwise
 * we honestly don't know.
 */
export function compareToRange(
  value: number,
  comparator: Comparator | null,
  { low, high }: ReferenceRange,
): LabStatus {
  if (comparator === null) {
    if (low !== undefined && value < low) return "low";
    if (high !== undefined && value > high) return "high";
    return "normal";
  }

  if (comparator === "<" || comparator === "<=") {
    if (low !== undefined) return value <= low ? "low" : "unknown";
    if (high !== undefined) return value <= high ? "normal" : "unknown";
    return "unknown";
  }

  if (high !== undefined) return value >= high ? "high" : "unknown";
  if (low !== undefined) return value >= low ? "normal" : "unknown";
  return "unknown";
}

interface Assessment {
  status: LabStatus;
  range: ReferenceRange | null;
  basis: RangeBasis | null;
  conflict: boolean;
  /**
   * The printed range as text, when we threw it out as impossible for this
   * test.
   */
  doubtfulRange: string | null;
}

/**
 * A printed limit more than this many times off the typical one is treated as a
 * misread.
 */
const IMPLAUSIBLE_FACTOR = 3;

function isPlausibleLimit(
  printed: number | undefined,
  typical: number | undefined,
): boolean {
  if (printed === undefined || typical === undefined || typical <= 0) {
    return true;
  }
  const tooHigh = printed > typical * IMPLAUSIBLE_FACTOR;
  const tooLow = printed > 0 && printed < typical / IMPLAUSIBLE_FACTOR;
  return !tooHigh && !tooLow;
}

/**
 * No lab prints a potassium range up to 53, but that's what OCR read off the
 * scanned test fixture after dropping the decimal point in 5.3. A limit that
 * far from every published interval is almost certainly a misread, so we don't
 * trust it for this test in this unit.
 */
function isPlausibleRange(
  printed: ReferenceRange,
  typical: ReferenceRange | null,
): boolean {
  return (
    isPlausibleLimit(printed.low, typical?.low) &&
    isPlausibleLimit(printed.high, typical?.high)
  );
}

/**
 * The report's own flag always wins. A bare "abnormal" flag doesn't say which
 * way, so when the range can tell us high or low we use that.
 */
function flaggedStatus(
  computed: LabStatus,
  flag: PrintedFlag | null,
): LabStatus {
  if (flag === null) return computed;
  if (flag !== "abnormal") return flag;
  return computed === "low" || computed === "high" ? computed : "abnormal";
}

/**
 * Decides a result's status, in code and never by the model. The report's own
 * flag wins, then the range printed beside the result, then a typical range
 * when the units match.
 */
export function assess(row: LabRow, analyte: Analyte | null): Assessment {
  const typical = typicalRange(analyte, row.unit);
  const printed =
    row.printedRange && isPlausibleRange(row.printedRange, typical)
      ? row.printedRange
      : null;

  const range = printed ?? typical;
  const basis: RangeBasis | null = printed
    ? "report"
    : typical
      ? "typical"
      : null;
  const computed = range
    ? compareToRange(row.value, row.comparator, range)
    : "unknown";

  const flag = row.printedFlag;
  const directional = flag === "low" || flag === "high";

  return {
    status: flaggedStatus(computed, flag),
    range,
    basis,
    conflict:
      directional &&
      basis === "report" &&
      computed !== "unknown" &&
      computed !== flag,
    doubtfulRange: row.printedRange && !printed ? row.printedRangeText : null,
  };
}

export function toLabResults(rows: readonly LabRow[]): LabResult[] {
  return rows.map((row, index) => {
    const analyte = findAnalyte(row.name);
    return {
      ...row,
      id: `${row.source}:${row.page}:${index}`,
      analyte,
      ...assess(row, analyte),
    };
  });
}
