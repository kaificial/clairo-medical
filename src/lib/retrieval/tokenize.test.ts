import { describe, expect, it } from "vitest";

import { tokenize } from "./tokenize";

describe("tokenize", () => {
  it("lowercases and drops punctuation", () => {
    expect(tokenize("Acute kidney injury.")).toEqual([
      "acute",
      "kidney",
      "injury",
    ]);
  });

  it("keeps decimal results whole", () => {
    expect(tokenize("Lactate 6.1 mmol/L")).toContain("6.1");
  });

  it("splits a unit into searchable parts", () => {
    expect(tokenize("450 IU/L")).toEqual(["450", "iu"]);
  });

  it("drops stop words", () => {
    expect(tokenize("the patient was in the hospital")).toEqual([
      "patient",
      "hospital",
    ]);
  });

  it("matches a plural query to a singular term", () => {
    expect(tokenize("kidneys")).toEqual(tokenize("kidney"));
  });

  it("leaves words that merely end in s alone", () => {
    expect(tokenize("sepsis")).toEqual(["sepsis"]);
  });

  it("returns nothing for empty input", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});
