# csvline

`parseCsvLine(text)` parses one CSV record into its fields. It feeds an import
job that accepts files from outside, so the input is anything at all.

```js
import { parseCsvLine, CsvError } from "./src/csv.mjs";

parseCsvLine('a,b,c');                 // ["a", "b", "c"]
parseCsvLine('"x, y",z');              // ["x, y", "z"]
parseCsvLine('"say ""hi""",');         // ['say "hi"', ""]
```

## Contract

For every string `text`, `parseCsvLine` either returns the fields as an array
of strings, or throws `CsvError` (exported, a subclass of `Error`). It never
throws anything else, never hangs, and returns within a second for a record of
100 KB. Anything that is not a string throws a `TypeError`.

Fields:

- Fields are separated by `,`. The empty text is one empty field: `[""]`; `a,`
  is `["a", ""]`.
- A field may be wrapped in double quotes. Inside quotes, `""` is one `"`, and
  commas, `\n` and `\r\n` are literal characters of the field.
- After a closing quote, only a comma, the record terminator or the end of the
  text may follow; anything else is a `CsvError`. A quoted field that never
  closes is a `CsvError`.
- Outside quotes, a `"` anywhere is a `CsvError` (`a"b`, `a "b"`).
- Whitespace outside quotes is part of the field: `' a '` stays `" a "`.
- One record terminator (`\n` or `\r\n`) at the very end of the text is
  removed; any other unquoted `\r` or `\n` is a `CsvError`.
- Every other character, including tabs, control characters and any Unicode,
  is a literal character of its field.
