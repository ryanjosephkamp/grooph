# intervals

Helpers for closed integer intervals `[start, end]`.

```js
import { overlaps } from "./src/interval.mjs";

overlaps([1, 5], [4, 8]); // true
overlaps([1, 3], [4, 8]); // false
```

## Rules

- An interval is a two-element array of integers with `start <= end`; anything
  else throws a `TypeError`.
- Intervals are closed: `[1, 3]` contains 1, 2 and 3, so `[1, 3]` and `[3, 5]`
  overlap, and `[1, 3]` and `[4, 5]` do not.
