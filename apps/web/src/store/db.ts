/**
 * Graphs on the device. IndexedDB (architecture: storage is a shell concern);
 * when the browser refuses it (some private modes), an in-memory store keeps
 * the app usable and the UI says nothing will survive a reload.
 */
import type { Graph, RunBundle } from "@grooph/core";

export type GraphRecord = {
  /** local key; the document's own `id` may repeat across copies */
  key: string;
  doc: Graph;
  createdAt: number;
  updatedAt: number;
  /** the graph id of the last package downloaded from this device, so a rename can warn that the folder name changes */
  exported?: { id: string; at: number };
};

/** A template the person saved or added on this device ("Yours"). Keyed by the template's id, its name in a registry. */
export type TemplateRecord = {
  id: string;
  doc: Graph;
  savedAt: number;
};

/**
 * A run kept on this device (docs/runs.md §4), beside the graphs. Keyed by
 * graph id and run id, so saving the same run again replaces it with the
 * newer copy of its notes.
 */
export type RunRecord = {
  key: string;
  /** the id of the graph the run followed, which is how the library lists it */
  graphId: string;
  run: string;
  bundle: RunBundle;
  savedAt: number;
};

export interface GraphStore {
  readonly persistent: boolean;
  list(): Promise<GraphRecord[]>;
  get(key: string): Promise<GraphRecord | undefined>;
  put(record: GraphRecord): Promise<void>;
  delete(key: string): Promise<void>;
  /** user templates, beside the graphs */
  readonly templates: RecordStore<TemplateRecord>;
  /** runs imported or saved from a link or a watch, beside the graphs */
  readonly runs: RecordStore<RunRecord>;
}

export interface RecordStore<T> {
  list(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "grooph";
const STORE = "graphs";
const TEMPLATES = "templates";
const RUNS = "runs";

/** Called after every successful write to the device, so storage persistence can be asked for after the first one. */
let afterSave: () => void = () => {};
export function onSave(fn: () => void): void {
  afterSave = fn;
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Version 2 adds the templates store (slice 0007), version 3 the runs store (slice 0008); what is there stays as it is.
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(TEMPLATES)) db.createObjectStore(TEMPLATES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RUNS)) db.createObjectStore(RUNS, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

class IdbRecords<T> implements RecordStore<T> {
  constructor(
    private readonly db: IDBDatabase,
    private readonly name: string,
  ) {}
  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(this.name, mode).objectStore(this.name);
  }
  async list(): Promise<T[]> {
    return request(this.tx("readonly").getAll() as IDBRequest<T[]>);
  }
  async get(key: string): Promise<T | undefined> {
    return request(this.tx("readonly").get(key) as IDBRequest<T | undefined>);
  }
  async put(record: T): Promise<void> {
    await request(this.tx("readwrite").put(record));
    afterSave();
  }
  async delete(key: string): Promise<void> {
    await request(this.tx("readwrite").delete(key));
  }
}

class IdbStore extends IdbRecords<GraphRecord> implements GraphStore {
  readonly persistent = true;
  readonly templates: RecordStore<TemplateRecord>;
  readonly runs: RecordStore<RunRecord>;
  constructor(db: IDBDatabase) {
    super(db, STORE);
    this.templates = new IdbRecords<TemplateRecord>(db, TEMPLATES);
    this.runs = new IdbRecords<RunRecord>(db, RUNS);
  }
}

class MemoryRecords<T> implements RecordStore<T> {
  private readonly records = new Map<string, T>();
  constructor(private readonly keyOf: (record: T) => string) {}
  async list(): Promise<T[]> {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
  async get(key: string): Promise<T | undefined> {
    const r = this.records.get(key);
    return r && structuredClone(r);
  }
  async put(record: T): Promise<void> {
    this.records.set(this.keyOf(record), structuredClone(record));
  }
  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
}

class MemoryStore extends MemoryRecords<GraphRecord> implements GraphStore {
  readonly persistent = false;
  readonly templates = new MemoryRecords<TemplateRecord>((r) => r.id);
  readonly runs = new MemoryRecords<RunRecord>((r) => r.key);
  constructor() {
    super((r) => r.key);
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
