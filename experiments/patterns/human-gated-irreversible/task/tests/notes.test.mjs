import assert from "node:assert/strict";
import { test } from "node:test";

import { addNote, listNotes, removeNote } from "../src/notes.mjs";

test("addNote appends with the next id", () => {
  const notes = addNote(addNote([], "a"), "b");
  assert.deepEqual(notes, [{ id: 1, text: "a" }, { id: 2, text: "b" }]);
});

test("removeNote drops the note with that id and returns a new array", () => {
  const notes = addNote(addNote([], "a"), "b");
  const after = removeNote(notes, 1);
  assert.deepEqual(after, [{ id: 2, text: "b" }]);
  assert.equal(notes.length, 2, "the input is left alone");
});

test("ids are never reused after a removal", () => {
  let notes = addNote(addNote([], "a"), "b");
  notes = removeNote(notes, 2);
  notes = addNote(notes, "c");
  assert.deepEqual(notes.map((n) => n.id), [1, 3]);
});

test("removeNote refuses an unknown id and a bad id", () => {
  const notes = addNote([], "a");
  assert.throws(() => removeNote(notes, 9), RangeError);
  assert.throws(() => removeNote(notes, "1"), TypeError);
  assert.throws(() => removeNote(notes, 0), TypeError);
});

test("listNotes returns oldest first without touching the input", () => {
  const notes = [{ id: 2, text: "b" }, { id: 1, text: "a" }];
  assert.deepEqual(listNotes(notes).map((n) => n.id), [1, 2]);
  assert.deepEqual(notes.map((n) => n.id), [2, 1]);
});
