import type { LabStatus, ReferenceRange } from "./types";
import { parseDate } from "./values";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function withUnit(value: string, unit: string | null): string {
  if (!unit) return value;
  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

export function formatRange(
  { low, high }: ReferenceRange,
  unit: string | null,
): string {
  const suffix = withUnit("", unit);
  if (low !== undefined && high !== undefined) return `${low}–${high}${suffix}`;
  if (high !== undefined) return `${high}${suffix} or below`;
  if (low !== undefined) return `${low}${suffix} or above`;
  return "";
}

/**
 * Shows dates in one consistent style, like "8 Oct 2015". A date we can't read
 * confidently is shown exactly as printed.
 */
export function formatDate(printed: string | null): string | null {
  if (printed === null) return null;
  const iso = parseDate(printed);
  return iso
    ? DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`))
    : printed.trim();
}

export const STATUS_LABEL: Readonly<Record<LabStatus, string>> = {
  low: "Low",
  high: "High",
  normal: "In range",
  abnormal: "Flagged",
  unknown: "No range",
};

const BAND_START = 0.3;
const BAND_END = 0.7;
const EDGE = 0.04;

interface RangeScale {
  /**
   * Where the normal band sits on the gauge, from 0 at the left edge to 1 at
   * the right.
   */
  band: readonly [number, number];
  marker: number;
}

/**
 * Squashes how far outside the band a value is into the space beside it. On the
 * sample report ALT drops from 1001 to 90 against a limit of 56, and both
 * readings should still land in clearly different spots.
 */
function beyond(distance: number, room: number): number {
  return (room - EDGE) * (1 - 1 / (1 + 2 * Math.max(0, distance)));
}

/**
 * Positions a value against its range for the little gauge under each lab
 * result.
 */
export function rangeScale(
  value: number,
  { low, high }: ReferenceRange,
): RangeScale | null {
  if (low !== undefined && high !== undefined && high > low) {
    const ratio = (value - low) / (high - low);
    const marker =
      ratio < 0
        ? BAND_START - beyond(-ratio, BAND_START)
        : ratio > 1
          ? BAND_END + beyond(ratio - 1, 1 - BAND_END)
          : BAND_START + ratio * (BAND_END - BAND_START);
    return { band: [BAND_START, BAND_END], marker };
  }

  if (high !== undefined && high > 0) {
    const ratio = value / high;
    const marker =
      ratio > 1
        ? BAND_END + beyond(ratio - 1, 1 - BAND_END)
        : Math.max(EDGE, ratio * BAND_END);
    return { band: [0, BAND_END], marker };
  }

  if (low !== undefined && low > 0) {
    const ratio = value / low;
    const marker =
      ratio < 1
        ? Math.max(EDGE, ratio * BAND_START)
        : BAND_START + beyond(ratio - 1, 1 - BAND_START);
    return { band: [BAND_START, 1], marker };
  }

  return null;
}
