export type Comparator = "<" | ">" | "<=" | ">=";

export type PrintedFlag = "low" | "high" | "abnormal";

export type LabStatus = "low" | "normal" | "high" | "abnormal" | "unknown";

/**
 * Inclusive bounds. A missing side means the range is open that way, like
 * "<5.6" for HbA1c.
 */
export interface ReferenceRange {
  low?: number;
  high?: number;
}

/**
 * One result exactly as the report prints it, before we've decided anything
 * about it.
 */
export interface LabRow {
  name: string;
  value: number;
  valueText: string;
  comparator: Comparator | null;
  unit: string | null;
  date: string | null;
  printedRange: ReferenceRange | null;
  printedRangeText: string | null;
  printedFlag: PrintedFlag | null;
  page: number;
  source: "table" | "model";
}

export interface Analyte {
  key: string;
  label: string;
  name: string;
  aliases: readonly string[];
  /**
   * Keyed by normalized unit. The empty key is for unitless results such as
   * INR.
   */
  ranges: Readonly<Record<string, ReferenceRange>>;
}

/**
 * Where a range came from: "report" means it was printed next to the result,
 * "typical" means the report had none and we filled in a broad adult range.
 */
export type RangeBasis = "report" | "typical";

export interface LabResult extends LabRow {
  id: string;
  analyte: Analyte | null;
  status: LabStatus;
  range: ReferenceRange | null;
  basis: RangeBasis | null;
  /**
   * The report flagged this result, but its own printed range says otherwise.
   */
  conflict: boolean;
  /**
   * A printed range we set aside as impossible for this test, kept as text so
   * the panel can show it.
   */
  doubtfulRange: string | null;
}

/**
 * Every reading of one test in the report, oldest first, with the latest pulled
 * out for display.
 */
export interface LabSeries {
  key: string;
  label: string;
  name: string | null;
  results: LabResult[];
  latest: LabResult;
}
