import assert from "node:assert/strict";
import { test } from "node:test";

import { renderKeyValue } from "../src/kv.mjs";

test("renderKeyValue writes one line per key in order", () => {
  assert.equal(renderKeyValue({ host: "localhost", port: "5432" }), "host=localhost\nport=5432\n");
});

test("renderKeyValue refuses non-string values", () => {
  assert.throws(() => renderKeyValue({ port: 5432 }), TypeError);
});
