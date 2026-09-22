import assert from "node:assert/strict";
import { test } from "node:test";

import { sign, verifyWebhook } from "../src/payments.mjs";
import { route } from "../src/server.mjs";

test("the routing table resolves the documented paths", () => {
  assert.ok(route("GET", "/orders"));
  assert.ok(route("GET", "/orders/ord_1"));
  assert.ok(route("POST", "/webhooks/payments"));
  assert.equal(route("DELETE", "/orders"), null);
});

test("a webhook verifies against the shared secret and nothing else", () => {
  const body = '{"id":"evt_1"}';
  assert.equal(verifyWebhook(body, sign(body)), true);
  assert.equal(verifyWebhook(body, sign(body, "another-secret")), false);
  assert.equal(verifyWebhook(body, "nope"), false);
});
