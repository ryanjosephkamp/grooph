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

import { mapLive, mapLiveLine, parseEvents, summarizeSessions } from "../src/events.js";
import { offlinePage } from "../src/offline.js";
import { MAP_CODES, byHandLines, canonicalizeMap, carrierText, endName, handoffCarrierText, wakesItself, isMapLike, mapShape, mapShapeLine, parseMapText, validateMap, type MapIssue } from "../src/map.js";
import { parseGraphText } from "../src/parse.js";
import { mapPicture } from "../src/picture/map-picture.js";
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

test("the sample as the Operator corrected it: eight sessions, eighteen handoffs, three that wait on a person", () => {
  const map = parseMapText(read(join(mapsDir, "valid/owner-operation-2026-10-01.grooph-map.json"))).map!;
  const shape = mapShape(map);
  assert.equal(mapShapeLine(shape), "3 lanes · 8 sessions (21 counting families) · 18 handoffs, 3 carried by a person");
  assert.deepEqual(shape.carriers, { "session-message": 3, "scheduled-message": 3, "pull-request": 2, "review-page": 1, branch: 6, person: 3 });
  assert.deepEqual(shape.byHand.map((h) => h.handoff), ["h-fresh-routines", "h-brief-codex", "h-brief-grooph"]);
  // The Operator wakes itself, and the research lanes build on each other: a handoff may start and end at one session.
  assert.deepEqual(map.handoffs.filter((h) => h.from === h.to).map((h) => h.id), ["h-self-wake", "h-research-each-other"]);
  assert.deepEqual(validateMap(map), []);
});

test("people on a map (A-013): a handoff may start or end at one, a notification reaches one, and what starts with a person waits on them", () => {
  const map = parseMapText(read(join(mapsDir, "valid/a-person-and-two-sessions.grooph-map.json"))).map!;
  assert.deepEqual(validateMap(map), []);
  const shape = mapShape(map);
  assert.equal(shape.people, 1);
  assert.equal(mapShapeLine(shape), "1 lane · 2 sessions · 1 person · 5 handoffs, 1 waiting on a person");
  assert.deepEqual(shape.byHand, [{ handoff: "h-ask", from: "owner", to: "lead", who: "The owner", starts: true }]);
  assert.deepEqual(byHandLines(shape), ["by hand  h-ask  owner → lead: moves only when The owner does it"]);
  assert.equal(carrierText({ kind: "notification", where: "e-mail" }), "notification, e-mail");
  assert.equal(carrierText({ kind: "notification" }), "notification");
  assert.equal(endName(map, "owner"), "The owner");
  assert.equal(wakesItself(map, "lead"), "every hour");
  assert.equal(wakesItself(map, "worker"), undefined);

  const edit = (change: (m: typeof map) => void): MapIssue[] => {
    const copy = structuredClone(map);
    change(copy);
    return validateMap(copy);
  };
  // A handoff that starts at a person is carried by them: it need not say who. Between two sessions it must.
  assert.deepEqual(edit((m) => (m.handoffs[0]!.carrier = { kind: "person" })), []);
  assert.equal(handoffCarrierText({ ...map, handoffs: [{ ...map.handoffs[0]!, carrier: { kind: "person" } }] }, { ...map.handoffs[0]!, carrier: { kind: "person" } }), "carried by The owner");
  assert.deepEqual(edit((m) => (m.handoffs[1]!.carrier = { kind: "person" })).map((i) => i.code), ["E_HANDOFF_NO_CARRIER"]);
  // An id is one thing: a person may not share one with a session; an end that is neither is named as such.
  assert.deepEqual(edit((m) => m.people!.push({ id: "lead", name: "Someone with a session's id" })).map((i) => i.code), ["E_DUPLICATE_ID"]);
  const nowhere = edit((m) => (m.handoffs[4]!.to = "nobody"));
  assert.deepEqual(nowhere.map((i) => i.code), ["E_DANGLING_REF"]);
  assert.match(nowhere[0]!.message, /ends at "nobody", which is neither a session nor a person/);
  // A person nothing touches is an island, like a session.
  const alone = edit((m) => m.people!.push({ id: "visitor", name: "A visitor" }));
  assert.deepEqual(alone.map((i) => i.code), ["W_SESSION_ISLAND"]);
  assert.match(alone[0]!.message, /^person "visitor" has no handoff in or out/);
  // A person handing something to themselves reaches no one: it does not stop them being an island, and nothing waits on it.
  const toSelf = edit((m) => {
    m.people!.push({ id: "visitor", name: "A visitor" });
    m.handoffs.push({ id: "h-self", from: "visitor", to: "visitor", carrier: { kind: "person" } });
  });
  assert.deepEqual(toSelf.map((i) => i.code), ["W_SESSION_ISLAND"]);
  const withSelf = structuredClone(map);
  withSelf.handoffs.push({ id: "h-self", from: "owner", to: "owner", carrier: { kind: "person" } });
  assert.deepEqual(mapShape(withSelf).byHand.map((h) => h.handoff), ["h-ask"]);
  // A person is not a session: no rule about accounts or harnesses applies to what they hand over.
  assert.deepEqual(edit((m) => (m.handoffs[0]!.carrier = { kind: "review-page", where: "a page" })), []);
});

