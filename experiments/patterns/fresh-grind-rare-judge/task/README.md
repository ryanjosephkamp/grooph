# calc

A small arithmetic evaluator, built in two phases (`docs/PHASES.md`): a
tokenizer, then an evaluator on top of it.

```js
import { tokenize } from "./src/tokenize.mjs";
import { evaluate } from "./src/evaluate.mjs";

tokenize("1 + 2");   // [{ type: "number", value: 1, at: 0 }, { type: "op", value: "+", at: 2 }, { type: "number", value: 2, at: 4 }]
evaluate("1 + 2 * 3"); // 7
```

Neither file exists yet. `tests/tokenize.test.mjs` specifies the tokenizer and
fails; the evaluator's tests are written in phase 2 from its entry in
`docs/PHASES.md`.
