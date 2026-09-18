/**
 * Graphs on the device. IndexedDB (architecture: storage is a shell concern);
 * when the browser refuses it (some private modes), an in-memory store keeps
 * the app usable and the UI says nothing will survive a reload.
 */
import type { Graph } from "@grooph/core";

export type GraphRecord = {
  /** local key; the document's own `id` may repeat across copies */
  key: string;
  doc: Graph;
  createdAt: number;
  updatedAt: number;
};

export interface GraphStore {
  readonly persistent: boolean;
  list(): Promise<GraphRecord[]>;
  get(key: string): Promise<GraphRecord | undefined>;
  put(record: GraphRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "grooph";
const STORE = "graphs";

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

class IdbStore implements GraphStore {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}
  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }
  async list(): Promise<GraphRecord[]> {
    return request(this.tx("readonly").getAll() as IDBRequest<GraphRecord[]>);
  }
  async get(key: string): Promise<GraphRecord | undefined> {
    return request(this.tx("readonly").get(key) as IDBRequest<GraphRecord | undefined>);
  }
  async put(record: GraphRecord): Promise<void> {
    await request(this.tx("readwrite").put(record));
  }
  async delete(key: string): Promise<void> {
    await request(this.tx("readwrite").delete(key));
  }
}

class MemoryStore implements GraphStore {
  readonly persistent = false;
  private readonly records = new Map<string, GraphRecord>();
  async list(): Promise<GraphRecord[]> {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
  async get(key: string): Promise<GraphRecord | undefined> {
    const r = this.records.get(key);
    return r && structuredClone(r);
  }
  async put(record: GraphRecord): Promise<void> {
    this.records.set(record.key, structuredClone(record));
  }
  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
}

let opened: Promise<GraphStore> | undefined;

export function openStore(): Promise<GraphStore> {
  opened ??= openDb().then(
    (db) => new IdbStore(db) as GraphStore,
    () => new MemoryStore(),
  );
  return opened;
}

/** A local key. `crypto.randomUUID` needs a secure context; a LAN http address is not one. */
export function newKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
