import { describe, expect, it } from "vitest";

import { bodyFontSize, isHeading, toBlocks } from "./blocks";
import type { Line } from "./types";

function line(
  cells: Array<[text: string, x: number]>,
  fontSize = 10,
  y = 0,
): Line {
  const built = cells.map(([text, x]) => ({
    text,
    x,
    width: text.length * fontSize * 0.5,
  }));
  return {
    page: 1,
    y,
    fontSize,
    cells: built,
    text: built.map((c) => c.text).join("  "),
  };
}

describe("bodyFontSize", () => {
  it("returns the most common line size", () => {
    const lines = [
      line([["Title", 0]], 18),
      line([["body one", 0]], 10),
      line([["body two", 0]], 10),
      line([["body three", 0]], 10),
    ];

    expect(bodyFontSize(lines)).toBe(10);
  });

  it("returns 0 with no lines", () => {
    expect(bodyFontSize([])).toBe(0);
  });
});

describe("isHeading", () => {
  it("treats a noticeably larger line as a heading", () => {
    expect(isHeading(line([["Lipid panel", 0]], 16), 10)).toBe(true);
  });

  it("treats an all-caps line at body size as a heading", () => {
    expect(isHeading(line([["LIPID PANEL", 0]], 10), 10)).toBe(true);
  });

  it("rejects ordinary prose at body size", () => {
    expect(isHeading(line([["Recommend repeat testing.", 0]], 10), 10)).toBe(
      false,
    );
  });

  it("rejects a multi-column line even when large", () => {
    expect(
      isHeading(
        line(
          [
            ["Glucose", 0],
            ["98", 200],
          ],
          16,
        ),
        10,
      ),
    ).toBe(false);
  });

  it("rejects a very long all-caps line", () => {
    const long = "A".repeat(120);
    expect(isHeading(line([[long, 0]], 10), 10)).toBe(false);
  });
});

describe("toBlocks", () => {
  it("keeps aligned multi-column lines as a table with cells intact", () => {
    const rows = [
      line(
        [
          ["Test", 0],
          ["Result", 200],
          ["Reference", 320],
        ],
        10,
        700,
      ),
      line(
        [
          ["Creatinine", 0],
          ["1.4 mg/dL", 200],
          ["0.6 - 1.3", 320],
        ],
        10,
        680,
      ),
      line(
        [
          ["Potassium", 0],
          ["5.3 mmol/L", 200],
          ["3.5 - 5.1", 320],
        ],
        10,
        660,
      ),
    ];

    const blocks = toBlocks(rows, 1);

    expect(blocks).toHaveLength(1);
    const table = blocks[0];
    expect(table?.kind).toBe("table");
    expect(table?.kind === "table" && table.rows).toEqual([
      ["Test", "Result", "Reference"],
      ["Creatinine", "1.4 mg/dL", "0.6 - 1.3"],
      ["Potassium", "5.3 mmol/L", "3.5 - 5.1"],
    ]);
  });

  it("does not call a lone multi-column line a table", () => {
    const blocks = toBlocks(
      [
        line(
          [
            ["Patient", 0],
            ["Jane Doe", 200],
          ],
          10,
          700,
        ),
      ],
      1,
    );

    expect(blocks[0]?.kind).toBe("paragraph");
  });

  it("merges consecutive prose lines into one paragraph", () => {
    const blocks = toBlocks(
      [
        line([["Mildly reduced kidney function with", 0]], 10, 700),
        line([["elevated creatinine and potassium.", 0]], 10, 680),
      ],
      1,
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.text).toBe(
      "Mildly reduced kidney function with elevated creatinine and potassium.",
    );
  });

  it("preserves heading, table, paragraph order", () => {
    const blocks = toBlocks(
      [
        line([["LIPID PANEL", 0]], 10, 720),
        line(
          [
            ["HDL", 0],
            ["45 mg/dL", 200],
          ],
          10,
          700,
        ),
        line(
          [
            ["LDL", 0],
            ["140 mg/dL", 200],
          ],
          10,
          680,
        ),
        line([["Recommend clinical correlation.", 0]], 10, 660),
      ],
      1,
    );

    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "table",
      "paragraph",
    ]);
  });

  it("carries the page number onto every block", () => {
    const blocks = toBlocks([line([["Something here.", 0]], 10, 700)], 4);

    expect(blocks[0]?.page).toBe(4);
  });
});
