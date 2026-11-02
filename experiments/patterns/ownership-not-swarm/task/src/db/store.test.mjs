import assert from "node:assert/strict";
import { test } from "node:test";

import { addNote, createStore, listNotes } from "./store.mjs";

test("addNote numbers notes from 1 and listNotes returns copies", () => {
  const store = createStore();
  addNote(store, "a");
  addNote(store, "b");
  const notes = listNotes(store);
  assert.deepEqual(notes.map((n) => [n.id, n.text]), [[1, "a"], [2, "b"]]);
  notes[0].text = "changed";
  assert.equal(listNotes(store)[0].text, "a");
});

test("addNote refuses empty text", () => {
  assert.throws(() => addNote(createStore(), "  "), TypeError);
});
