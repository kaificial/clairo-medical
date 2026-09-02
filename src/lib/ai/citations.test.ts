import { describe, expect, it } from "vitest";

import { parseCitations } from "./citations";

describe("parseCitations", () => {
  it("returns plain text untouched", () => {
    expect(parseCitations("Your sodium was normal.")).toEqual([
      { kind: "text", text: "Your sodium was normal." },
    ]);
  });

  it("pulls a citation out of a sentence", () => {
    expect(parseCitations("ALT was 1001 [p.2].")).toEqual([
      { kind: "text", text: "ALT was 1001 " },
      { kind: "citation", text: "[p.2]", page: 2 },
      { kind: "text", text: "." },
    ]);
  });

  it("finds several citations", () => {
    const pages = parseCitations("First [p.1] then [p.3].")
      .filter((part) => part.kind === "citation")
      .map((part) => part.page);

    expect(pages).toEqual([1, 3]);
  });

  it("takes the first page of a cited range", () => {
    expect(parseCitations("[p.2-3]")[0]).toEqual({
      kind: "citation",
      text: "[p.2-3]",
      page: 2,
    });
  });

  it("tolerates spacing and capitalisation", () => {
    expect(parseCitations("[P. 4]")[0]).toMatchObject({
      kind: "citation",
      page: 4,
    });
  });

  it("leaves something that is not a citation as text", () => {
    expect(parseCitations("See [page 2] and [p.x].")).toEqual([
      { kind: "text", text: "See [page 2] and [p.x]." },
    ]);
  });

  it("ignores a zero page", () => {
    expect(parseCitations("[p.0]")).toEqual([{ kind: "text", text: "[p.0]" }]);
  });

  it("handles an answer that is only a citation", () => {
    expect(parseCitations("[p.1]")).toEqual([
      { kind: "citation", text: "[p.1]", page: 1 },
    ]);
  });

  it("handles an empty answer", () => {
    expect(parseCitations("")).toEqual([]);
  });
});
