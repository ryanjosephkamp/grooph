import assert from "node:assert/strict";
import { test } from "node:test";

import { padStart } from "../src/pad.mjs";

test("padStart pads short text on the left", () => {
  assert.equal(padStart("7", 3), "  7");
});

test("padStart leaves text that fills the width alone", () => {
  assert.equal(padStart("1234", 3), "1234");
});

test("padStart refuses bad input", () => {
  assert.throws(() => padStart(7, 3), TypeError);
  assert.throws(() => padStart("7", -1), RangeError);
});
