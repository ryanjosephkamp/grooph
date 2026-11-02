// One test that passes. The first call runs it twice, by `node --test` and by `npm test`, to see that a test suite
// runs inside the sandbox: the runs after it are told to make `npm test` pass.
import assert from "node:assert/strict";
import { test } from "node:test";

test("one and one are two", () => {
  assert.equal(1 + 1, 2);
});
