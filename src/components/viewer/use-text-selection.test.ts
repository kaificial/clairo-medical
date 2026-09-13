import { describe, expect, it } from "vitest";

import { isExplainable, normalizeSelection } from "./use-text-selection";

describe("normalizeSelection", () => {
  it("rejoins a phrase the text layer broke across lines", () => {
    expect(normalizeSelection("acute\nkidney   injury\n")).toBe(
      "acute kidney injury",
    );
  });
});

describe("isExplainable", () => {
  it("accepts a highlighted term", () => {
    expect(isExplainable("Creatinine")).toBe(true);
  });

  it("rejects a stray character from a mis-drag", () => {
    expect(isExplainable("")).toBe(false);
    expect(isExplainable("a")).toBe(false);
  });

  it("rejects a selection with no letters in it", () => {
    expect(isExplainable("1.8 / 2.0")).toBe(false);
  });

  it("rejects a selection long enough to be a page", () => {
    expect(isExplainable("word ".repeat(100))).toBe(false);
  });
});
