/**
 * scripts/version.mjs, run against a copy of the eight files in a throwaway folder: the real ones are never written.
 * Run with `node --test scripts/version.test.mjs`.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { PLACES, readPlaces } from "./version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The eight files and the script, copied to where the script will take the copy for the repository. */
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "grooph-version-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of [...PLACES.map((place) => place.file), "scripts/version.mjs"]) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(root, file), join(dir, file));
  }
  const run = (...args) => spawnSync(process.execPath, ["scripts/version.mjs", ...args], { cwd: dir, encoding: "utf8" });
  const read = (file) => readFileSync(join(dir, file), "utf8");
  const edit = (file, change) => writeFileSync(join(dir, file), change(read(file)));
  return { dir, run, read, edit };
}

test("there are eight places and the repository's agree", () => {
  const places = readPlaces();
  assert.equal(places.length, 8);
  assert.deepEqual(places.filter((place) => place.problem), []);
  assert.equal(new Set(places.map((place) => place.version)).size, 1);
  // What the pattern captured is what the manifest says, read the ordinary way.
  assert.equal(places[0].version, JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
});

test("writing a version changes the version in all eight files and nothing else in them", (t) => {
  const { run, read } = scratch(t);
  const before = Object.fromEntries(PLACES.map((place) => [place.file, read(place.file)]));
  const was = readPlaces()[0].version;

  assert.equal(run("--check").status, 0);
  const wrote = run("97.98.99");
  assert.equal(wrote.status, 0, wrote.stderr);
  assert.match(wrote.stdout, /wrote 97\.98\.99 in 8 of 8 places/);
  assert.match(run("--check").stdout, /the version is 97\.98\.99 in all 8 places/);

  for (const { file } of PLACES) {
    const after = read(file);
    assert.notEqual(after, before[file], `${file} was not written`);
    assert.equal(after.split("97.98.99").join(was), before[file], `${file} changed somewhere other than its version`);
    assert.equal(after.split("97.98.99").length, 2, `${file} holds the version more than once`);
  }
  assert.equal(JSON.parse(read("packages/cli/package.json")).version, "97.98.99");

  const again = run("97.98.99");
  assert.equal(again.status, 0);
  assert.match(again.stdout, /already 97\.98\.99/);
});

test("the check names the place that disagrees", (t) => {
  const { run, edit } = scratch(t);
  edit("apps/web/src/doc/keep.ts", (text) => text.replace(/APP_VERSION = "[^"]*"/, 'APP_VERSION = "0.0.1"'));
  const checked = run("--check");
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /the 8 places disagree/);
  assert.match(checked.stderr, /apps\/web\/src\/doc\/keep\.ts\s+0\.0\.1/);
});

test("a place that cannot be found fails the check and stops a write before any file changes", (t) => {
  const { run, read, edit } = scratch(t);
  edit("packages/cli/src/index.ts", (text) => text.replace("export const VERSION = ", "export const RELEASE = "));
  const manifest = read("package.json");

  const checked = run("--check");
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /1 of 8 places could not be read/);
  assert.match(checked.stderr, /packages\/cli\/src\/index\.ts\s+\? the version line was found 0 times/);

  assert.equal(run("97.98.99").status, 1);
  assert.equal(read("package.json"), manifest, "a file was written though one place could not be read");
});

test("a missing file fails the check", (t) => {
  const { dir, run } = scratch(t);
  rmSync(join(dir, "scripts/test-install-local.sh"));
  const checked = run("--check");
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /scripts\/test-install-local\.sh\s+\? the file is missing/);
});

test("anything that is not x.y.z is refused and nothing is written", (t) => {
  const { run, read } = scratch(t);
  const manifest = read("package.json");
  for (const bad of ["1.2", "v1.2.3", "1.2.3-beta", "--help", "latest"]) {
    const refused = run(bad);
    assert.equal(refused.status, 2, `${bad} was taken`);
    assert.match(refused.stderr, /is not a version of the form x\.y\.z/);
  }
  assert.equal(read("package.json"), manifest);
});
