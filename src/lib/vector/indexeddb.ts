import { cosineSimilarity, DimensionMismatchError } from "./similarity";
import type { VectorMatch, VectorRecord, VectorStore } from "./types";

const DATABASE = "clairo-vectors";
const STORE = "documents";
const VERSION = 1;
const DEFAULT_LIMIT = 5;

/** What one document occupies in the object store. */
interface StoredDocument {
  documentId: string;
  dimensions: number;
  records: VectorRecord[];
}

export interface IndexedDbOptions {
  /** Injectable so tests can drive a fake, and so callers can namespace. */
  factory?: IDBFactory;
  databaseName?: string;
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error("IndexedDB error"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
  });
}

/**
 * A local vector store. Documents are small enough that a whole document is
 * read back and scored in memory: an exact scan over a few hundred chunks beats
 * maintaining an approximate index in the browser.
 */
export function createIndexedDbVectorStore(
  options: IndexedDbOptions = {},
): VectorStore {
  const databaseName = options.databaseName ?? DATABASE;

  let open: Promise<IDBDatabase> | null = null;

  function database(): Promise<IDBDatabase> {
    // Resolved on first use, not at construction: a client component is still
    // rendered on the server, where there is no IndexedDB.
    const factory = options.factory ?? globalThis.indexedDB;
    if (!factory) {
      return Promise.reject(
        new Error("IndexedDB is not available in this environment."),
      );
    }

    open ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = factory.open(databaseName, VERSION);
      opening.onupgradeneeded = () => {
        if (!opening.result.objectStoreNames.contains(STORE)) {
          opening.result.createObjectStore(STORE, { keyPath: "documentId" });
        }
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () =>
        reject(opening.error ?? new Error("Could not open IndexedDB"));
    });

    return open;
  }

  async function read(documentId: string): Promise<StoredDocument | undefined> {
    const db = await database();
    const tx = db.transaction(STORE, "readonly");
    const stored = await request<StoredDocument | undefined>(
      tx.objectStore(STORE).get(documentId),
    );
    return stored;
  }

  return {
    async put(documentId, records) {
      const db = await database();
      const tx = db.transaction(STORE, "readwrite");

      const entry: StoredDocument = {
        documentId,
        dimensions: records[0]?.vector.length ?? 0,
        records: [...records],
      };
      tx.objectStore(STORE).put(entry);

      await done(tx);
    },

    async search(documentId, query, limit = DEFAULT_LIMIT) {
      const stored = await read(documentId);
      if (!stored || stored.records.length === 0) return [];

      if (stored.dimensions !== query.length) {
        throw new DimensionMismatchError(stored.dimensions, query.length);
      }

      const matches: VectorMatch[] = stored.records.map((record) => ({
        chunk: record.chunk,
        score: cosineSimilarity(record.vector, query),
      }));

      return matches
        .sort((a, b) =>
          b.score === a.score
            ? a.chunk.id.localeCompare(b.chunk.id)
            : b.score - a.score,
        )
        .slice(0, Math.max(0, limit));
    },

    async has(documentId) {
      return (await read(documentId)) !== undefined;
    },

    async remove(documentId) {
      const db = await database();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(documentId);
      await done(tx);
    },

    async clear() {
      const db = await database();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      await done(tx);
    },
  };
}
