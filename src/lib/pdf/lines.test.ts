import { describe, expect, it } from "vitest";

import { groupIntoLines } from "./lines";
import type { TextItem } from "./types";

function item(
  str: string,
  x: number,
  y: number,
  size = 10,
  width = str.length * size * 0.5,
): TextItem {
  return { str, transform: [size, 0, 0, size, x, y], width, height: size };
}

describe("groupIntoLines", () => {
  it("puts items sharing a baseline on one line, ordered by x", () => {
    const lines = groupIntoLines(
      [item("world", 200, 700), item("hello", 72, 700)],
      1,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.cells.map((c) => c.text)).toEqual(["hello", "world"]);
  });

  it("separates baselines and orders lines top to bottom", () => {
    const lines = groupIntoLines(
      [item("second", 72, 680), item("first", 72, 700)],
      1,
    );

    expect(lines.map((l) => l.text)).toEqual(["first", "second"]);
  });

  it("tolerates sub-pixel baseline drift within a line", () => {
    const lines = groupIntoLines(
      [item("a", 72, 700), item("b", 100, 700.4)],
      1,
    );

    expect(lines).toHaveLength(1);
  });

  it("merges fragments separated by a word-sized gap into one cell", () => {
    const lines = groupIntoLines(
      [item("Total", 0, 700, 10, 30), item("cholesterol", 36, 700, 10, 60)],
      1,
    );

    expect(lines[0]?.cells).toHaveLength(1);
    expect(lines[0]?.cells[0]?.text).toBe("Total cholesterol");
  });

  it("keeps fragments separated by a column gap as separate cells", () => {
    const lines = groupIntoLines(
      [item("Creatinine", 0, 700, 10, 30), item("1.4 mg/dL", 120, 700, 10, 40)],
      1,
    );

    expect(lines[0]?.cells.map((c) => c.text)).toEqual([
      "Creatinine",
      "1.4 mg/dL",
    ]);
  });

  it("splits a single item on runs of three or more spaces", () => {
    const lines = groupIntoLines(
      [item("Glucose   98 mg/dL   70 - 99", 0, 700, 10, 280)],
      1,
    );

    expect(lines[0]?.cells.map((c) => c.text)).toEqual([
      "Glucose",
      "98 mg/dL",
      "70 - 99",
    ]);
  });

  it("does not split on a single space", () => {
    const lines = groupIntoLines([item("Jane Doe", 0, 700, 10, 80)], 1);

    expect(lines[0]?.cells.map((c) => c.text)).toEqual(["Jane Doe"]);
  });

  it("ignores whitespace-only items", () => {
    const lines = groupIntoLines([item("   ", 0, 700), item("x", 0, 680)], 1);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("x");
  });

  it("returns nothing for an empty page", () => {
    expect(groupIntoLines([], 1)).toEqual([]);
  });
});
