/**
 * The reviewer's acceptance cases, held outside this project. For every plan
 * item ticked in PLAN.md, its cases run here; an unticked item's cases do not.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const CASES = "<held-out>";

const plan = readFileSync(new URL("../PLAN.md", import.meta.url), "utf8");
const ticked = [...plan.matchAll(/^- \[x\] \*\*([a-z]+)\*\*/gm)].map((m) => m[1]);
const mod = await import("../src/text.mjs");

const plain = (value) => (value instanceof Map ? [...value] : value);

for (const item of ticked) {
  const file = `${CASES}/${item}.json`;
  if (!existsSync(file)) continue;
  for (const c of JSON.parse(readFileSync(file, "utf8"))) {
    test(`${item} · ${c.name}`, () => {
      const fn = mod[c.fn];
      assert.equal(typeof fn, "function", `${c.fn} is exported from src/text.mjs`);
      if (c.throws) assert.throws(() => fn(...c.args), (err) => err instanceof globalThis[c.throws]);
      else assert.deepEqual(plain(fn(...c.args)), c.expect);
    });
  }
}
