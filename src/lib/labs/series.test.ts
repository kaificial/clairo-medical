import { describe, expect, it } from "vitest";

import { toLabResults } from "./assess";
import { formatDate, formatRange, rangeScale } from "./display";
import { groupSeries, isOutOfRange, mergeRows } from "./series";
import type { LabRow } from "./types";

function row(overrides: Partial<LabRow>): LabRow {
  return {
    name: "ALT",
    value: 30,
    valueText: "30",
    comparator: null,
    unit: "IU/L",
    date: null,
    printedRange: null,
    printedRangeText: null,
    printedFlag: null,
    page: 2,
    source: "table",
    ...overrides,
  };
}

describe("groupSeries", () => {
  it("groups repeat readings oldest first, whatever the alias", () => {
    const series = groupSeries(
      toLabResults([
        row({ name: "ALT", value: 90, date: "14-Oct-2015" }),
        row({ name: "Lactate", value: 6.1, unit: "mmol/L" }),
        row({ name: "SGPT", value: 1001, date: "08-Oct-2015" }),
      ]),
    );

    expect(series.map((entry) => entry.key)).toEqual(["alt", "lactate"]);
    expect(series[0]?.results.map((result) => result.value)).toEqual([
      1001, 90,
    ]);
    expect(series[0]?.latest.value).toBe(90);
    expect(series[0] ? isOutOfRange(series[0]) : false).toBe(true);
  });

  it("keeps report order when a date cannot be read", () => {
    const series = groupSeries(
      toLabResults([
        row({ value: 90, date: "14/10/2015" }),
        row({ value: 1001, date: "08-Oct-2015" }),
      ]),
    );
    expect(series[0]?.results.map((result) => result.value)).toEqual([
      90, 1001,
    ]);
  });
});

describe("mergeRows", () => {
  it("adds only readings that are not already there", () => {
    const table = [row({ value: 90 })];
    const model = [
      row({ name: "Alanine aminotransferase", value: 90, source: "model" }),
      row({ name: "Lactate", value: 6.1, unit: null, source: "model" }),
    ];

    expect(mergeRows(table, model).map((entry) => entry.name)).toEqual([
      "ALT",
      "Lactate",
    ]);
  });
});

describe("format", () => {
  it("writes ranges the way a reader would say them", () => {
    expect(formatRange({ low: 4, high: 56 }, "U/L")).toBe("4–56 U/L");
    expect(formatRange({ high: 5.6 }, "%")).toBe("5.6% or below");
    expect(formatRange({ low: 60 }, null)).toBe("60 or above");
  });

  it("writes readable dates and leaves unreadable ones as printed", () => {
    expect(formatDate("08 - Oct - 2015")).toBe("8 Oct 2015");
    expect(formatDate("03/04/2015")).toBe("03/04/2015");
    expect(formatDate(null)).toBeNull();
  });
});

describe("rangeScale", () => {
  it("puts in range values inside the band", () => {
    const scale = rangeScale(30, { low: 4, high: 56 });
    expect(scale?.band).toEqual([0.3, 0.7]);
    expect(scale?.marker).toBeGreaterThan(0.3);
    expect(scale?.marker).toBeLessThan(0.7);
  });

  it("keeps far out values apart and on the track", () => {
    const near = rangeScale(90, { low: 4, high: 56 })?.marker ?? 0;
    const far = rangeScale(1001, { low: 4, high: 56 })?.marker ?? 0;
    expect(near).toBeGreaterThan(0.7);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThan(1);
    expect(rangeScale(1, { low: 30, high: 147 })?.marker).toBeGreaterThan(0);
  });

  it("handles one sided ranges", () => {
    expect(rangeScale(5, { high: 10 })?.band).toEqual([0, 0.7]);
    expect(rangeScale(90, { low: 60 })?.band).toEqual([0.3, 1]);
    expect(rangeScale(5, {})).toBeNull();
  });
});
