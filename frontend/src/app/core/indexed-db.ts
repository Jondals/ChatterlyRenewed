/**
 * src/app/core/indexed-db.ts
 * Tiny helpers over IndexedDB shared by the stores that keep data on this device (keys, stickers, sounds):
 * open a database with one object store and run a single request inside a transaction.
 */

/** Where a store lives: the database, the object store and (optionally) the field that holds each record's key. */
export interface StoreLocation {
  database: string;
  store: string;
  keyPath?: string;
}

/** Opens the database, creating the object store the first time. */
export function openStore(location: StoreLocation): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>(function open(resolve, reject) {
    const request = indexedDB.open(location.database, 1);
    request.onupgradeneeded = function create() {
      request.result.createObjectStore(
        location.store,
        location.keyPath ? { keyPath: location.keyPath } : undefined,
      );
    };
    request.onsuccess = function opened() {
      resolve(request.result);
    };
    request.onerror = function failed() {
      reject(request.error);
    };
  });
}

/** Runs one request inside a transaction of the object store and returns its result. */
export async function runInStore<T>(
  location: StoreLocation,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openStore(location);
  try {
    return await new Promise<T>(function execute(resolve, reject) {
      const request = action(db.transaction(location.store, mode).objectStore(location.store));
      request.onsuccess = function succeeded() {
        resolve(request.result as T);
      };
      request.onerror = function failed() {
        reject(request.error);
      };
    });
  } finally {
    db.close();
  }
}
