import { nearest, type VectorRecord, type VectorStore } from "./vectors";

const DATABASE = "clairo-vectors";
const STORE = "documents";

interface StoredDocument {
  documentId: string;
  records: VectorRecord[];
}

function settle<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error("IndexedDB error"));
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
  });
}

/**
 * Keeps vectors in the browser's IndexedDB, so reopening a file reuses the
 * embeddings computed last time. Each document is read back whole and scanned
 * in memory, which is quick at a few hundred chunks.
 */
export function createIndexedDbVectorStore(
  options: { factory?: IDBFactory; databaseName?: string } = {},
): VectorStore {
  let open: Promise<IDBDatabase> | null = null;

  function database(): Promise<IDBDatabase> {
    // Look up IndexedDB on first use rather than here. Client components still
    // render once on the server, where there's no IndexedDB.
    const factory = options.factory ?? globalThis.indexedDB;
    if (!factory) {
      return Promise.reject(
        new Error("IndexedDB is not available in this environment."),
      );
    }

    open ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = factory.open(options.databaseName ?? DATABASE, 1);
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
    const tx = (await database()).transaction(STORE, "readonly");
    return settle<StoredDocument | undefined>(
      tx.objectStore(STORE).get(documentId),
    );
  }

  return {
    async put(documentId, records) {
      const tx = (await database()).transaction(STORE, "readwrite");
      const entry: StoredDocument = { documentId, records: [...records] };
      tx.objectStore(STORE).put(entry);
      await committed(tx);
    },

    async search(documentId, query, limit) {
      return nearest((await read(documentId))?.records ?? [], query, limit);
    },

    async has(documentId) {
      return (await read(documentId)) !== undefined;
    },
  };
}
