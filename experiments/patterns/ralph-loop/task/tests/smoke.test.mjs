import assert from "node:assert/strict";
import { test } from "node:test";

test("the module loads", async () => {
  const mod = await import("../src/text.mjs");
  assert.equal(typeof mod, "object");
});
