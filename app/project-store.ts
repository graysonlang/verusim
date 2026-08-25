import {
  type AuthoringStore,
  type AuthoringStoreBackend,
  type AuthoringStoreRecord,
  createAuthoringStore,
} from '../src/index.js';

/**
 * The browser adapter for the authoring-store port. Records rest in one
 * IndexedDB object store keyed by semantic identity with a metadata row for
 * the revision; a save replaces the whole record set in one readwrite
 * transaction so a commit is atomic, and the shared store core supplies
 * ordering, identity checks, revision digests, and conflict detection.
 */
export const PROJECT_DATABASE_NAME = 'verusim-authoring';
const DATABASE_VERSION = 1;
const DOCUMENTS_STORE = 'documents';
const META_STORE = 'meta';
const REVISION_KEY = 'revision';

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`Cannot open ${name}`));
    request.onblocked = () => reject(new Error(`Opening ${name} is blocked by another tab`));
  });
}

function requestResult<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createIndexedDbBackend(name = PROJECT_DATABASE_NAME): AuthoringStoreBackend {
  return {
    async load() {
      const database = await openDatabase(name);
      try {
        const transaction = database.transaction([DOCUMENTS_STORE, META_STORE], 'readonly');
        const records = (await requestResult(
          transaction.objectStore(DOCUMENTS_STORE).getAll(),
        )) as AuthoringStoreRecord[];
        const meta = (await requestResult(transaction.objectStore(META_STORE).get(REVISION_KEY))) as
          | { key: string; revision: string }
          | undefined;
        await transactionDone(transaction);
        return { records, revision: meta?.revision ?? null };
      } finally {
        database.close();
      }
    },
    async save(records, revision) {
      const database = await openDatabase(name);
      try {
        const transaction = database.transaction([DOCUMENTS_STORE, META_STORE], 'readwrite');
        const documents = transaction.objectStore(DOCUMENTS_STORE);
        documents.clear();
        for (const record of records) documents.put(record);
        transaction.objectStore(META_STORE).put({ key: REVISION_KEY, revision });
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    },
  };
}

export function createIndexedDbAuthoringStore(name = PROJECT_DATABASE_NAME): AuthoringStore {
  return createAuthoringStore(createIndexedDbBackend(name));
}

/** Remove the saved project entirely; the next save starts from an empty store. */
export function deleteProjectDatabase(name = PROJECT_DATABASE_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Cannot delete ${name}`));
    request.onblocked = () => reject(new Error(`Deleting ${name} is blocked by another tab`));
  });
}
