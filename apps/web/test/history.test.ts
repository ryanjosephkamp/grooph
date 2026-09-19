import { addNode, removeNode, setGraphName, updateNode, type Graph } from "@grooph/core";
import { describe, expect, test } from "vitest";

import { DocStore, MERGE_WINDOW_MS, UNDO_LIMIT, textFieldsChanged, typing } from "../src/doc/store.js";
import { reviewLoop } from "./helpers.js";

/** A store on a clock the test moves by hand. */
function clocked(doc: Graph) {
  let now = 1_000;
  const store = new DocStore(doc, () => now);
  return { store, tick: (ms: number) => (now += ms) };
}

describe("undo and redo (handoff 0007, criterion 6)", () => {
  test("every edit is a step; undo and redo walk the documents back and forth", () => {
    const start = reviewLoop();
    const { store } = clocked(start);
    expect(store.getHistory()).toEqual({ canUndo: false, canRedo: false });

    store.update((d) => addNode(d, "stop").doc);
    const added = store.get();
    store.update((d) => removeNode(d, "critic"));
    expect(store.get().nodes.some((n) => n.id === "critic")).toBe(false);

    expect(store.undo()).toBe(true);
    expect(store.get()).toBe(added);
    expect(store.undo()).toBe(true);
    expect(store.get()).toBe(start);
    expect(store.undo()).toBe(false);
    expect(store.getHistory()).toEqual({ canUndo: false, canRedo: true });

    expect(store.redo()).toBe(true);
    expect(store.get()).toBe(added);
    // A new edit drops what could be redone.
    store.update((d) => setGraphName(d, "Other"));
    expect(store.getHistory()).toEqual({ canUndo: true, canRedo: false });
  });

  test(`the stack is bounded at ${UNDO_LIMIT} steps, well past 50`, () => {
    const { store } = clocked(reviewLoop());
    for (let i = 0; i < UNDO_LIMIT + 20; i++) store.update((d) => ({ ...d, version: d.version + 1 }));
    let undone = 0;
    while (store.undo()) undone++;
    expect(UNDO_LIMIT).toBeGreaterThanOrEqual(50);
    expect(undone).toBe(UNDO_LIMIT);
    expect(store.get().version).toBe(reviewLoop().version + 20);
  });

  test("typing into one field is one step; a pause, another field or a tap starts a new one", () => {
    const start = reviewLoop();
    const { store, tick } = clocked(start);
    const type = (text: string) => typing(() => store.update((d) => ({ ...d, goal: text })));
    type("A");
    tick(200);
    type("Ab");
    tick(200);
    type("Abc");
    expect(store.undo()).toBe(true);
    expect(store.get()).toBe(start);

    store.redo();
    tick(MERGE_WINDOW_MS + 1);
    type("Abcd");
    store.undo();
    expect(store.get().goal).toBe("Abc");

    // The same kind of change from a tap is its own step even when quick.
    const { store: taps, tick: tickTaps } = clocked(start);
    const tier = (t: "fast" | "strong") => taps.update((d) => updateNode(d, "critic", (n) => ({ ...n, model: { tier: t } }) as typeof n));
    tier("fast");
    tickTaps(100);
    tier("strong");
    taps.undo();
    expect((taps.get().nodes.find((n) => n.id === "critic") as { model?: { tier: string } }).model?.tier).toBe("fast");
  });

  test("typing a name is one step though the id that follows it changes only on some keys", () => {
    const start = reviewLoop();
    const { store, tick } = clocked(start);
    const rename = (name: string) => typing(() => store.update((d) => setGraphName(d, name)));
    for (const name of ["Renamed", "Renamed ", "Renamed g", "Renamed gr"]) {
      rename(name);
      tick(100);
    }
    expect(store.get().id).toBe("renamed-gr");
    store.undo();
    expect(store.get()).toBe(start);
    // Another field is another step.
    typing(() => store.update((d) => ({ ...d, goal: "x" })));
    typing(() => store.update((d) => ({ ...d, description: "y" })));
    store.undo();
    expect(store.get().goal).toBe("x");
  });

  test("textFieldsChanged names string edits in place, and nothing structural", () => {
    const doc = reviewLoop();
    expect(textFieldsChanged(doc, { ...doc, goal: "x" })).toEqual(new Set(["/goal"]));
    expect(textFieldsChanged(doc, { ...doc, version: 2 })).toBeNull();
    expect(textFieldsChanged(doc, { ...doc, nodes: doc.nodes.slice(1) })).toBeNull();
    expect(textFieldsChanged(doc, doc)).toBeNull();
  });
});
