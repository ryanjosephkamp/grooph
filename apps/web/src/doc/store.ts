/**
 * The open document. One mutable cell the editor reads with
 * `useSyncExternalStore`, so every operation sees the latest document even
 * inside the same event, and text inputs stay synchronous.
 */
import { useSyncExternalStore } from "react";

import type { Graph } from "@grooph/core";

export class DocStore {
  private doc: Graph;
  private readonly listeners = new Set<() => void>();

  constructor(doc: Graph) {
    this.doc = doc;
  }

  get = (): Graph => this.doc;

  set = (doc: Graph): void => {
    if (doc === this.doc) return;
    this.doc = doc;
    for (const listener of this.listeners) listener();
  };

  update = (fn: (doc: Graph) => Graph): void => this.set(fn(this.doc));

  /** Apply an operation that also returns a value (a new id, say). */
  updateWith = <T>(fn: (doc: Graph) => { doc: Graph } & T): T => {
    const result = fn(this.doc);
    this.set(result.doc);
    return result;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const useDoc = (store: DocStore): Graph => useSyncExternalStore(store.subscribe, store.get);
