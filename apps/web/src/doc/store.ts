/**
 * The open document. One mutable cell the editor reads with
 * `useSyncExternalStore`, so every operation sees the latest document even
 * inside the same event, and text inputs stay synchronous.
 *
 * Undo is a bounded stack of whole documents (the document is immutable, so a
 * step costs only the objects it changed). Typing into one field is one step,
 * not one per keystroke: an edit made by typing (see `typing`) that changes
 * a text field the typing before it changed too, soon after it, joins that
 * step (a name and the id that follows it change together). Taps, drags and deletions are always steps of their own.
 */
import { useSyncExternalStore } from "react";

import type { Graph } from "@grooph/core";

let typingDepth = 0;

/** Run an edit that comes from typing into a text field, so it may join the step before it. */
export function typing<T>(fn: () => T): T {
  typingDepth++;
  try {
    return fn();
  } finally {
    typingDepth--;
  }
}

/** How many steps back undo reaches. */
export const UNDO_LIMIT = 100;
/** Typing in the same field with pauses shorter than this is one step. */
export const MERGE_WINDOW_MS = 1200;

export type History = { canUndo: boolean; canRedo: boolean };

export class DocStore {
  private doc: Graph;
  private readonly listeners = new Set<() => void>();
  private past: Graph[] = [];
  private future: Graph[] = [];
  /** the last edit made by typing, which the next one may join; null after anything else */
  private lastEdit: { at: number; fields: ReadonlySet<string> | null } = { at: 0, fields: null };
  private history: History = { canUndo: false, canRedo: false };

  constructor(
    doc: Graph,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.doc = doc;
  }

  get = (): Graph => this.doc;

  set = (doc: Graph): void => {
    if (doc === this.doc) return;
    const at = this.now();
    const fields = typingDepth > 0 ? textFieldsChanged(this.doc, doc) : null;
    const last = this.lastEdit.fields;
    const merge = fields !== null && last !== null && [...fields].some((f) => last.has(f)) && at - this.lastEdit.at < MERGE_WINDOW_MS && this.past.length > 0;
    if (!merge) {
      this.past.push(this.doc);
      if (this.past.length > UNDO_LIMIT) this.past.shift();
    }
    this.future = [];
    this.lastEdit = { at, fields };
    this.replace(doc);
  };

  update = (fn: (doc: Graph) => Graph): void => this.set(fn(this.doc));

  /** Apply an operation that also returns a value (a new id, say). */
  updateWith = <T>(fn: (doc: Graph) => { doc: Graph } & T): T => {
    const result = fn(this.doc);
    this.set(result.doc);
    return result;
  };

  undo = (): boolean => {
    const previous = this.past.pop();
    if (previous === undefined) return false;
    this.future.push(this.doc);
    this.lastEdit = { at: 0, fields: null };
    this.replace(previous);
    return true;
  };

  redo = (): boolean => {
    const next = this.future.pop();
    if (next === undefined) return false;
    this.past.push(this.doc);
    this.lastEdit = { at: 0, fields: null };
    this.replace(next);
    return true;
  };

  getHistory = (): History => this.history;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private replace(doc: Graph): void {
    this.doc = doc;
    const canUndo = this.past.length > 0;
    const canRedo = this.future.length > 0;
    if (canUndo !== this.history.canUndo || canRedo !== this.history.canRedo) this.history = { canUndo, canRedo };
    for (const listener of this.listeners) listener();
  }
}

export const useDoc = (store: DocStore): Graph => useSyncExternalStore(store.subscribe, store.get);
export const useHistory = (store: DocStore): History => useSyncExternalStore(store.subscribe, store.getHistory);

/**
 * The paths of the text fields an edit changed, joined, when every change is
 * one string replacing another at the same place; null for anything
 * structural (an object added or removed, a number, a list growing). Unchanged
 * subtrees are shared between documents, so the walk skips them by identity.
 */
export function textFieldsChanged(before: unknown, after: unknown): Set<string> | null {
  const paths: string[] = [];
  const walk = (a: unknown, b: unknown, path: string): boolean => {
    if (a === b) return true;
    if (typeof a === "string" && typeof b === "string") {
      paths.push(path);
      return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => walk(item, b[i], `${path}/${i}`));
    }
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const ka = Object.keys(a);
      const kb = Object.keys(b);
      if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
      return ka.every((k) => walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}/${k}`));
    }
    return false;
  };
  return walk(before, after, "") && paths.length > 0 ? new Set(paths) : null;
}
