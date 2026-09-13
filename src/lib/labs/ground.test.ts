import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { groundModelRows, labPassages, type ModelLabRow } from "./ground";

const passages = [
  {
    text: "Serum lactate was elevated at 6.1. ALT | 14-Oct-2015 | 1,001 | IU/L | 7-56",
    page: 2,
    endPage: 2,
  },
  { text: "Sodium 140 mmol/L", page: 3, endPage: 3 },
];

function model(overrides: Partial<ModelLabRow>): ModelLabRow {
  return {
    name: "ALT",
    value: "1001",
    unit: "IU/L",
    referenceRange: "7-56",
    flag: null,
    date: "14-Oct-2015",
    page: 2,
    ...overrides,
  };
}

describe("groundModelRows", () => {
  it("keeps a result whose name and value are on the cited page", () => {
    const { rows, discarded } = groundModelRows([model({})], passages);
    expect(discarded).toBe(0);
    expect(rows[0]).toMatchObject({
      name: "ALT",
      value: 1001,
      unit: "IU/L",
      printedRange: { low: 7, high: 56 },
      date: "14-Oct-2015",
      source: "model",
    });
  });

  it("reads a result from prose", () => {
    const { rows } = groundModelRows(
      [
        model({
          name: "Serum lactate",
          value: "6.1",
          unit: null,
          referenceRange: null,
          date: null,
        }),
      ],
      passages,
    );
    expect(rows[0]).toMatchObject({ name: "Serum lactate", value: 6.1 });
  });

  it("discards a value the page does not contain", () => {
    const { rows, discarded } = groundModelRows(
      [
        model({ value: "100" }),
        model({ value: "6.1", name: "Lactate", page: 3 }),
      ],
      passages,
    );
    expect(rows).toEqual([]);
    expect(discarded).toBe(2);
  });

  it("discards a test name the page does not contain", () => {
    expect(groundModelRows([model({ name: "AST" })], passages).discarded).toBe(
      1,
    );
  });

  it("drops an invented range but keeps the result", () => {
    const { rows } = groundModelRows(
      [model({ referenceRange: "10-40", flag: "H" })],
      passages,
    );
    expect(rows[0]).toMatchObject({
      printedRange: null,
      printedRangeText: null,
      printedFlag: "high",
    });
  });

  it("does not match a number inside a longer one", () => {
    expect(groundModelRows([model({ value: "001" })], passages).discarded).toBe(
      1,
    );
    expect(
      groundModelRows(
        [
          model({
            name: "Sodium",
            value: "14",
            page: 3,
            unit: null,
            referenceRange: null,
            date: null,
          }),
        ],
        passages,
      ).discarded,
    ).toBe(1);
  });
});

function chunk(id: string, text: string, kind: Chunk["kind"] = "prose"): Chunk {
  return { id, text, page: 1, endPage: 1, headings: [], kind };
}

describe("labPassages", () => {
  it("keeps passages with numbers and a lab signal, in reading order", () => {
    const chunks = [
      chunk("a", "Call 416-555-5555 to book."),
      chunk("b", "Serum lactate was elevated at 6.1."),
      chunk("c", "Sodium | 140 | mmol/L", "table"),
      chunk("d", "The patient tolerated the procedure well."),
    ];

    expect(labPassages(chunks).map((entry) => entry.id)).toEqual(["b", "c"]);
  });

  it("never sends a table of identifiers just because it has digits", () => {
    const chunks = [
      chunk(
        "id",
        "Patient Name: Smith, John | DOB: 25-Dec-1950, 65 years old\nMRN: 1234567 | Gender: Male",
        "table",
      ),
      chunk("visit", "Visit Number: | 11186424686", "table"),
    ];

    expect(labPassages(chunks)).toEqual([]);
  });

  it("prefers tables and units when it has to choose", () => {
    const chunks = [
      chunk("prose", "Blood cultures were drawn on day 2."),
      chunk("units", "Creatinine rose to 170 umol/L."),
      chunk("table", "Test | Result\nALT | 90", "table"),
    ];

    expect(labPassages(chunks, 2).map((entry) => entry.id)).toEqual([
      "units",
      "table",
    ]);
  });
});
