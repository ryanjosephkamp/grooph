# notes-store

An in-memory note store: `addNote`, `listNotes`, `removeNote`.

```js
import { addNote, listNotes, removeNote } from "./src/notes.mjs";

let notes = [];
notes = addNote(notes, "buy milk");      // [{ id: 1, text: "buy milk" }]
notes = addNote(notes, "call Sam");      // ids count up from 1
notes = removeNote(notes, 1);            // [{ id: 2, text: "call Sam" }]
listNotes(notes);                        // the notes, oldest first
```

Every function returns a new array and leaves its input alone. `removeNote`
with an id that is not in the list throws a `RangeError`; a note id that is
not a positive integer throws a `TypeError`.

Releases are marked by a `PUBLISHED.txt` at the project root, written once per
release by whoever publishes; it is never edited or removed afterwards.
