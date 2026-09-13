import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { sectionStrategy } from "./sections";

function chunk(id: string, headings: string[]): Chunk {
  return { id, text: id, page: 1, endPage: 1, headings, kind: "prose" };
}

const chunks = [
  chunk("history", ["CT ABDOMEN", "CLINICAL HISTORY"]),
  chunk("bowel", ["CT ABDOMEN", "FINDINGS", "Bowel"]),
  chunk("impression", ["CT ABDOMEN", "IMPRESSION"]),
  chunk("plan", ["Plan"]),
  chunk("meds", ["DISCHARGE MEDICATIONS"]),
];

async function ids(query: string) {
  return (await sectionStrategy(chunks)(query, 5)).map((hit) => hit.chunk.id);
}

describe("sectionStrategy", () => {
  it("sends a summary question to the impression", async () => {
    expect(await ids("What did the scan find overall?")).toEqual([
      "impression",
    ]);
  });

  it("sends next steps, reasons and medicines to their sections", async () => {
    expect(await ids("What should I do next?")).toEqual(["plan"]);
    expect(await ids("Why was this scan done?")).toEqual(["history"]);
    expect(await ids("What new medicines am I on?")).toEqual(["meds"]);
  });

  it("stays out of questions about a specific value", async () => {
    expect(await ids("What was my potassium?")).toEqual([]);
  });
});
