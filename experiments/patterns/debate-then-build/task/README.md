# wordbook

`lookup(word)` says whether a word is in the word list (`data/words.txt`, one
lowercase word per line, sorted). It is used by a spell-checker that calls it
once per token of a document, so a page of text means a few hundred calls.

```js
import { lookup } from "./src/dictionary.mjs";

lookup("bala");   // true
lookup("Bala");   // true: lookup is case-insensitive
lookup("xyzzy");  // false
```

The word list is edited by hand now and then (a word added or removed) while
the checker keeps running; a change should be picked up without restarting.
`lookup` returns a boolean, never throws on a string, and throws a `TypeError`
on anything that is not a string.

Known problem: every call reads and parses the whole list from disk, so a
document takes seconds to check.
