# tagnotes

A small notes service in layers:

```
src/db/       the in-memory store: notes and, soon, their tags
src/api/      request handlers over the store: { method, path, body } in, { status, body } out
src/format/   (to build) renderTable(notes): notes as a fixed-width text table
src/export/   (to build) exportCsv(notes): notes as CSV text
src/index.mjs (to build) createApp(): the wired application
tests/        end-to-end tests through createApp()
```

Each layer keeps its own unit tests beside its code (`src/db/store.test.mjs`,
`src/api/handle.test.mjs`, and so on); `npm test` runs those and `tests/`.
`src/format/` and `src/export/` take plain note objects and touch neither the
store nor the handlers.

## Today

```js
import { createStore, addNote, listNotes } from "./src/db/store.mjs";
import { createHandler } from "./src/api/handle.mjs";

const store = createStore();
const handle = createHandler(store);
handle({ method: "POST", path: "/notes", body: { text: "buy milk" } });   // { status: 201, body: { id: 1, text: "buy milk" } }
handle({ method: "GET", path: "/notes" });                                 // { status: 200, body: [ { id: 1, text: "buy milk" } ] }
```

## The change

Notes get tags. A tag is a lowercase word (`[a-z0-9-]+`); a note has a set of
tags, empty at first.

- Store: `tagNote(store, id, tag)` adds a tag (idempotent; unknown id throws
  `RangeError`; a malformed tag throws `TypeError`); `notesByTag(store, tag)`
  lists notes carrying it, oldest first. A note object is `{ id, text, tags }`
  with `tags` a sorted array.
- API: `POST /notes/:id/tags` with body `{ tag }` → `201` and the note, `404`
  for an unknown id, `400` for a malformed tag; `GET /notes?tag=<tag>` → `200`
  and the matching notes; `GET /notes` still lists all, now with `tags`.
- Format: `renderTable(notes)` → text with a header row `id | text | tags`,
  one row per note, columns padded to the widest cell, tags joined by `,`.
- Export: `exportCsv(notes)` → `id,text,tags` header then one line per note,
  `text` quoted when it holds a comma, quote or newline (quotes doubled), tags
  joined by `;`.
- App: `createApp()` in `src/index.mjs` returns `{ handle, renderTable, exportCsv }`
  where `handle` is the API over a fresh store and the other two render what
  `GET /notes` returns. `tests/app.test.mjs` specifies it end to end.
