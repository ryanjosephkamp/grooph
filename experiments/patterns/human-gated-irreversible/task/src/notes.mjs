/**
 * Adds a note and returns the new list. Ids count up from 1 and are never reused.
 * @param {{ id: number, text: string }[]} notes
 * @param {string} text
 */
export function addNote(notes, text) {
  if (typeof text !== "string" || text.trim() === "") throw new TypeError("addNote: text must be a non-empty string");
  const id = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
  return [...notes, { id, text }];
}

/** The notes, oldest first, as a new array. */
export function listNotes(notes) {
  return [...notes].sort((a, b) => a.id - b.id);
}
