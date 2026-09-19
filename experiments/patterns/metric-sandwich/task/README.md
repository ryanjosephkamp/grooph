# listkit

Helpers for lists held in memory.

## Pagination

```js
import { paginate } from "./src/paginate.mjs";

paginate(["a", "b", "c", "d", "e"], 2, 0); // ["a", "b"], the first page
paginate(["a", "b", "c", "d", "e"], 2, 2); // ["e"], the last page
```

Pages are numbered from 0, so the first page is page 0.

## Checks

`npm run check` runs the lint and the tests.
