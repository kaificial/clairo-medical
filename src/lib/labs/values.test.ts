import { describe, expect, it } from "vitest";

import {
  isDateLike,
  looksLikeUnit,
  normalizeUnit,
  parseDate,
  parseFlag,
  parseRange,
  parseResultValue,
} from "./values";

describe("parseResultValue", () => {
  it("reads plain, grouped and censored values", () => {
    expect(parseResultValue("6.1")).toMatchObject({
      value: 6.1,
      comparator: null,
    });
    expect(parseResultValue("1,001")).toMatchObject({ value: 1001 });
    expect(parseResultValue("<0.5")).toMatchObject({
      value: 0.5,
      comparator: "<",
    });
    expect(parseResultValue("≥ 90")).toMatchObject({
      value: 90,
      comparator: ">=",
    });
  });

  it("peels a trailing flag and unit off the value", () => {
    expect(parseResultValue("6.1 H")).toMatchObject({
      value: 6.1,
      flag: "high",
    });
    expect(parseResultValue("3.1 (L)")).toMatchObject({ flag: "low" });
    expect(parseResultValue("140 mmol/L")).toMatchObject({
      value: 140,
      unit: "mmol/L",
      flag: null,
    });
    expect(parseResultValue("12*")).toMatchObject({ flag: "abnormal" });
  });

  it("refuses cells that only start with a number", () => {
    expect(parseResultValue("08 - Oct - 2015")).toBeNull();
    expect(parseResultValue("3.5-5.0")).toBeNull();
    expect(
      parseResultValue("2 diabetes with no known complications"),
    ).toBeNull();
    expect(parseResultValue("416-555-5555")).toBeNull();
    expect(parseResultValue("80/40")).toBeNull();
    expect(parseResultValue("Lactate")).toBeNull();
  });
});

describe("parseRange", () => {
  it("reads closed ranges with or without a label and unit", () => {
    expect(parseRange("3.5-5.0")).toEqual({
      range: { low: 3.5, high: 5 },
      unit: null,
    });
    expect(parseRange("(3.5 to 5.0 mmol/L)")).toEqual({
      range: { low: 3.5, high: 5 },
      unit: "mmol/L",
    });
    expect(parseRange("Ref range: 135 – 145")).toMatchObject({
      range: { low: 135, high: 145 },
    });
  });

  it("reads one sided limits", () => {
    expect(parseRange("<200")?.range).toEqual({ high: 200 });
    expect(parseRange("≥ 60")?.range).toEqual({ low: 60 });
    expect(parseRange("up to 5.6 %")).toEqual({
      range: { high: 5.6 },
      unit: "%",
    });
  });

  it("refuses dates and inverted ranges", () => {
    expect(parseRange("14-10-2015")).toBeNull();
    expect(parseRange("10-14-2015")).toBeNull();
    expect(parseRange("08-Oct-2015")).toBeNull();
    expect(parseRange("6.1")).toBeNull();
  });
});

describe("units", () => {
  it("collapses common spellings", () => {
    expect(normalizeUnit("IU/L")).toBe("u/l");
    expect(normalizeUnit("µmol/L")).toBe("umol/l");
    expect(normalizeUnit("umol/L")).toBe("umol/l");
    expect(normalizeUnit("x10^9/L")).toBe("10^9/l");
    expect(normalizeUnit("10*9/L")).toBe("10^9/l");
    expect(normalizeUnit("K/uL")).toBe("10^9/l");
    expect(normalizeUnit("µIU/mL")).toBe("miu/l");
    expect(normalizeUnit("mL/min/1.73 m²")).toBe("ml/min/1.73m2");
  });

  it("recognises units and rejects words", () => {
    expect(looksLikeUnit("mmol/L")).toBe(true);
    expect(looksLikeUnit("%")).toBe(true);
    expect(looksLikeUnit("fL")).toBe(true);
    expect(looksLikeUnit("Units")).toBe(false);
    expect(looksLikeUnit("years")).toBe(false);
    expect(looksLikeUnit("mg")).toBe(false);
  });
});

describe("parseFlag", () => {
  it("maps the usual markers", () => {
    expect(parseFlag("H")).toBe("high");
    expect(parseFlag("(LOW)")).toBe("low");
    expect(parseFlag("↑")).toBe("high");
    expect(parseFlag("*")).toBe("abnormal");
    expect(parseFlag("Hb")).toBeNull();
  });
});

describe("dates", () => {
  it("reads unambiguous formats as ISO", () => {
    expect(parseDate("08 - Oct - 2015")).toBe("2015-10-08");
    expect(parseDate("14-Oct-2015 09:30")).toBe("2015-10-14");
    expect(parseDate("Oct 8, 2015")).toBe("2015-10-08");
    expect(parseDate("2015-10-14")).toBe("2015-10-14");
  });

  it("leaves day and month order it cannot know unread", () => {
    expect(parseDate("03/04/2015")).toBeNull();
    expect(isDateLike("03/04/2015")).toBe(true);
    expect(parseDate("31-Feb-2015")).toBeNull();
  });
});
