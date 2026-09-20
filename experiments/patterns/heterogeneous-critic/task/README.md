# timekit

Small time helpers.

```js
import { formatSeconds } from "./src/format.mjs";

formatSeconds(5400); // "1h30m"
formatSeconds(45);   // "45s"
formatSeconds(0.5);  // "500ms"
```

`formatSeconds(seconds)` writes a non-negative number of seconds as the
shortest run of `h`, `m`, `s` and `ms` parts, in that order, leaving out the
parts that are zero (so `3600` is `"1h"`, `61` is `"1m1s"`, `0` is `"0s"`).
A negative or non-finite number throws a `RangeError`; a non-number throws a
`TypeError`.
