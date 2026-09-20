# userfiles

The file store behind the "my files" page: each user has a root folder on
disk, and the HTTP layer (not in this repository) calls these helpers with the
user's root and whatever the request carried: a file name, a subfolder, a
search string.

```js
import { listFiles, readUserFile, writeUserFile } from "./src/store.mjs";

writeUserFile(root, "notes.txt", "hello");
readUserFile(root, "notes.txt");        // "hello"
listFiles(root);                        // [{ name: "notes.txt", size: 5 }]
```

- `readUserFile(root, name)` returns the text of the named file under `root`.
- `writeUserFile(root, name, text)` writes it, creating `root` if needed.
- `listFiles(root)` lists the files directly under `root` with their sizes in
  bytes, sorted by name.

Users keep anything from a few notes to thousands of documents of a few
megabytes each; the page calls the store on every request, with no cache in
front of it.
