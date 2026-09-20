import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const root = join(dirname(new URL(import.meta.url).pathname), "..");

// Every implementation the contract is checked against: each candidates/<x>/diff.mjs, then src/diff.mjs when it exists.
function implementations() {
  const found = [];
  const candidates = join(root, "candidates");
  if (existsSync(candidates)) {
    for (const name of readdirSync(candidates).sort()) {
      const file = join(candidates, name, "diff.mjs");
      if (existsSync(file)) found.push({ label: `candidates/${name}`, file });
    }
  }
  const final = join(root, "src", "diff.mjs");
  if (existsSync(final)) found.push({ label: "src", file: final });
  return found;
}

/** The fewest `-` plus `+` entries any script can have: |a| + |b| − 2·LCS(a, b), by the textbook table. */
function minimalEdits(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      table[i][j] = a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return a.length + b.length - 2 * table[a.length][b.length];
}

const cases = [
  ["both empty", [], []],
  ["empty before", [], ["a", "b"]],
  ["empty after", ["a", "b"], []],
  ["identical", ["a", "b", "c"], ["a", "b", "c"]],
  ["the README example", ["a", "b", "c"], ["a", "c", "d"]],
  ["a swap needs two edits", ["x", "y"], ["y", "x"]],
  ["repeated lines", ["a", "a", "b", "a"], ["a", "b", "a", "a"]],
  ["blank and whitespace lines are distinct", ["", " ", "a"], [" ", "", "a"]],
  ["unicode lines", ["héllo", "wörld", "→"], ["héllo", "→", "wörld"]],
  ["long unrelated inputs", Array.from({ length: 60 }, (_, i) => `L${i}`), Array.from({ length: 60 }, (_, i) => `R${i}`)],
  ["long shifted inputs", Array.from({ length: 200 }, (_, i) => `line ${i % 37}`), Array.from({ length: 200 }, (_, i) => `line ${(i + 5) % 37}`)],
];

const impls = implementations();

test("at least one implementation exists (candidates/*/diff.mjs or src/diff.mjs)", () => {
  assert.ok(impls.length > 0, "no candidates/*/diff.mjs and no src/diff.mjs yet");
});

for (const impl of impls) {
  const load = async () => (await import(pathToFileURL(impl.file).href)).diffLines;

  for (const [name, before, after] of cases) {
    test(`${impl.label}: ${name}`, async () => {
      const diffLines = await load();
      assert.equal(typeof diffLines, "function", "exports diffLines");
      const script = diffLines(before, after);
      assert.ok(Array.isArray(script), "returns an array");
      for (const entry of script) assert.ok(["=", "-", "+"].includes(entry.op) && typeof entry.line === "string", `entry ${JSON.stringify(entry)}`);
      assert.deepEqual(script.filter((e) => e.op !== "+").map((e) => e.line), before, "= and - lines read as before");
      assert.deepEqual(script.filter((e) => e.op !== "-").map((e) => e.line), after, "= and + lines read as after");
      assert.equal(script.filter((e) => e.op !== "=").length, minimalEdits(before, after), "as few edits as possible");
    });
  }

  test(`${impl.label}: refuses bad input`, async () => {
    const diffLines = await load();
    assert.throws(() => diffLines("a\nb", ["a"]), TypeError);
    assert.throws(() => diffLines(["a"], [1]), TypeError);
    assert.throws(() => diffLines(null, []), TypeError);
  });

  test(`${impl.label}: does not change its inputs`, async () => {
    const diffLines = await load();
    const before = ["a", "b"];
    const after = ["b", "c"];
    diffLines(before, after);
    assert.deepEqual(before, ["a", "b"]);
    assert.deepEqual(after, ["b", "c"]);
  });
}
