import { describe, expect, it } from "vitest";

import type { ExtractedDocument } from "@/lib/pdf";

import { readLabTables, readRow } from "./table";

describe("readRow", () => {
  it("reads a row whose ordinal sits in its own cell", () => {
    expect(
      readRow(["1", "Lactate", "08 - Oct - 2015", "6.1", "mmol/L"], 2),
    ).toMatchObject({
      name: "Lactate",
      value: 6.1,
      unit: "mmol/L",
      date: "08 - Oct - 2015",
      page: 2,
    });
  });

  it("reads a row whose ordinal merged into the name", () => {
    expect(
      readRow(["10 AST", "14 - Oct - 2015", "70", "IU/L"], 2),
    ).toMatchObject({ name: "AST", value: 70, unit: "IU/L" });
  });

  it("reads range and flag columns in either order", () => {
    expect(
      readRow(["Potassium", "5.9", "H", "3.5-5.0", "mmol/L"], 1),
    ).toMatchObject({
      value: 5.9,
      printedFlag: "high",
      printedRange: { low: 3.5, high: 5 },
      printedRangeText: "3.5-5.0",
      unit: "mmol/L",
    });
    expect(readRow(["Sodium", "135 - 145", "mmol/L", "140"], 1)).toMatchObject({
      value: 140,
      unit: "mmol/L",
      printedRange: { low: 135, high: 145 },
    });
  });

  it("splits a name and value printed as one cell", () => {
    expect(readRow(["Hemoglobin 13.2 g/dL", "12.0-16.0"], 1)).toMatchObject({
      name: "Hemoglobin",
      value: 13.2,
      unit: "g/dL",
      printedRange: { low: 12, high: 16 },
    });
  });

  it("keeps a known unitless test", () => {
    expect(readRow(["6", "INR", "08 - Oct - 2015", "1.1"], 2)).toMatchObject({
      name: "INR",
      value: 1.1,
      unit: null,
    });
  });

  it("ignores numbers that are not results", () => {
    expect(readRow(["Visit Number:", "11186424686"], 1)).toBeNull();
    expect(readRow(["MRN: 1234567", "Gender: Male"], 1)).toBeNull();
    expect(readRow(["Test", "Test Date", "Results", "Units"], 1)).toBeNull();
    expect(
      readRow(
        ["Patient Name: Smith, John", "DOB: 25-Dec-1950, 65 years old"],
        1,
      ),
    ).toBeNull();
    expect(readRow(["416-340-4555", "an appointment."], 3)).toBeNull();
  });
});

describe("readRow exclusions", () => {
  it("leaves vital signs out even with a unit", () => {
    expect(readRow(["SpO2", "96", "%"], 1)).toBeNull();
    expect(readRow(["Heart rate", "68", "bpm"], 1)).toBeNull();
  });
});

describe("tables with a date per column", () => {
  function table(rows: string[][]): ExtractedDocument {
    return {
      pages: [
        { page: 1, blocks: [{ kind: "table", page: 1, rows, text: "" }] },
      ],
    };
  }

  it("reads one result per date column", () => {
    const rows = readLabTables(
      table([
        ["Test", "12-Mar-2026", "19-Mar-2026", "Units"],
        ["ALT", "88", "64", "U/L"],
        ["INR", "1.3", "", ""],
      ]),
    );

    expect(
      rows.map((row) => [row.name, row.value, row.date, row.unit]),
    ).toEqual([
      ["ALT", 88, "12-Mar-2026", "U/L"],
      ["ALT", 64, "19-Mar-2026", "U/L"],
      ["INR", 1.3, "12-Mar-2026", null],
    ]);
  });

  it("does not take a result row with two dates for a header", () => {
    const rows = readLabTables(
      table([["Glucose", "5.4", "mmol/L", "03-Mar-2026", "04-Mar-2026"]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 5.4, date: "03-Mar-2026" });
  });
});

describe("readLabTables", () => {
  it("reads only table blocks, in page order", () => {
    const document: ExtractedDocument = {
      pages: [
        {
          page: 1,
          blocks: [
            { kind: "paragraph", page: 1, text: "Sodium 140 mmol/L" },
            {
              kind: "table",
              page: 1,
              rows: [
                ["Test", "Result", "Units"],
                ["Sodium", "140", "mmol/L"],
              ],
              text: "",
            },
          ],
        },
        {
          page: 2,
          blocks: [
            {
              kind: "table",
              page: 2,
              rows: [["Creatinine", "1.4", "mg/dL"]],
              text: "",
            },
          ],
        },
      ],
    };

    expect(readLabTables(document).map((row) => [row.name, row.page])).toEqual([
      ["Sodium", 1],
      ["Creatinine", 2],
    ]);
  });
});
