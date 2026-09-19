/**
 * Storage persistence (handoff 0007, criterion 7). Browsers may evict a
 * site's IndexedDB under storage pressure unless the site asks for
 * persistent storage. grooph asks once, after the first thing it saves, and
 * tells the person once what the browser answered. It never asks again and
 * never repeats the notice.
 */
import { useSyncExternalStore } from "react";

import { onSave } from "./db.js";

export type Persistence = {
  /** what the browser answered; `unsupported` when it has no `navigator.storage.persist` */
  result: "granted" | "denied" | "unsupported";
  /** the person dismissed the notice */
  seen: boolean;
};

const KEY = "grooph.persistence";

function read(): Persistence | null {
  try {
    const text = localStorage.getItem(KEY);
    return text ? (JSON.parse(text) as Persistence) : null;
  } catch {
    return null;
  }
}

function write(value: Persistence): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage refused (a private mode): the notice shows for this visit only.
  }
  current = value;
  for (const listener of listeners) listener();
}

let current: Persistence | null = read();
let asking = false;
const listeners = new Set<() => void>();

/** Ask the browser for persistent storage, once per device. */
export async function requestPersistence(): Promise<void> {
  if (current !== null || asking) return;
  asking = true;
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage || typeof storage.persist !== "function") {
      write({ result: "unsupported", seen: false });
      return;
    }
    const already = typeof storage.persisted === "function" ? await storage.persisted() : false;
    const granted = already || (await storage.persist());
    write({ result: granted ? "granted" : "denied", seen: false });
  } catch {
    write({ result: "denied", seen: false });
  } finally {
    asking = false;
  }
}

export function dismissPersistence(): void {
  if (current) write({ ...current, seen: true });
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The notice to show, or null: nothing asked yet, or already dismissed. */
export function usePersistenceNotice(): Persistence | null {
  const value = useSyncExternalStore(subscribe, () => current);
  return value && !value.seen ? value : null;
}

// The first save to the device (a new graph, an import, a saved template) is the moment to ask.
onSave(() => void requestPersistence());
