import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import { createIndexedDbVectorStore } from "./indexeddb";
import {
  DimensionMismatchError,
  toVector,
  type VectorRecord,
  type VectorStore,
} from "./vectors";

function chunk(id: string): Chunk {
  return { id, text: id, page: 1, endPage: 1, headings: [], kind: "prose" };
}

function record(id: string, vector: number[]): VectorRecord {
  return { chunk: chunk(id), vector: toVector(vector) };
}

const RECORDS = [
  record("p1#1", [1, 0, 0]),
  record("p1#2", [0, 1, 0]),
  record("p2#1", [0.9, 0.1, 0]),
];

let store: VectorStore;

beforeEach(() => {
  store = createIndexedDbVectorStore({
    factory: new IDBFactory(),
    databaseName: "test-vectors",
  });
});

describe("createIndexedDbVectorStore", () => {
  it("returns nothing for a document it has never seen", async () => {
    expect(await store.search("missing", toVector([1, 0, 0]))).toEqual([]);
    expect(await store.has("missing")).toBe(false);
  });

  it("stores a document and reports that it holds it", async () => {
    await store.put("doc", RECORDS);
    expect(await store.has("doc")).toBe(true);
  });

  it("ranks the nearest vector first, with its chunk", async () => {
    await store.put("doc", RECORDS);
    const hits = await store.search("doc", toVector([1, 0, 0]));

    expect(hits.map((h) => h.chunk.id)).toEqual(["p1#1", "p2#1", "p1#2"]);
    expect(hits[0]?.score).toBeCloseTo(1);
    expect(hits[0]?.chunk.text).toBe("p1#1");
  });

  it("honours the limit", async () => {
    await store.put("doc", RECORDS);
    expect(await store.search("doc", toVector([1, 0, 0]), 2)).toHaveLength(2);
  });

  it("keeps documents apart", async () => {
    await store.put("a", [record("p1#1", [1, 0, 0])]);
    await store.put("b", [record("p9#9", [1, 0, 0])]);

    const hits = await store.search("b", toVector([1, 0, 0]));
    expect(hits.map((h) => h.chunk.id)).toEqual(["p9#9"]);
  });

  it("replaces a document rather than appending to it", async () => {
    await store.put("doc", RECORDS);
    await store.put("doc", [record("fresh", [1, 0, 0])]);

    const hits = await store.search("doc", toVector([1, 0, 0]), 10);
    expect(hits.map((h) => h.chunk.id)).toEqual(["fresh"]);
  });

  it("rejects a query embedded by a different model", async () => {
    await store.put("doc", RECORDS);

    await expect(store.search("doc", toVector([1, 0]))).rejects.toThrow(
      DimensionMismatchError,
    );
  });

  it("survives a reopen of the same database", async () => {
    const factory = new IDBFactory();
    const first = createIndexedDbVectorStore({ factory, databaseName: "keep" });
    await first.put("doc", RECORDS);

    const second = createIndexedDbVectorStore({
      factory,
      databaseName: "keep",
    });
    expect(await second.has("doc")).toBe(true);
  });

  it("can be created where IndexedDB does not exist, failing only on use", async () => {
    const detached = createIndexedDbVectorStore({ factory: undefined });

    await expect(detached.has("doc")).rejects.toThrow(/not available/);
  });

  it("stores an empty document without breaking search", async () => {
    await store.put("doc", []);
    expect(await store.search("doc", toVector([1, 0, 0]))).toEqual([]);
  });
});
