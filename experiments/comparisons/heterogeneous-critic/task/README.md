# printkit

Small helpers behind a print dialog.

```js
import { paperSize } from "./src/paper.mjs";

paperSize("A4");     // { width: 210, height: 297 }
paperSize("letter"); // { width: 215.9, height: 279.4 }
```

`paperSize(name)` gives the width and height of a paper size in millimeters,
portrait. It knows `A3`, `A4`, `A5`, `letter` and `legal`; the name is matched
without regard to letter case. An unknown name throws a `RangeError`; a name
that is not a string throws a `TypeError`.

The dialog also has a page box, where a person types which pages of the
document to print.
