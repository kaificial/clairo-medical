import { describe, expect, it } from "vitest";

import { furnitureKey, stripFurniture } from "./furniture";
import type { Line } from "./types";

function line(text: string, y: number, page = 1): Line {
  return {
    page,
    y,
    fontSize: 10,
    cells: [{ text, x: 50, width: text.length * 5 }],
    text,
  };
}

/** A page with a running header, a footer, and body text between them. */
function page(header: string, body: string, footer: string, n: number) {
  return [line(header, 730, n), line(body, 400, n), line(footer, 60, n)];
}

describe("furnitureKey", () => {
  it("ignores the digits that change from page to page", () => {
    expect(furnitureKey("Page 1 of 3")).toBe(furnitureKey("Page 2 of 3"));
  });

  it("keeps different headers apart", () => {
    expect(furnitureKey("Lab report")).not.toBe(furnitureKey("Page 1 of 3"));
  });
});

describe("stripFurniture", () => {
  it("removes a header and footer repeated on every page", () => {
    const stripped = stripFurniture([
      page("SAMPLE Page 1 of 3", "First page body.", "Confidential", 1),
      page("SAMPLE Page 2 of 3", "Second page body.", "Confidential", 2),
      page("SAMPLE Page 3 of 3", "Third page body.", "Confidential", 3),
    ]);

    expect(stripped.flat().map((l) => l.text)).toEqual([
      "First page body.",
      "Second page body.",
      "Third page body.",
    ]);
  });

  it("keeps repeated text that sits in the body of the page", () => {
    const stripped = stripFurniture([
      [line("Follow up with your doctor.", 400, 1)],
      [line("Follow up with your doctor.", 400, 2)],
    ]);

    expect(stripped.flat()).toHaveLength(2);
  });

  it("keeps an edge line that appears on only one page", () => {
    const stripped = stripFurniture([
      [line("Header", 730, 1), line("Body one", 400, 1)],
      [line("Different title", 730, 2), line("Body two", 400, 2)],
    ]);

    expect(stripped.flat()).toHaveLength(4);
  });

  it("leaves a single page untouched", () => {
    const pages = [[line("Page 1 of 1", 730, 1), line("Body", 400, 1)]];
    expect(stripFurniture(pages)).toEqual(pages);
  });

  it("tolerates an empty page", () => {
    expect(stripFurniture([[], [line("Body", 400, 2)]])).toEqual([
      [],
      [line("Body", 400, 2)],
    ]);
  });
});
