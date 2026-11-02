# usage-statement

Renders the monthly usage statement that is emailed to each customer as plain
text.

```bash
npm run render     # writes out/statement.txt from data/usage.json via src/statement.mjs
npm run capture    # renders, then copies the statement into captures/ with a readable summary
npm test           # the statement names the customer and every service
```

`src/statement.mjs` exports `renderStatement(data)` and returns the statement
as one string; `scripts/render.mjs` writes it to `out/statement.txt`.
`STYLE.md` says what the statement should look like. The statement is judged
from the files in `captures/`.

Amounts in `data/usage.json` are whole cents (`amount_cents`), so nothing is
lost to rounding; a credit is a negative amount.
