# settingskit

Settings for a command-line tool, as plain data.

A tool's settings come in layers: the defaults it ships with, the user's
settings file, and the flags of one run. Each layer is a plain object, read
from JSON or TOML or built from the command line.

```js
import { getPath } from "./src/get.mjs";

const settings = { output: { color: "auto", width: 80 } };

getPath(settings, "output.color");     // "auto"
getPath(settings, "output.pager", ""); // "" (the fallback: no such setting)
```

`getPath(settings, path, fallback)` reads one setting by a dotted path. It
returns the fallback (`undefined` when none is given) if any step of the path
is missing. A `path` that is not a non-empty string throws a `TypeError`.
