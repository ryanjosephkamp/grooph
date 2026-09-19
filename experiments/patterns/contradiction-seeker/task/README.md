# slugs

Turn titles into URL slugs.

```js
import { slugify } from "./src/slugify.mjs";

slugify("Crème Brûlée, Twice!"); // "creme-brulee-twice"
slugify("A very long title indeed", { maxLength: 10 }); // at most 10 characters
```
