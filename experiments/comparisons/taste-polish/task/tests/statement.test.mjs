import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderStatement } from "../src/statement.mjs";

const data = JSON.parse(readFileSync(new URL("../data/usage.json", import.meta.url), "utf8"));

test("renderStatement returns text that ends with a newline", () => {
  const text = renderStatement(data);
  assert.equal(typeof text, "string");
  assert.ok(text.endsWith("\n"));
});

test("renderStatement names the customer and the account", () => {
  const text = renderStatement(data);
  assert.ok(text.includes(data.customer));
  assert.ok(text.includes(data.account));
});

test("renderStatement names every service and every credit", () => {
  const text = renderStatement(data).replace(/\s+/g, " ");
  for (const line of data.lines) assert.ok(text.includes(line.service), line.service);
  for (const credit of data.credits) assert.ok(text.includes(credit.reason), credit.reason);
});
