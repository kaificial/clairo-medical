import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import type { Chunk } from "@/lib/pdf";
import { createIndexedDbVectorStore, type VectorStore } from "@/lib/vector";

import { denseStrategy, embeddingText, indexDocument } from "./dense";

function chunk(id: string, text: string, headings: string[] = []): Chunk {
  return { id, text, page: 1, endPage: 1, headings, kind: "prose" };
}

const CHUNKS = [
  chunk("p1#1", "Creatinine 170 umol/L.", ["Investigations"]),
  chunk("p1#2", "Ciprofloxacin 500 mg."),
];

/** Stands in for a model: two axes, one per topic. */
const VECTORS: Record<string, number[]> = {
  "Investigations\nCreatinine 170 umol/L.": [1, 0],
  "Ciprofloxacin 500 mg.": [0, 1],
  labs: [1, 0],
  antibiotics: [0, 1],
};

const embed = (values: readonly string[]) =>
  Promise.resolve(values.map((value) => VECTORS[value] ?? [0, 0]));

function store(): VectorStore {
  return createIndexedDbVectorStore({
    factory: new IDBFactory(),
    databaseName: "dense-test",
  });
}

describe("embeddingText", () => {
  it("puts the heading trail in front of the body", () => {
    expect(embeddingText(CHUNKS[0]!)).toBe(
      "Investigations\nCreatinine 170 umol/L.",
    );
  });

  it("is just the body when there is no heading", () => {
    expect(embeddingText(CHUNKS[1]!)).toBe("Ciprofloxacin 500 mg.");
  });
});

describe("indexDocument", () => {
  it("writes one record per chunk", async () => {
    const target = store();
    const written = await indexDocument({
      store: target,
      documentId: "doc",
      chunks: CHUNKS,
      embed,
    });

    expect(written).toBe(2);
    expect(await target.has("doc")).toBe(true);
  });

  it("does not call the model for an empty document", async () => {
    const spy = vi.fn();
    const written = await indexDocument({
      store: store(),
      documentId: "doc",
      chunks: [],
      embed: spy,
    });

    expect(written).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("denseStrategy", () => {
  it("finds the chunk nearest the query", async () => {
    const target = store();
    await indexDocument({
      store: target,
      documentId: "doc",
      chunks: CHUNKS,
      embed,
    });

    const strategy = denseStrategy({
      store: target,
      documentId: "doc",
      embed,
    });

    const hits = await strategy.search("labs", 5);
    expect(hits[0]?.chunk.id).toBe("p1#1");
  });

  it("matches a query that shares no words with the chunk", async () => {
    const target = store();
    await indexDocument({
      store: target,
      documentId: "doc",
      chunks: CHUNKS,
      embed,
    });

    const hits = await denseStrategy({
      store: target,
      documentId: "doc",
      embed,
    }).search("antibiotics", 1);

    expect(hits[0]?.chunk.id).toBe("p1#2");
  });

  it("returns nothing when the document was never indexed", async () => {
    const hits = await denseStrategy({
      store: store(),
      documentId: "absent",
      embed,
    }).search("labs", 5);

    expect(hits).toEqual([]);
  });

  it("names itself so the service can report it", () => {
    expect(
      denseStrategy({ store: store(), documentId: "doc", embed }).name,
    ).toBe("dense");
  });
});
