/**
 * Operation maps (docs/operation-map.md; amendment A-011): every rule has a
 * fixture, every fixture behaves as its folder says, the published schema is
 * what the types generate, and a graph is still a graph.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { MAP_CODES, canonicalizeMap, carrierText, isMapLike, mapShape, mapShapeLine, parseMapText, validateMap, type MapIssue } from "../src/map.js";
import { parseGraphText } from "../src/parse.js";
import { mapJsonSchema, MAP_SCHEMA_ID } from "../src/schema/map.js";
import { MAP_SCHEMA_PATH } from "../src/schema/path.js";
import { parseGraph } from "../src/parse.js";
import { fixturesDir, listDirs, read, validFixtures } from "./helpers.js";

const mapsDir = join(fixturesDir, "maps");
const mapFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".grooph-map.json"))
        .sort()
    : [];

/** How a map fixture is judged: parse, then validate with graph pointers looked up beside the map, as the CLI does. */
function issuesFor(path: string): MapIssue[] {
  const parsed = parseMapText(read(path));
  if (!parsed.map) return parsed.issues;
  return validateMap(parsed.map, {
    resolveGraph: (ref) => {
      if (/^[a-z]+:\/\//.test(ref) || !ref.endsWith(".json")) return undefined;
      const file = join(dirname(path), ref);
      return existsSync(file) && parseGraphText(read(file)).doc !== undefined;
    },
  });
}

test("every map rule has at least one failing fixture, and every fixture folder names a map rule", () => {
  const folders = listDirs(join(mapsDir, "invalid"));
  const missing = MAP_CODES.filter((code) => mapFiles(join(mapsDir, "invalid", code)).length === 0);
  assert.deepEqual(missing, [], `these codes have no fixture under fixtures/maps/invalid/: ${missing.join(", ")}`);
  for (const folder of folders) assert.ok((MAP_CODES as readonly string[]).includes(folder), `fixtures/maps/invalid/${folder} is not a map rule`);
});

for (const code of listDirs(join(mapsDir, "invalid"))) {
  for (const name of mapFiles(join(mapsDir, "invalid", code))) {
    test(`maps/invalid/${code}/${name} reports ${code} and nothing else`, () => {
      const issues = issuesFor(join(mapsDir, "invalid", code, name));
      assert.ok(issues.length > 0, "the fixture reports nothing");
      assert.deepEqual([...new Set(issues.map((i) => i.code))], [code]);
      for (const issue of issues) assert.equal(issue.severity, code.startsWith("E_") ? "error" : "warning");
    });
  }
}

for (const name of mapFiles(join(mapsDir, "valid"))) {
  test(`maps/valid/${name} is clean and in canonical form`, () => {
    const path = join(mapsDir, "valid", name);
    assert.deepEqual(issuesFor(path), []);
    const map = parseMapText(read(path)).map!;
    assert.equal(canonicalizeMap(map), read(path), "not in canonical form");
    assert.equal(canonicalizeMap(parseMapText(canonicalizeMap(map)).map!), canonicalizeMap(map), "canonical form is not idempotent");
  });
}

test("the committed map schema is what the types generate, and it agrees with parseMap on every fixture", () => {
  assert.equal(read(MAP_SCHEMA_PATH), mapJsonSchema(), "schema/grooph-map-0.schema.json is stale: run `pnpm --filter @grooph/core run schema:write`");
  assert.equal(JSON.parse(mapJsonSchema()).$id, MAP_SCHEMA_ID);
  const validateJson = new Ajv2020({ strict: false, allErrors: true }).compile(JSON.parse(mapJsonSchema()));
  const all = [
    ...mapFiles(join(mapsDir, "valid")).map((name) => join(mapsDir, "valid", name)),
    ...listDirs(join(mapsDir, "invalid")).flatMap((code) => mapFiles(join(mapsDir, "invalid", code)).map((name) => join(mapsDir, "invalid", code, name))),
  ];
  for (const path of all) {
    const text = read(path);
    assert.equal(validateJson(JSON.parse(text)), parseMapText(text).map !== undefined, `the schema and parseMap disagree on ${path}`);
  }
});

test("a map is not a graph and a graph is not a map: every existing graph still loads, and neither parses as the other", () => {
  const graphs = validFixtures();
  assert.ok(graphs.length > 0);
  for (const g of graphs) {
    const json = JSON.parse(read(g.path)) as unknown;
    assert.equal(isMapLike(json), false);
    assert.ok(parseGraph(json).doc, `${g.name} no longer parses as a graph`);
    assert.equal(parseMapText(read(g.path)).map, undefined);
  }
  for (const name of mapFiles(join(mapsDir, "valid"))) {
    const json = JSON.parse(read(join(mapsDir, "valid", name))) as unknown;
    assert.equal(isMapLike(json), true);
    assert.equal(parseGraph(json).doc, undefined);
  }
});

test("a handoff with no carrier is refused by name, with what to write", () => {
  const issues = issuesFor(join(mapsDir, "invalid/E_HANDOFF_NO_CARRIER/no-carrier.grooph-map.json"));
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.message, /handoff "h-plan" \("planner" → "builder"\) names no carrier/);
  assert.deepEqual(issues[0]!.at, ["h-plan"]);
  const unnamed = issuesFor(join(mapsDir, "invalid/E_HANDOFF_NO_CARRIER/unnamed-person.grooph-map.json"));
  assert.match(unnamed[0]!.message, /carried by a person that is not named; set carrier\.who/);
});

test("the sample: the owner's operation at a glance", () => {
  const map = parseMapText(read(join(mapsDir, "valid/owner-operation-2026-09-30.grooph-map.json"))).map!;
  const shape = mapShape(map);
  assert.equal(shape.lanes, 3);
  assert.equal(shape.sessions, 7);
  assert.equal(shape.sessionsCounted, 18);
  assert.equal(shape.handoffs, 10);
  assert.deepEqual(shape.carriers, { "session-message": 2, "pull-request": 1, branch: 4, "scheduled-message": 1, person: 2 });
  assert.deepEqual(shape.harnesses, { "claude-code": 17, codex: 1 });
  assert.equal(shape.crossLane, 4);
  assert.equal(mapShapeLine(shape), "3 lanes · 7 sessions (18 counting families) · 10 handoffs, 2 carried by a person");
  assert.equal(carrierText(map.handoffs[7]!.carrier), "branch ryanjosephkamp/grooph · main");
  assert.equal(carrierText(map.handoffs[6]!.carrier), "carried by Ryan");
  assert.equal(carrierText({ kind: "person" }), "");
});
