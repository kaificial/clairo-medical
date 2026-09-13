import { describe, expect, it } from "vitest";

import { extractDocument } from "./extract";
import { ocrToTextItems, scannedPages, type OcrLine } from "./ocr";
import type { TextItem } from "./types";

function word(text: string, x0: number, x1: number, confidence = 90) {
  return { text, confidence, bbox: { x0, y0: 0, x1, y1: 0 } };
}

function line(
  y0: number,
  y1: number,
  ...words: ReturnType<typeof word>[]
): OcrLine {
  return { words, bbox: { x0: words[0]?.bbox.x0 ?? 0, y0, x1: 0, y1 } };
}

const geometry = { scale: 2, pageHeight: 792 };

describe("ocrToTextItems", () => {
  it("converts pixels to PDF units with the y axis flipped", () => {
    const [item] = ocrToTextItems(
      [line(100, 124, word("Sodium", 80, 200))],
      geometry,
    );

    expect(item).toEqual({
      str: "Sodium",
      transform: [12, 0, 0, 12, 40, 792 - 62],
      width: 60,
      height: 12,
    });
  });

  it("drops low confidence noise and blank words", () => {
    const items = ocrToTextItems(
      [
        line(
          0,
          20,
          word("Na", 0, 20),
          word("~", 30, 34, 10),
          word(" ", 40, 44),
        ),
      ],
      geometry,
    );
    expect(items.map((item) => item.str)).toEqual(["Na"]);
  });

  it("feeds layout extraction the same way a text layer would", () => {
    const table = [
      line(
        100,
        124,
        word("Test", 80, 160),
        word("Result", 500, 620),
        word("Units", 800, 900),
      ),
      line(
        140,
        164,
        word("Sodium", 80, 200),
        word("140", 500, 560),
        word("mmol/L", 800, 940),
      ),
      line(
        180,
        204,
        word("Potassium", 80, 250),
        word("5.9", 500, 560),
        word("mmol/L", 800, 940),
      ),
    ];

    const document = extractDocument([ocrToTextItems(table, geometry)]);
    const block = document.pages[0]?.blocks[0];

    expect(block?.kind).toBe("table");
    expect(block?.kind === "table" ? block.rows : []).toEqual([
      ["Test", "Result", "Units"],
      ["Sodium", "140", "mmol/L"],
      ["Potassium", "5.9", "mmol/L"],
    ]);
  });
});

describe("scannedPages", () => {
  const item = (str: string): TextItem => ({
    str,
    transform: [10, 0, 0, 10, 0, 0],
    width: 10,
    height: 10,
  });

  it("flags pages whose text layer is empty or nearly so", () => {
    expect(
      scannedPages([
        [item("Discharge summary for the patient")],
        [],
        [item("12")],
      ]),
    ).toEqual([2, 3]);
  });
});
