import { describe, expect, it } from "vitest";

import { findAnalyte, typicalRange } from "./analytes";
import { assess, compareToRange, toLabResults } from "./assess";
import type { LabRow } from "./types";

function row(overrides: Partial<LabRow>): LabRow {
  return {
    name: "Sodium",
    value: 140,
    valueText: "140",
    comparator: null,
    unit: "mmol/L",
    date: null,
    printedRange: null,
    printedRangeText: null,
    printedFlag: null,
    page: 1,
    source: "table",
    ...overrides,
  };
}

describe("findAnalyte", () => {
  it("matches aliases exactly after normalizing", () => {
    expect(findAnalyte("ALT (SGPT)")?.key).toBe("alt");
    expect(findAnalyte("Serum Creatinine")?.key).toBe("creatinine");
    expect(findAnalyte("Bilirubin, Total")?.key).toBe("bilirubin");
    expect(findAnalyte("Direct bilirubin")).toBeNull();
    expect(findAnalyte("Visit Number")).toBeNull();
  });

  it("only offers a typical range in a matching unit", () => {
    const creatinine = findAnalyte("Creatinine");
    expect(typicalRange(creatinine, "umol/L")).toEqual({ low: 45, high: 115 });
    expect(typicalRange(creatinine, "mg/dL")).toEqual({ low: 0.5, high: 1.3 });
    expect(typicalRange(creatinine, "mmol/L")).toBeNull();
    expect(typicalRange(creatinine, null)).toBeNull();
    expect(typicalRange(findAnalyte("INR"), null)).toEqual({
      low: 0.8,
      high: 1.2,
    });
  });
});

describe("compareToRange", () => {
  it("places plain values", () => {
    expect(compareToRange(3, null, { low: 3.5, high: 5 })).toBe("low");
    expect(compareToRange(5, null, { low: 3.5, high: 5 })).toBe("normal");
    expect(compareToRange(5.1, null, { low: 3.5, high: 5 })).toBe("high");
    expect(compareToRange(59, null, { low: 60 })).toBe("low");
  });

  it("judges a censored value only when every reading agrees", () => {
    expect(compareToRange(5, "<", { high: 10 })).toBe("normal");
    expect(compareToRange(0.1, "<", { high: 0.04 })).toBe("unknown");
    expect(compareToRange(90, ">", { low: 60 })).toBe("normal");
    expect(compareToRange(0.5, "<", { low: 1, high: 3 })).toBe("low");
    expect(compareToRange(2, "<", { low: 1, high: 3 })).toBe("unknown");
  });
});

describe("assess", () => {
  it("prefers the range the report printed over a typical one", () => {
    const result = assess(
      row({ value: 147, printedRange: { low: 133, high: 148 } }),
      findAnalyte("Sodium"),
    );
    expect(result).toMatchObject({ status: "normal", basis: "report" });
  });

  it("falls back to a typical range when units match", () => {
    const result = assess(row({ value: 150 }), findAnalyte("Sodium"));
    expect(result).toMatchObject({
      status: "high",
      basis: "typical",
      range: { low: 135, high: 146 },
    });
  });

  it("says nothing when there is no range to compare with", () => {
    const result = assess(
      row({ name: "Ferritin", unit: "ug/L" }),
      findAnalyte("Ferritin"),
    );
    expect(result).toMatchObject({
      status: "unknown",
      basis: null,
      range: null,
    });
  });

  it("lets the report's flag win and notes when its range disagrees", () => {
    const result = assess(
      row({
        value: 140,
        printedRange: { low: 135, high: 145 },
        printedFlag: "high",
      }),
      null,
    );
    expect(result).toMatchObject({ status: "high", conflict: true });
  });

  it("gives an abnormal marker a direction when the range supplies one", () => {
    expect(
      assess(row({ value: 150, printedFlag: "abnormal" }), findAnalyte("Na"))
        .status,
    ).toBe("high");
    expect(assess(row({ printedFlag: "abnormal" }), null).status).toBe(
      "abnormal",
    );
  });
});

describe("implausible printed ranges", () => {
  it("sets aside a range no lab would print for this test", () => {
    const result = assess(
      row({
        name: "Potassium",
        value: 5.8,
        printedRange: { low: 3.5, high: 53 },
        printedRangeText: "3.5-53",
        printedFlag: "high",
      }),
      findAnalyte("Potassium"),
    );

    expect(result).toMatchObject({
      status: "high",
      basis: "typical",
      range: { low: 3.5, high: 5.2 },
      conflict: false,
      doubtfulRange: "3.5-53",
    });
  });

  it("trusts a lab's own range when it is merely different", () => {
    const result = assess(
      row({
        name: "Potassium",
        value: 5.1,
        printedRange: { low: 3.6, high: 5.0 },
        printedRangeText: "3.6-5.0",
      }),
      findAnalyte("Potassium"),
    );
    expect(result).toMatchObject({
      status: "high",
      basis: "report",
      doubtfulRange: null,
    });
  });

  it("cannot judge plausibility for a test it does not know", () => {
    const result = assess(
      row({
        name: "Ferritin",
        value: 40,
        unit: "ug/L",
        printedRange: { low: 30, high: 400 },
      }),
      null,
    );
    expect(result.basis).toBe("report");
  });
});

describe("toLabResults", () => {
  it("attaches the analyte and an id to each row", () => {
    const [result] = toLabResults([
      row({ name: "K", value: 6, unit: "mEq/L" }),
    ]);
    expect(result).toMatchObject({
      id: "table:1:0",
      analyte: { key: "potassium" },
      status: "high",
    });
  });
});
