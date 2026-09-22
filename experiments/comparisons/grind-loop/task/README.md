# semver-mini

Compare semantic versions by the precedence rules of semver.org §11.

```js
import { compare } from "./src/semver.mjs";

compare("1.0.0-beta.2", "1.0.0-beta.11"); // -1
```
