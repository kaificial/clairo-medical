import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  extractDocument,
  readPageItems,
  type ExtractedDocument,
} from "@/lib/pdf";

import { toLabResults } from "./assess";
import { groupSeries, isOutOfRange } from "./series";
import { readLabTables } from "./table";

const SAMPLE = fileURLToPath(
  new URL("../../../public/example-medical.pdf", import.meta.url),
);

let document: ExtractedDocument;

beforeAll(async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({
    data: new Uint8Array(readFileSync(SAMPLE)),
    verbosity: 0,
  }).promise;
  document = extractDocument(await readPageItems(pdf));
});

describe("the bundled sample report", () => {
  it("reads all twelve lab rows and nothing else", () => {
    const rows = readLabTables(document);

    expect(rows.map((row) => `${row.name} ${row.valueText}`)).toEqual([
      "Lactate 6.1",
      "ALP 450",
      "ALT 1001",
      "AST 850",
      "Bilirubin 24",
      "INR 1.1",
      "Creatinine 170",
      "ALP 35",
      "ALT 90",
      "AST 70",
      "Bilirubin 17",
      "Creatinine 66",
    ]);
    expect(rows.every((row) => row.page === 2)).toBe(true);
  });

  it("groups them into trends and flags what is still out of range", () => {
    const series = groupSeries(toLabResults(readLabTables(document)));

    expect(
      series.map((entry) => [
        entry.label,
        entry.results.length,
        entry.latest.status,
      ]),
    ).toEqual([
      ["Lactate", 1, "high"],
      ["ALP", 2, "normal"],
      ["ALT", 2, "high"],
      ["AST", 2, "high"],
      ["Bilirubin", 2, "normal"],
      ["INR", 1, "normal"],
      ["Creatinine", 2, "normal"],
    ]);
    expect(series.filter(isOutOfRange).map((entry) => entry.label)).toEqual([
      "Lactate",
      "ALT",
      "AST",
    ]);
    expect(series.every((entry) => entry.latest.basis === "typical")).toBe(
      true,
    );
  });
});
