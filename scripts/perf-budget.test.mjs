/**
 * scripts/perf-budget.mjs, run against a made-up build in a throwaway folder: a figure is compared with its budget
 * as it is, to the byte, not as it prints. Run with `node --test scripts/perf-budget.test.mjs`.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A build as the script expects to find one, with files of noise so each weighs what it is given, and the script beside it. */
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "grooph-budget-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = {};
  const put = (path, body) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
    files[path] = Buffer.from(body);
  };
  mkdirSync(join(dir, "scripts"), { recursive: true });
  copyFileSync(join(root, "scripts", "perf-budget.mjs"), join(dir, "scripts", "perf-budget.mjs"));
  put("packages/cli/bin/grooph.js", "process.exit(0);\n");
  put("apps/web/dist/index.html", "<!doctype html><title>made up</title>");
  put("apps/web/dist/assets/index-a.js", randomBytes(3000));
  put("apps/web/dist/assets/App-a.js", randomBytes(2000));
  put("apps/web/dist/assets/styles-a.css", randomBytes(700));
  put("apps/web/dist/assets/screens-a.js", randomBytes(5000));
  put("apps/web/dist/assets/EmbedApp-a.js", randomBytes(900));
  put("apps/web/dist/assets/compile-a.js", randomBytes(300));
  put("apps/web/dist/assets/space-a.js", randomBytes(200));
  put("apps/web/dist/assets/fonts/atkinson-hyperlegible-next.v1.woff2", randomBytes(400));
  put("apps/web/dist/assets/fonts/atkinson-hyperlegible-mono.v1.woff2", randomBytes(300));
  put("apps/web/dist/assets/site-icons.v1.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>");
  put(
    "apps/web/dist/routes.json",
    JSON.stringify({ entry: ["assets/index-a.js"], app: { js: ["assets/App-a.js"], css: ["assets/styles-a.css"] }, canvas: { js: ["assets/screens-a.js"], css: [] }, embed: { js: ["assets/EmbedApp-a.js"], css: [] }, later: ["assets/compile-a.js", "assets/space-a.js"], space: ["assets/space-a.js"] }),
  );
  const gz = (path) => gzipSync(files[`apps/web/dist/${path}`]).length;
  /** What an address that draws on the canvas weighs in this build, in bytes, as the script weighs it. */
  const weigh = () => gz("index.html") + gz("assets/index-a.js") + gz("assets/App-a.js") + gz("assets/styles-a.css") + gz("assets/screens-a.js");
  // The weight is made one that rounds down at one decimal place (x.x1 to x.x4 KB), so a check that rounded before
  // it compared, as this one used to, would call a figure just over its budget "ok".
  for (let more = 0; !(((weigh() / 1024) * 10) % 1 > 0.1 && ((weigh() / 1024) * 10) % 1 < 0.4); more += 10) put("apps/web/dist/assets/screens-a.js", randomBytes(5000 + more));
  const canvas = weigh();
  const run = (canvasLimitBytes) => {
    const roomy = { firstLoadKB: 1000, entryJsKB: 1000, cssKB: 1000, fontsKB: 1000, firstVisitKB: 1000, embedLoadKB: 1000, mapSpaceKB: 1000, cliColdMs: 60000 };
    writeFileSync(join(dir, "scripts", "perf-budget.json"), JSON.stringify({ ...roomy, canvasLoadKB: canvasLimitBytes / 1024 }));
    return spawnSync(process.execPath, ["scripts/perf-budget.mjs", "--check"], { cwd: dir, encoding: "utf8" });
  };
  return { canvas, run, dir };
}

test("a figure a few bytes over its budget fails, and a few bytes under passes: nothing is rounded before it is compared", (t) => {
  const { canvas, run } = scratch(t);
  const line = (out) => out.split("\n").find((l) => l.includes("an address that draws on the canvas"));

  const over = run(canvas - 3);
  assert.equal(over.status, 1, over.stdout + over.stderr);
  assert.match(line(over.stdout), /^OVER /);
  assert.match(over.stderr, /1 over budget/);

  const under = run(canvas + 3);
  assert.equal(under.status, 0, under.stdout + under.stderr);
  assert.match(line(under.stdout), /^ok /);

  // The budget met to the byte is met.
  assert.equal(run(canvas).status, 0);
  // The line shows what was compared, to two places: three bytes are less than a hundredth of a KB, so the two
  // lines print the same figure and differ in their verdict.
  const figure = (out) => /^\S+\s+(\d+\.\d\d) of/.exec(line(out))[1];
  assert.equal(figure(over.stdout), (canvas / 1024).toFixed(2));
  assert.equal(figure(under.stdout), (canvas / 1024).toFixed(2));
});

test("the piece that draws a map in three dimensions has a line of its own, and a build that does not name it is not weighed", (t) => {
  const { canvas, run, dir } = scratch(t);
  const line = (out) => out.split("\n").find((l) => l.includes("a map in three dimensions"));
  const routesFile = join(dir, "apps/web/dist/routes.json");
  const routes = JSON.parse(readFileSync(routesFile, "utf8"));
  const withBudget = (kb) => {
    const json = join(dir, "scripts", "perf-budget.json");
    writeFileSync(json, JSON.stringify({ ...JSON.parse(readFileSync(json, "utf8")), mapSpaceKB: kb }));
    return spawnSync(process.execPath, ["scripts/perf-budget.mjs", "--check"], { cwd: dir, encoding: "utf8" });
  };
  // Two hundred bytes of noise: inside a budget of one KB, and over one of a tenth.
  assert.equal(run(canvas).status, 0);
  assert.match(line(withBudget(1).stdout), /^ok /);
  const over = withBudget(0.1);
  assert.equal(over.status, 1);
  assert.match(line(over.stdout), /^OVER /);
  // A build that lists no such piece, or an empty one, fails with or without --check: nothing weighs nothing.
  for (const space of [undefined, []]) {
    writeFileSync(routesFile, JSON.stringify({ ...routes, space }));
    const missing = spawnSync(process.execPath, ["scripts/perf-budget.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(missing.status, 1, missing.stdout);
    assert.match(missing.stderr, /does not say which files draw a map in three dimensions/);
  }
});
