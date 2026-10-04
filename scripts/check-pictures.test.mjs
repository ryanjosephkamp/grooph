/**
 * The picture rule, held against made-up pictures and then run for real in a throwaway repository.
 * Run with `node --test scripts/check-pictures.test.mjs`.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { BASELINE, LIMIT, README_GIF_LIMIT, judge, limitFor } from "./check-pictures.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "check-pictures.mjs");

test("a picture at the limit passes and one byte more does not", () => {
  const { over, stale, pruned } = judge(
    [
      { path: "docs/a.png", bytes: LIMIT },
      { path: "docs/b.png", bytes: LIMIT + 1 },
    ],
    {},
  );
  assert.equal(over.length, 1);
  assert.match(over[0], /^docs\/b\.png is 151 KB, over the 150 KB limit$/);
  assert.deepEqual(stale, []);
  assert.deepEqual(pruned, {});
});

test("a picture from before the rule is left alone until it grows", () => {
  const baseline = { "handoffs/0001/old.png": 400_000 };
  const same = judge([{ path: "handoffs/0001/old.png", bytes: 400_000 }], baseline);
  assert.deepEqual(same.over, []);
  assert.deepEqual(same.stale, []);
  assert.deepEqual(same.pruned, baseline);

  const grown = judge([{ path: "handoffs/0001/old.png", bytes: 400_001 }], baseline);
  assert.equal(grown.over.length, 1);
  assert.match(grown.over[0], /may not grow/);
});

test("only a GIF the README names gets the larger limit", () => {
  const readme = '<img src="docs/assets/demo.gif" alt="grooph in thirty seconds" />';
  assert.equal(limitFor("docs/assets/demo.gif", readme), README_GIF_LIMIT);
  assert.equal(limitFor("docs/assets/other.gif", readme), LIMIT);
  assert.equal(limitFor("docs/assets/demo.png", readme), LIMIT);

  const pictures = [
    { path: "docs/assets/demo.gif", bytes: README_GIF_LIMIT },
    { path: "docs/assets/other.gif", bytes: LIMIT + 1 },
  ];
  const { over } = judge(pictures, {}, readme);
  assert.deepEqual(over.map((line) => line.split(" ")[0]), ["docs/assets/other.gif"]);
  assert.equal(judge([{ path: "docs/assets/demo.gif", bytes: README_GIF_LIMIT + 1 }], {}, readme).over.length, 1);
});

test("a baseline entry that is gone, now fits or shrank is stale, and pruning never adds one", () => {
  const baseline = { "docs/gone.png": 300_000, "docs/fits.png": 300_000, "docs/shrank.png": 300_000 };
  const { over, stale, pruned } = judge(
    [
      { path: "docs/fits.png", bytes: 1_000 },
      { path: "docs/shrank.png", bytes: 200_000 },
      { path: "docs/new.png", bytes: 900_000 },
    ],
    baseline,
  );
  assert.equal(stale.length, 3);
  assert.equal(over.length, 1);
  assert.deepEqual(pruned, { "docs/shrank.png": 200_000 });
});

/** A git repository with the script in it, so the script weighs that repository and not this one. */
function scratch(files, baseline) {
  const dir = mkdtempSync(join(tmpdir(), "grooph-pictures-"));
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  mkdirSync(join(dir, "scripts"));
  copyFileSync(script, join(dir, "scripts/check-pictures.mjs"));
  writeFileSync(join(dir, "README.md"), "# scratch\n");
  writeFileSync(join(dir, ".gitignore"), "ignored/\n");
  if (baseline !== undefined) writeFileSync(join(dir, BASELINE), JSON.stringify({ pictures: baseline }));
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), Buffer.alloc(bytes));
  }
  const run = (...args) => spawnSync(process.execPath, ["scripts/check-pictures.mjs", ...args], { cwd: dir, encoding: "utf8" });
  return { dir, run };
}

test("the check passes on small pictures and names a large one that was only just put in the folder", (t) => {
  const { dir, run } = scratch({ "docs/small.png": 10, "handoffs/0001/shot.jpg": LIMIT }, {});
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const clean = run("--check");
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /2 pictures/);

  // Not staged, not committed: the check reads what git would take, so it speaks before the commit does.
  writeFileSync(join(dir, "apps-web-public-is-not-a-root.png"), Buffer.alloc(LIMIT * 2));
  mkdirSync(join(dir, "apps/web/public"), { recursive: true });
  writeFileSync(join(dir, "apps/web/public/big.png"), Buffer.alloc(LIMIT + 1));
  mkdirSync(join(dir, "docs/ignored"));
  writeFileSync(join(dir, "docs/ignored/huge.png"), Buffer.alloc(LIMIT * 3));
  writeFileSync(join(dir, "docs/notes.md"), Buffer.alloc(LIMIT * 3));
  const refused = run("--check");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /apps\/web\/public\/big\.png is 151 KB/);
  assert.doesNotMatch(refused.stderr, /not-a-root|ignored|notes\.md/);
});

test("the check fails when there is nothing to weigh or no baseline to hold it against", (t) => {
  const empty = scratch({}, {});
  const noBaseline = scratch({ "docs/small.png": 10 });
  t.after(() => {
    rmSync(empty.dir, { recursive: true, force: true });
    rmSync(noBaseline.dir, { recursive: true, force: true });
  });
  const nothing = empty.run("--check");
  assert.equal(nothing.status, 1);
  assert.match(nothing.stderr, /no picture found/);
  const missing = noBaseline.run("--check");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /pictures-baseline\.json is missing/);
});

test("--prune tightens a stale baseline and refuses to take in a new large picture", (t) => {
  const { dir, run } = scratch(
    { "docs/old.png": LIMIT + 100, "docs/new.png": LIMIT + 100 },
    { "docs/old.png": LIMIT + 500, "docs/gone.png": LIMIT + 500 },
  );
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(run("--check").status, 1);
  const pruned = run("--prune");
  assert.equal(pruned.status, 1, "a new large picture is still refused");
  assert.deepEqual(JSON.parse(readFileSync(join(dir, BASELINE), "utf8")).pictures, { "docs/old.png": LIMIT + 100 });

  rmSync(join(dir, "docs/new.png"));
  const after = run("--check");
  assert.equal(after.status, 0, after.stderr);
});
