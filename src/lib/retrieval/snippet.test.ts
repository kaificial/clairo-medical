import { describe, expect, it } from "vitest";

import { snippet } from "./snippet";

const LONG = `Patient presented with five days of increased urinary frequency. ${"Narrative filler sentence. ".repeat(10)} Creatinine peaked at 170 umol/L before recovering.`;

describe("snippet", () => {
  it("returns short text unchanged", () => {
    expect(snippet("Sodium normal.", "sodium")).toBe("Sodium normal.");
  });

  it("collapses whitespace", () => {
    expect(snippet("Sodium\n  normal.", "sodium")).toBe("Sodium normal.");
  });

  it("centres the window on the query term", () => {
    expect(snippet(LONG, "creatinine")).toContain("Creatinine");
  });

  it("stays within the requested length, ellipses aside", () => {
    const out = snippet(LONG, "creatinine", 80);
    expect(out.replace(/…/g, "").length).toBeLessThanOrEqual(80);
  });

  it("falls back to the opening when the term is absent", () => {
    const out = snippet(LONG, "radiotherapy", 40);
    expect(out.startsWith("Patient presented")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });

  it("opens on a word boundary, quoting the source verbatim", () => {
    const body = snippet(LONG, "creatinine", 80).replace(/…/g, "").trim();
    const flat = LONG.replace(/\s+/g, " ").trim();
    const at = flat.indexOf(body);

    expect(at).toBeGreaterThan(-1);
    expect(at === 0 || flat[at - 1] === " ").toBe(true);
  });
});