test("a map written before people existed says what it said: the same shape line, the same picture, no new key", () => {
  const old = parseMapText(read(join(mapsDir, "valid/owner-operation-2026-09-30.grooph-map.json"))).map!;
  assert.equal(mapShape(old).people, undefined);
  assert.equal(mapShapeLine(mapShape(old)), "3 lanes · 7 sessions (18 counting families) · 10 handoffs, 2 carried by a person");
  assert.equal(canonicalizeMap(old).includes('"people"'), false);
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
  assert.equal(carrierText(map.handoffs[7]!.carrier), "branch main on ryanjosephkamp/grooph");
  assert.equal(carrierText(map.handoffs[6]!.carrier), "carried by Ryan");
  assert.equal(carrierText({ kind: "person" }), "");
  // What a person carries is said, and is not an issue: a map that admits it is a true map.
  assert.deepEqual(shape.byHand.map((h) => h.handoff), map.handoffs.filter((h) => h.carrier?.kind === "person").map((h) => h.id));
  assert.equal(byHandLines(shape).length, 2);
  assert.match(byHandLines(shape)[0]!, /^by hand {2}\S+ {2}\S+ → \S+: moves only when .+ carries it$/);
});

test("the picture of the sample is the committed one, in both themes, and says everything the map does", () => {
  const map = parseMapText(read(join(mapsDir, "valid/owner-operation-2026-09-30.grooph-map.json"))).map!;
  for (const theme of ["light", "dark"] as const) {
    const svg = mapPicture(map, { theme });
    assert.equal(svg, mapPicture(map, { theme }), "not deterministic");
    assert.equal(
      read(join(mapsDir, "pictures", `${map.id}.${theme}.svg`)),
      svg,
      `fixtures/maps/pictures/${map.id}.${theme}.svg is stale: run \`pnpm --filter @grooph/core run golden:write\` and look at it`,
    );
    assert.ok(!svg.includes("var(--"), "a light or dark picture carries its colors, not variables");
  }
  const svg = mapPicture(map, { theme: "light" });
  for (const lane of map.lanes) assert.ok(svg.includes(`data-lane="${lane.id}"`), `lane ${lane.id} is not drawn`);
  for (const s of map.sessions) assert.ok(svg.includes(`data-session="${s.id}"`) && svg.includes(`>${s.name}<`), `session ${s.id} is not drawn with its name`);
  for (const h of map.handoffs) assert.ok(svg.includes(`data-handoff="${h.id}"`) && svg.includes(`data-handoff-row="${h.id}"`), `handoff ${h.id} is not drawn and listed`);
  assert.ok(svg.includes(">×12<"), "the family's count is not drawn");
  assert.match(svg, /viewBox="0 0 400 /);
});

test("an auto picture follows the viewer's color scheme; a broken map still draws what it can", () => {
  const map = parseMapText(read(join(mapsDir, "valid/two-sessions.grooph-map.json"))).map!;
  const auto = mapPicture(map);
  assert.match(auto, /prefers-color-scheme:dark/);
  assert.ok(auto.includes("var(--gp-ink)"));
  // A handoff to nowhere and a session in no lane are left out of the drawing, not thrown on; the list still names the handoff.
  const broken = { ...map, sessions: [...map.sessions, { id: "lost", name: "Lost", lane: "nowhere", harness: "codex", role: "x" }], handoffs: [...map.handoffs, { id: "h-gone", from: "planner", to: "ghost" }] };
  const svg = mapPicture(broken, { theme: "light" });
  assert.ok(!svg.includes('data-session="lost"'));
  assert.ok(!svg.includes('data-handoff="h-gone"'));
  assert.ok(svg.includes('data-handoff-row="h-gone"') && svg.includes("no carrier named"));
  // An empty map is a title and nothing else.
  assert.match(mapPicture({ groophMap: 0, id: "empty", name: "Empty", version: 1, lanes: [], sessions: [], handoffs: [] }, { theme: "dark" }), /^<svg [^>]*data-picture="map"/);
});

test("a map lit by its sessions' hooks: a source read under a map session's name marks that session, and nothing else changes", () => {
  const map = parseMapText(read(join(mapsDir, "valid/owner-operation-2026-09-30.grooph-map.json"))).map!;
  const events = (name: string, source: string) => parseEvents(read(join(fixturesDir, "events", name))).events.map((e) => ({ ...e, source }));
  const sessions = summarizeSessions([...events("claude-code-running.jsonl", "operator"), ...events("claude-code-nested.jsonl", "workers"), ...events("codex-two-subagents.jsonl", "codex"), ...events("claude-code-planned.jsonl", "somewhere-else")].sort((a, b) => (a.t < b.t ? -1 : 1)));
  const live = mapLive(sessions, map);
  assert.deepEqual(Object.keys(live).sort(), ["codex", "operator", "workers"]);
  assert.deepEqual([live["operator"]!.working, live["operator"]!.agentsRunning, live["operator"]!.agentsDone], [1, 1, 1]);
  assert.equal(mapLiveLine(live["operator"]!), "working · 1 running, 1 done");
  assert.equal(mapLiveLine(live["workers"]!), "ended · 0 running, 3 done");
  assert.equal(mapLiveLine({ sessions: 12, working: 2, waiting: 3, ended: 7, agentsRunning: 4, agentsDone: 9, lastAt: "x" }), "2 of 12 working · 4 running, 9 done");
  assert.equal(mapLiveLine({ sessions: 1, working: 0, waiting: 1, ended: 0, agentsRunning: 0, agentsDone: 0, lastAt: "x" }), "waiting");
  // Read three hours after the last line, the Operator's session is quiet: its card says when it was last seen, and
  // a session that ended is still ended.
  const later = new Date(Date.parse(live["operator"]!.lastAt) + 3 * 3600 * 1000).toISOString();
  const stale = mapLive(sessions, map, later);
  assert.deepEqual([stale["operator"]!.working, stale["operator"]!.quiet, stale["operator"]!.agentsRunning], [0, 1, 0]);
  assert.equal(mapLiveLine(stale["operator"]!, later), "last seen 3 h ago");
  assert.equal(mapLiveLine(stale["workers"]!, later), "ended · 0 running, 3 done");
  assert.equal(mapLiveLine({ sessions: 12, working: 2, waiting: 0, ended: 7, quiet: 3, agentsRunning: 4, agentsDone: 9, lastAt: "x" }, later), "2 of 12 working · 4 running, 9 done");
  // A family with one member that ended a minute ago and one silent for three hours was last seen three hours ago.
  assert.equal(mapLiveLine({ sessions: 2, working: 0, waiting: 0, ended: 1, quiet: 1, agentsRunning: 0, agentsDone: 2, lastAt: new Date(Date.parse(later) - 60_000).toISOString(), quietLastAt: stale["operator"]!.lastAt }, later), "last seen 3 h ago");
  const quietPicture = mapPicture(map, { theme: "light", live: stale, at: later });
  assert.match(quietPicture, /<g data-session="operator" data-live="quiet">/);
  assert.match(quietPicture, />last seen 3 h ago</);

  const plain = mapPicture(map, { theme: "light" });
  const lit = mapPicture(map, { theme: "light", live, at: "2026-10-01T02:01:10.000Z" });
  assert.ok(!plain.includes("data-live"));
  assert.match(lit, /<g data-session="operator" data-live="working">/);
  assert.match(lit, /<g data-session="workers" data-live="ended">/);
  assert.ok(!/<g data-session="routines" data-live/.test(lit), "a session with no source of its name is drawn as the map alone draws it");
  assert.ok(lit.includes(">working · 1 running, 1 done<") && lit.includes("live at 2026-10-01 02:01 UTC"));
  // The map itself is not touched: live state is given to the picture, never written into the document.
  assert.equal(canonicalizeMap(map), read(join(mapsDir, "valid/owner-operation-2026-09-30.grooph-map.json")));

  const page = offlinePage(map, { live, at: "2026-10-01T02:01:10.000Z" });
  assert.ok(page.includes('data-live="working"') && page.includes("<dt>At 2026-10-01 02:01 UTC</dt><dd>working · 1 running, 1 done</dd>"));
  assert.ok(page.includes("the page does not update itself"));
  assert.ok(!offlinePage(map).includes("data-live"));
});
