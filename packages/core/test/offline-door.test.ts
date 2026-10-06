/**
 * The offline page's maker behind a door of its own (slice 0093, second part).
 *
 * Every address of the web app carried it, 2.6 KB compressed, and one button uses it: "Offline page" under Keep a
 * copy. It is a piece the app fetches at that press. For that to move nothing else, the maker imports only types
 * and is handed core's parts (`offline-kit.ts`); these tests hold that, and that the page is the same bytes
 * whichever way it is asked for.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import * as base from "../src/base.js";
import { canonicalize } from "../src/canonicalize.js";
import { mapLiveLine } from "../src/events.js";
import { offlinePage, offlinePageWith, parseGraphText, parseMapText } from "../src/index.js";
import { formatIssue } from "../src/issues.js";
import { canonicalizeMap, isMapLike, validateMap } from "../src/map.js";
import { offlineKit } from "../src/offline-kit.js";
import { mapOutline, outline } from "../src/outline.js";
import { picture } from "../src/picture/graph-picture.js";
import { mapPicture } from "../src/picture/map-picture.js";
import { esc } from "../src/picture/svg.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const src = join(repoRoot, "packages", "core", "src");
// Every import that is not of types alone: `import { a } from`, `export * from`, and a bare `import "./x.js"`.
const runtimeImports = (file: string): string[] =>
  [...read(file).matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;"]*?from\s+)?"(\.[^"]+)\.js"/gms)].map((m) => join(file, "..", `${m[1]}.ts`));
const follow = (file: string, into: Set<string> = new Set()): Set<string> => {
  if (into.has(file)) return into;
  into.add(file);
  for (const next of runtimeImports(file)) follow(next, into);
  return into;
};

test("the maker imports nothing but types, and the app's way in does not lead to it", () => {
  assert.deepEqual(runtimeImports(join(src, "offline.ts")), [], "offline.ts imports something that is not a type");
  const reached = follow(join(src, "base.ts"));
  assert.ok(reached.size > 20 && reached.has(join(src, "validate.ts")), "base.ts was not followed");
  assert.ok(!reached.has(join(src, "offline.ts")), "base.ts leads to the offline page's maker");
  // What it is handed is on the way in: names for what every address has already.
  assert.ok(reached.has(join(src, "offline-kit.ts")));
  assert.equal(base.offlineKit, offlineKit);
  assert.equal("offlinePage" in base, false);
  assert.equal("offlinePageWith" in base, false);
  // And the kit brings nothing an address did not have: every file it imports, base.ts reached without it.
  const withoutKit = new Set<string>();
  const walk = (file: string): void => {
    if (withoutKit.has(file) || file === join(src, "offline-kit.ts")) return;
    withoutKit.add(file);
    for (const next of runtimeImports(file)) walk(next);
  };
  walk(join(src, "base.ts"));
  for (const file of runtimeImports(join(src, "offline-kit.ts"))) assert.ok(withoutKit.has(file), `${file.slice(src.length + 1)} is on the way in only for the offline page`);
});

test("the kit is these twelve, in the order the maker names them", () => {
  assert.deepEqual([...offlineKit], [canonicalize, canonicalizeMap, esc, formatIssue, isMapLike, mapLiveLine, mapOutline, mapPicture, outline, picture, validate, validateMap]);
  const named = /const \[([^\]]+)\] = kit;/.exec(read(join(src, "offline.ts")))?.[1]?.split(",").map((name) => name.trim());
  assert.deepEqual(named, ["canonicalize", "canonicalizeMap", "esc", "formatIssue", "isMapLike", "mapLiveLine", "mapOutline", "mapPicture", "outline", "picture", "validate", "validateMap"]);
  const listed = /export const offlineKit = \[\s*([^\]]+)\] as const;/.exec(read(join(src, "offline-kit.ts")))?.[1]?.split(",").map((name) => name.trim()).filter(Boolean);
  assert.deepEqual(listed, named, "offline-kit.ts lists its parts in another order than offline.ts names them");
});

test("the committed pages of a graph and a map are what the maker makes, bound as the CLI has it and handed as the app does", () => {
  // The two files under fixtures/pages/ were first written from the maker as it was before it was handed its parts
  // (main at 77733bc gives the same bytes), so they hold the page to what it was. Regenerate, and read the diff,
  // with `pnpm --filter @grooph/core run golden:write` when the page changes on purpose.
  const options = { version: "0.0.0", link: "https://example.test/grooph/#/open?d=x" };
  const graph = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-person-and-two-sessions.grooph-map.json"))).map!;
  for (const doc of [graph, map]) {
    const kept = read(join(fixturesDir, "pages", `${doc.id}.html`));
    assert.equal(offlinePage(doc, options) === kept, true, `${doc.id}: core's whole entry does not make the committed page`);
    assert.equal(offlinePageWith(base.offlineKit, doc, options) === kept, true, `${doc.id}: the maker handed base.ts's kit does not make the committed page`);
    assert.match(kept, /^<!doctype html>/i);
    assert.match(kept, /Made with grooph 0\.0\.0\./);
    assert.match(kept, /open it in the app/);
  }
  // A graph's page lists the validator's issues (the review loop has its one warning); a map's page has its own.
  assert.match(read(join(fixturesDir, "pages", "review-loop.html")), /W_HOMOGENEOUS_CRITICS/);
  assert.match(read(join(fixturesDir, "pages", `${map.id}.html`)), /operation map/);
});
