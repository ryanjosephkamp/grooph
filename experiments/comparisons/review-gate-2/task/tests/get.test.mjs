import assert from "node:assert/strict";
import { test } from "node:test";

import { getPath } from "../src/get.mjs";

const settings = { output: { color: "auto", width: 80 }, verbose: false };

test("getPath reads a setting by its dotted path", () => {
  assert.equal(getPath(settings, "output.color"), "auto");
  assert.equal(getPath(settings, "verbose"), false);
  assert.deepEqual(getPath(settings, "output"), { color: "auto", width: 80 });
});

test("getPath returns the fallback when a step is missing", () => {
  assert.equal(getPath(settings, "output.pager"), undefined);
  assert.equal(getPath(settings, "output.pager", ""), "");
  assert.equal(getPath(settings, "output.color.dark", "none"), "none");
  assert.equal(getPath(settings, "toString", "none"), "none");
});

test("getPath refuses a path that is not a non-empty string", () => {
  assert.throws(() => getPath(settings, ""), TypeError);
  assert.throws(() => getPath(settings, 3), TypeError);
});
