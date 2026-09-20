# kvconf

Tiny configuration helpers for `key=value` text, the kind found in `.env` files
and simple service configs. Today it only knows how to render.

```js
import { renderKeyValue } from "./src/kv.mjs";

renderKeyValue({ host: "localhost", port: "5432" });
// "host=localhost\nport=5432\n"
```

`renderKeyValue` writes one `key=value` line per own property, in insertion
order, and ends the text with a newline. Values are written as they are; a
value that is not a string throws a `TypeError`.
