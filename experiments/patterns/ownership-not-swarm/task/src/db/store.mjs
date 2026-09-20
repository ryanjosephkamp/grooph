/** A fresh in-memory store. */
export function createStore() {
  return { notes: [], nextId: 1 };
}

/** Adds a note and returns it. */
export function addNote(store, text) {
  if (typeof text !== "string" || text.trim() === "") throw new TypeError("addNote: text must be a non-empty string");
  const note = { id: store.nextId, text };
  store.nextId += 1;
  store.notes.push(note);
  return note;
}

/** All notes, oldest first, as copies. */
export function listNotes(store) {
  return store.notes.map((note) => ({ ...note }));
}
