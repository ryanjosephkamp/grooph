import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify } from "../src/slug.mjs";

test("lower case, hyphens between words, nothing at the ends", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("  spaced   out  "), "spaced-out");
  assert.equal(slugify("v2.0 release"), "v2-0-release");
});
