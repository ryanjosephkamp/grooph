import assert from "node:assert/strict";
import { test } from "node:test";

import { formatMoney } from "../src/format.mjs";

test("formats cents with thousands separators", () => {
  assert.equal(formatMoney(123456), "$1,234.56");
  assert.equal(formatMoney(5), "$0.05");
  assert.equal(formatMoney(100000000), "$1,000,000.00");
});

test("a negative amount keeps its sign in front of the symbol", () => {
  assert.equal(formatMoney(-123456), "-$1,234.56");
  assert.equal(formatMoney(-5, "€"), "-€0.05");
});
