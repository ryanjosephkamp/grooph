/**
 * A session as it was seen, as a graph (`src/seen.ts`; decision 0032, point 3). The fixtures under `fixtures/seen/`
 * are cut from real sessions of this project, with every id renumbered and every time moved
 * (`fixtures/seen/README.md`); the lines written by hand here are for what those sessions did not happen to do.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { parseEvents, summarizeSessions, type SessionEvent } from "../src/events.js";
import { seenGraph, type HarnessAgent, type SeenAgent, type SeenEdge, type SeenGraph, type SeenOptions } from "../src/seen.js";
import { fixturesDir, listDirs, read } from "./helpers.js";

const seenDir = join(fixturesDir, "seen");
const NAMES = listDirs(seenDir);

type Drawn = Pick<SeenGraph, "at" | "nodes" | "edges" | "differs">;
type Side = { moments: string[]; record: SeenGraph["record"]; graphs: Drawn[] };
const load = (name: string): { events: SessionEvent[]; harness: HarnessAgent[]; expected: Side & { fromTheHookAlone: Side } } => {
  const parsed = parseEvents(read(join(seenDir, name, "events.jsonl")));
  assert.deepEqual(parsed.issues, [], `${name}: every line is an event`);
  return { events: parsed.events, harness: JSON.parse(read(join(seenDir, name, "harness.json"))) as HarnessAgent[], expected: JSON.parse(read(join(seenDir, name, "expected.json"))) as Side & { fromTheHookAlone: Side } };
};
const drawn = (g: SeenGraph): Drawn => ({ at: g.at, nodes: g.nodes, edges: g.edges, differs: g.differs });
const agentsOf = (g: Pick<SeenGraph, "nodes">): SeenAgent[] => g.nodes.filter((n): n is SeenAgent => n.kind === "subagent");
const agentOf = (g: Pick<SeenGraph, "nodes">, id: string): SeenAgent => agentsOf(g).find((n) => n.id === id)!;
const edgeTo = (g: Pick<SeenGraph, "edges">, to: string, kind: SeenEdge["kind"] = "started"): SeenEdge | undefined => g.edges.find((x) => x.to === to && x.kind === kind);
const both = (harness: HarnessAgent[]): [string, SeenOptions][] => [
  ["with the harness's files", { harness }],
  ["from the hook alone", {}],
];

test("the fixtures are the set slice 0104 names", () => {
  assert.deepEqual(NAMES, ["before-the-hook", "failed", "five-at-once", "nested-and-resumed", "watched-run"]);
  const end = (name: string): SeenGraph => {
    const { events, harness } = load(name);
    return seenGraph(events, { harness });
  };
  // A nested subagent, and an agent that was resumed.
  const nested = end("nested-and-resumed");
  assert.ok(agentsOf(nested).some((a) => a.depth === 2));
  assert.ok(agentsOf(nested).some((a) => a.runs.length === 2) && nested.edges.some((x) => x.kind === "resumed"));
  // Five running at once.
  const five = load("five-at-once");
  const most = Math.max(...seenGraph(five.events).moments.map((at) => agentsOf(seenGraph(five.events, { at })).filter((a) => a.state === "running").length));
  assert.equal(most, 5);
  // A foreground child whose parent the hook learns only when the child ends: twelve minutes late.
  const late = seenGraph(five.events).edges.filter((x) => Date.parse(x.knownAt) - Date.parse(x.at) > 60_000);
  assert.equal(late.length, 1);
  assert.equal(agentOf(end("five-at-once"), late[0]!.to).shape, "foreground");
  // A run that failed, two subagents from before the hook, and four at once in the watched run.
  assert.deepEqual(agentsOf(end("failed")).map((a) => a.state), ["failed"]);
  assert.deepEqual(end("before-the-hook").differs.map((d) => d.what), ["not-in-hook", "not-in-hook"]);
  assert.equal(agentsOf(end("watched-run")).length, 4);
});

for (const name of NAMES) {
  test(`${name}: the graph is the one the fixture holds, with the harness's files and from the hook alone`, () => {
    const { events, harness, expected } = load(name);
    for (const [label, options, side] of [...both(harness).map(([l, o], i) => [l, o, i === 0 ? expected : expected.fromTheHookAlone] as const)]) {
      const whole = seenGraph(events, options);
      assert.deepEqual(whole.moments, side.moments, `${name}, ${label}: the moments`);
      assert.deepEqual(whole.record, side.record, `${name}, ${label}: what was read`);
      for (const graph of side.graphs) assert.deepEqual(drawn(seenGraph(events, { ...options, at: graph.at })), graph, `${name}, ${label}: the graph at ${graph.at}`);
      assert.equal(side.graphs[side.graphs.length - 1]!.at, whole.at, `${name}, ${label}: the last graph kept is the end`);
    }
  });

  test(`${name}: stepping the moment through the list is a replay`, () => {
    const { events, harness } = load(name);
    for (const [label, options] of both(harness)) {
      const whole = seenGraph(events, options);
      const where = `${name}, ${label}`;
      assert.ok(whole.moments.length > 1, where);
      assert.deepEqual([...whole.moments].sort(), whole.moments, `${where}: in order`);
      assert.equal(new Set(whole.moments).size, whole.moments.length, `${where}: each once`);
      // Before the first moment there is nothing.
      const before = seenGraph(events, { ...options, at: new Date(Date.parse(whole.moments[0]!) - 1).toISOString() });
      assert.deepEqual([before.nodes, before.edges, before.differs], [[], [], []], where);
      let prev: SeenGraph | undefined;
      whole.moments.forEach((at, k) => {
        const g = seenGraph(events, { ...options, at });
        assert.equal(g.at, at);
        // The list of moments and what was read are of the whole record, whatever the moment.
        assert.deepEqual([g.moments, g.record], [whole.moments, whole.record]);
        for (const x of g.edges) assert.ok(g.nodes.some((n) => n.id === x.from) && g.nodes.some((n) => n.id === x.to), `${where}: an edge's two ends are nodes`);
        if (prev) {
          assert.notDeepEqual(drawn({ ...g, at: "" }), drawn({ ...prev, at: "" }), `${where}: something changes at ${at}`);
          added(prev, g, `${where}, at ${at}`);
        }
        // Until the next moment the graph is this one.
        const next = whole.moments[k + 1];
        if (next !== undefined && Date.parse(next) - Date.parse(at) > 1) {
          const between = seenGraph(events, { ...options, at: new Date(Date.parse(next) - 1).toISOString() });
          assert.deepEqual(drawn({ ...between, at }), drawn(g), `${where}: nothing changes between ${at} and ${next}`);
        }
        prev = g;
      });
      // The graph at the last moment is the graph with no moment given, and any later moment's.
      assert.deepEqual(prev, whole, where);
      assert.deepEqual(drawn({ ...seenGraph(events, { ...options, at: "2031-01-01T00:00:00.000Z" }), at: whole.at }), drawn(whole), where);
    }
  });

  test(`${name}: from the hook alone, the graph at a moment is the graph the lines written by then make`, () => {
    const { events } = load(name);
    const whole = seenGraph(events);
    whole.moments.forEach((at, k) => {
      const then = seenGraph(events.filter((e) => e.t <= at));
      assert.deepEqual(drawn(seenGraph(events, { at })), drawn(then), `${name}: at ${at}`);
      assert.deepEqual(then.moments, whole.moments.slice(0, k + 1), `${name}: the moments up to ${at}`);
    });
  });

  test(`${name}: from the hook alone the graph says what the list of sessions says`, () => {
    const { events } = load(name);
    sameAsTheList(events, name);
  });
}

/** `g` is `prev` with something added, and everything added is dated the moment it was added at. */
function added(prev: SeenGraph, g: SeenGraph, where: string): void {
  const at = g.at;
  // Nodes keep their place and are never lost; edges are only ever added, and are dated when they became known.
  assert.deepEqual(g.nodes.slice(0, prev.nodes.length).map((n) => n.id), prev.nodes.map((n) => n.id), where);
  assert.deepEqual(g.edges.slice(0, prev.edges.length), prev.edges, where);
  for (const x of g.edges.slice(prev.edges.length)) {
    assert.equal(x.knownAt, at, `${where}: a new edge became known then`);
    assert.ok(x.at <= x.knownAt, `${where}: nothing is known before it happens`);
  }
  for (const d of prev.differs) assert.ok(g.differs.some((x) => JSON.stringify(x) === JSON.stringify(d)), `${where}: a difference stays`);
  const was = new Map(agentsOf(prev).map((a) => [a.id, a]));
  for (const a of agentsOf(g)) {
    const old = was.get(a.id);
    // What is known of an agent is not taken back.
    for (const key of ["type", "depth", "shape", "model", "modelAsked", "source"] as const) if (old?.[key] !== undefined) assert.equal(a[key], old[key], `${where}: ${a.id}'s ${key}`);
    a.runs.forEach((run, i) => {
      const before = old?.runs[i];
      if (before === undefined) return void assert.ok(run.from === at || (run.from === undefined && run.to === at), `${where}: a new run of ${a.id} begins then`);
      assert.equal(run.from, before.from, `${where}: a run's beginning does not move`);
      if (before.to !== undefined) assert.deepEqual(run, before, `${where}: a run that ended is as it was`);
      else if (run.to !== undefined) assert.equal(run.to, at, `${where}: a run that ends, ends then`);
    });
    assert.ok(a.runs.length >= (old?.runs.length ?? 0), where);
  }
}

/** What `summarizeSessions` says of each subagent and of the session, the graph from the hook alone says too. */
function sameAsTheList(events: SessionEvent[], where: string): void {
  const [live] = summarizeSessions(events.filter((e) => e.event !== "plan" && e.event !== "note"));
  const g = seenGraph(events);
  assert.equal(g.nodes[0]!.state, live!.state, `${where}: the session`);
  assert.deepEqual(
    agentsOf(g).map((a) => [a.id, a.type ?? "subagent", a.state, g.edges.find((x) => x.kind === "started" && x.to === a.id && x.from !== g.nodes[0]!.id)?.from]),
    live!.agents.map((a) => [a.id, a.type, a.state, a.parent]),
    where,
  );
}

test("the four older recordings of the hook: the graph says what the list says, and each is a replay of its own lines", () => {
  for (const file of ["claude-code-nested.jsonl", "claude-code-running.jsonl", "claude-code-planned.jsonl", "codex-two-subagents.jsonl"]) {
    const events = parseEvents(read(join(fixturesDir, "events", file))).events;
    sameAsTheList(events, file);
    const whole = seenGraph(events);
    let prev: SeenGraph | undefined;
    for (const at of whole.moments) {
      const g = seenGraph(events, { at });
      assert.deepEqual(drawn(g), drawn(seenGraph(events.filter((e) => e.t <= at))), `${file}: at ${at}`);
      if (prev) added(prev, g, `${file}, at ${at}`);
      prev = g;
    }
    assert.deepEqual(prev, whole, file);
  }
  // Codex tells a hook nothing of who started whom: two subagents, no edge, no depth. The graph does not guess.
  const codex = seenGraph(parseEvents(read(join(fixturesDir, "events", "codex-two-subagents.jsonl"))).events);
  assert.deepEqual([agentsOf(codex).map((a) => [a.state, a.depth, a.model]), codex.edges], [[["done", undefined, "gpt-6-luna"], ["done", undefined, "gpt-6-luna"]], []]);
  // What a lead said is not drawn here, and is not a moment.
  const planned = parseEvents(read(join(fixturesDir, "events", "claude-code-planned.jsonl"))).events;
  assert.ok(planned.some((e) => e.event === "plan") && planned.some((e) => e.event === "note"));
  assert.deepEqual(drawn(seenGraph(planned)), drawn(seenGraph(planned.filter((e) => e.event !== "plan" && e.event !== "note"))));
});

// ─── what is lost without the harness's files ─────────────────────────────

/** What the graph with the harness's files holds that the graph from the hook alone does not, at the end of a fixture. */
function lost(withFiles: SeenGraph, alone: SeenGraph): Record<string, unknown> {
  const mine = new Map(agentsOf(alone).map((a) => [a.id, a]));
  const theirs = agentsOf(withFiles);
  const later = withFiles.edges.flatMap((x) => {
    const mineIs = alone.edges.find((y) => y.from === x.from && y.to === x.to && y.kind === x.kind);
    const seconds = mineIs ? Math.round((Date.parse(mineIs.knownAt) - Date.parse(x.knownAt)) / 1000) : 0;
    return seconds >= 1 ? [`${x.to} ${seconds} s`] : [];
  });
  return {
    agents: theirs.filter((a) => !mine.has(a.id)).map((a) => a.id),
    models: theirs.filter((a) => a.model !== undefined && mine.get(a.id)?.model === undefined).length,
    modelsAsked: theirs.filter((a) => a.modelAsked !== undefined).length,
    shapes: theirs.filter((a) => a.shape !== undefined).length,
    howRunsEnded: theirs.flatMap((a) => a.runs).filter((r) => r.end !== undefined).length,
    states: theirs.flatMap((a) => (mine.has(a.id) && mine.get(a.id)!.state !== a.state ? [`${a.id} ${a.state}, not ${mine.get(a.id)!.state}`] : [])),
    parentsKnownLater: later,
    differences: withFiles.differs.length,
    moments: `${withFiles.moments.length} and ${alone.moments.length}`,
  };
}

/**
 * Each fixture drawn both ways, and what the hook's lines alone do not give. In every one: no model, whether a
 * subagent was asked for in the background or the foreground, or how a run ended. Depth is there at the end, since
 * each parent's tool line had come; a parent is known when that line is written, which for a foreground child is
 * when the child ends.
 */
const LOST: Record<string, Record<string, unknown>> = {
  // Two subagents came and went before the hook's first line: from the hook alone they are not there at all.
  "before-the-hook": { agents: ["a01", "a02"], models: 3, modelsAsked: 0, shapes: 3, howRunsEnded: 3, states: [], parentsKnownLater: [], differences: 2, moments: "8 and 5" },
  // The run failed and fired no stop: from the hook alone it is running for as long as the session goes on.
  failed: { agents: [], models: 1, modelsAsked: 1, shapes: 1, howRunsEnded: 1, states: ["a01 failed, not running"], parentsKnownLater: [], differences: 1, moments: "3 and 3" },
  // The foreground child ran for twelve minutes before the hook knew whose it was.
  "five-at-once": { agents: [], models: 7, modelsAsked: 5, shapes: 7, howRunsEnded: 7, states: [], parentsKnownLater: ["a09 732 s"], differences: 0, moments: "16 and 23" },
  "nested-and-resumed": { agents: [], models: 3, modelsAsked: 1, shapes: 3, howRunsEnded: 4, states: [], parentsKnownLater: [], differences: 0, moments: "17 and 20" },
  // Its harness file is made from the run's committed digest, which holds less than the harness's own files: no depth, no shape, no ending.
  "watched-run": { agents: [], models: 4, modelsAsked: 0, shapes: 0, howRunsEnded: 0, states: [], parentsKnownLater: [], differences: 0, moments: "14 and 15" },
};

for (const name of NAMES) {
  test(`${name}: drawn both ways, and what is lost without the harness's files`, () => {
    const { events, harness } = load(name);
    const withFiles = seenGraph(events, { harness });
    const alone = seenGraph(events);
    // The hook alone is never told a model for a Claude Code subagent, its shape, or how a run ended; and it has nothing to differ from.
    for (const a of agentsOf(alone)) {
      assert.deepEqual([a.model, a.modelAsked, a.shape, a.source], [undefined, undefined, undefined, "hook"]);
      assert.ok(a.runs.every((r) => r.end === undefined && r.source === "hook") && a.state !== "failed" && a.state !== "stopped");
    }
    assert.ok(alone.edges.every((x) => x.source === "hook") && alone.differs.length === 0 && alone.record.harness === undefined);
    // Nothing the hook saw is drawn otherwise for the harness's files being read: the same nodes, the same runs at
    // the same times, the same edges. The files add to it.
    for (const a of agentsOf(alone)) {
      const b = agentOf(withFiles, a.id);
      assert.deepEqual([b.type, b.depth], [a.type, a.depth], `${name}: ${a.id}`);
      a.runs.forEach((r, i) => {
        assert.equal(b.runs[i]!.from, r.from, `${name}: ${a.id}'s run begins when the hook said`);
        if (r.to !== undefined) assert.equal(b.runs[i]!.to, r.to, `${name}: ${a.id}'s run ends when the hook said`);
      });
    }
    for (const x of alone.edges) {
      const y = withFiles.edges.find((e) => e.from === x.from && e.to === x.to && e.kind === x.kind);
      assert.ok(y !== undefined && y.at === x.at && y.knownAt <= x.knownAt, `${name}: the edge to ${x.to}`);
    }
    assert.deepEqual(lost(withFiles, alone), LOST[name], name);
  });
}

// ─── lines written by hand ────────────────────────────────────────────────

const T0 = Date.parse("2026-02-01T10:00:00.000Z");
const t = (seconds: number): string => new Date(T0 + seconds * 1000).toISOString();
const line = (seconds: number, event: SessionEvent["event"], extra: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t: t(seconds), harness: "claude-code", event, session: "s1", ...extra });
const ran = (id: string, from: number, to: number, extra: Partial<HarnessAgent> = {}, end: "completed" | "failed" | "killed" | "ended" = "completed"): HarnessAgent => ({ id, type: "general-purpose", depth: 1, shape: "background", model: "m-large", runs: [{ first: t(from), last: t(to), end }], ...extra });

test("no line, no graph; and the lines of another session, or what a lead said, are passed over", () => {
  const empty = seenGraph([]);
  assert.deepEqual(empty, { groophSeen: 0, at: "", nodes: [], edges: [], differs: [], moments: [], record: { hook: { lines: 0, stopsNotDrawn: 0 } } });
  // The harness's files alone do not make a graph: the hook's lines are what names the session.
  assert.deepEqual(seenGraph([], { harness: [ran("a1", 0, 5)] }).nodes, []);
  const mine = [line(0, "session-start"), line(1, "turn-start"), line(2, "subagent-start", { agent: "a1", type: "Explore" }), line(9, "subagent-stop", { agent: "a1", type: "Explore" }), line(10, "turn-end")];
  const mixed = [mine[0]!, { ...line(1, "subagent-start", { agent: "zz", type: "Plan" }), session: "s2" }, line(1, "plan", { text: "a plan", agents: [{ type: "Explore" }] }), ...mine.slice(1), line(11, "note", { text: "done" })];
  assert.deepEqual(seenGraph(mixed), seenGraph(mine));
  assert.equal(seenGraph(mixed).record.hook.lines, 5);
});

test("it is a pure function of what it is given: the same answer twice, and nothing it was handed is changed", () => {
  const { events, harness } = load("five-at-once");
  const frozen = <T>(value: T): T => {
    if (typeof value === "object" && value !== null) {
      for (const v of Object.values(value)) frozen(v);
      Object.freeze(value);
    }
    return value;
  };
  const a = seenGraph(frozen(structuredClone(events)), { harness: frozen(structuredClone(harness)) });
  assert.deepEqual(a, seenGraph(events, { harness }));
  // Lines handed over out of order are read in the order of their times.
  assert.deepEqual(seenGraph([...events].reverse(), { harness }).nodes.map((n) => [n.id, n.state]), a.nodes.map((n) => [n.id, n.state]));
});

test("a foreground child's parent is known to the hook only when the child ends; the harness's files know it from the start", () => {
  const lines = [
    line(0, "session-start"),
    line(1, "turn-start"),
    line(2, "subagent-start", { agent: "p", type: "general-purpose" }),
    line(2.01, "tool", { tool: "Agent", spawned: "p" }),
    line(10, "subagent-start", { agent: "c", type: "Explore" }),
    line(70, "subagent-stop", { agent: "c", type: "Explore" }),
    // The tool's line is written when the call returns: for a foreground child, at its end.
    line(70, "tool", { agent: "p", type: "general-purpose", tool: "Agent", spawned: "c" }),
    line(80, "subagent-stop", { agent: "p", type: "general-purpose" }),
  ];
  const running = seenGraph(lines, { at: t(10) });
  assert.deepEqual([agentOf(running, "c").state, agentOf(running, "c").depth, edgeTo(running, "c")], ["running", undefined, undefined]);
  const end = seenGraph(lines);
  assert.deepEqual(edgeTo(end, "c"), { from: "p", to: "c", kind: "started", at: t(10), knownAt: t(70), source: "hook" });
  assert.deepEqual([agentOf(end, "p").depth, agentOf(end, "c").depth], [1, 2]);
  const harness = [ran("p", 1.9, 79.9), ran("c", 9.9, 69.9, { parent: "p", depth: 2, shape: "foreground", type: "Explore" })];
  const known = seenGraph(lines, { harness, at: t(10) });
  assert.deepEqual(edgeTo(known, "c"), { from: "p", to: "c", kind: "started", at: t(10), knownAt: t(10), source: "both" });
  assert.deepEqual([agentOf(known, "c").depth, agentOf(known, "c").shape], [2, "foreground"]);
  // And with the files read, the tool's line at the end adds nothing: it is not a moment.
  assert.equal(seenGraph(lines, { harness }).moments.filter((m) => m === t(70)).length, 1);
  assert.deepEqual(seenGraph(lines, { harness }).differs, []);
});

test("a child first met through its parent's tool line does not take its parent's type", () => {
  const lines = [
    line(0, "turn-start"),
    line(1, "subagent-start", { agent: "p", type: "general-purpose" }),
    line(1, "tool", { tool: "Agent", spawned: "p" }),
    // The line is the parent's: the type on it is the parent's own.
    line(5, "tool", { agent: "p", type: "general-purpose", tool: "Agent", spawned: "c" }),
    line(5.01, "subagent-start", { agent: "c", type: "Explore" }),
  ];
  const first = seenGraph(lines, { at: t(5) });
  assert.deepEqual([agentOf(first, "c").type, agentOf(first, "c").state, agentOf(first, "c").runs], [undefined, "running", [{ from: t(5), source: "hook" }]]);
  const end = seenGraph(lines);
  assert.deepEqual([agentOf(end, "c").type, agentOf(end, "p").type], ["Explore", "general-purpose"]);
  // Its own start line does not begin a second run.
  assert.deepEqual(agentOf(end, "c").runs, [{ from: t(5), source: "hook" }]);
});

test("stop lines with no type from ids never seen starting are counted and not drawn; a stop that names its type is drawn", () => {
  const lines = [
    line(0, "turn-start"),
    line(5, "turn-end"),
    line(7, "subagent-stop", { agent: "helper-1" }),
    line(8, "subagent-stop", { agent: "helper-2" }),
    // It began before the hook was installed: its stop still names it.
    line(9, "subagent-stop", { agent: "early", type: "Plan" }),
    line(10, "subagent-start", { agent: "a1", type: "Explore" }),
    // A stop with no type from an agent that was seen starting is that agent's stop.
    line(12, "subagent-stop", { agent: "a1" }),
  ];
  const g = seenGraph(lines);
  assert.equal(g.record.hook.stopsNotDrawn, 2);
  assert.deepEqual(agentsOf(g).map((a) => [a.id, a.type, a.state, a.runs]), [
    ["early", "Plan", "done", [{ to: t(9), source: "hook" }]],
    ["a1", "Explore", "done", [{ from: t(10), to: t(12), source: "hook" }]],
  ]);
  assert.ok(!g.moments.includes(t(7)) && !g.moments.includes(t(8)));
  // The count is of the whole record, whatever the moment.
  assert.equal(seenGraph(lines, { at: t(1) }).record.hook.stopsNotDrawn, 2);
});

test("a run left open when its session ends was not seen to finish, and the session has ended", () => {
  const lines = [line(0, "session-start"), line(1, "turn-start"), line(2, "subagent-start", { agent: "a1", type: "general-purpose" }), line(2, "tool", { tool: "Agent", spawned: "a1" }), line(3, "turn-end")];
  const open = seenGraph(lines);
  assert.deepEqual([open.nodes[0]!.state, agentOf(open, "a1").state], ["working", "running"]);
  // A session's start during a run (the harness fires one when it compacts) ends nothing.
  const compacted = seenGraph([...lines, line(50, "session-start")]);
  assert.deepEqual([compacted.nodes[0]!.state, agentOf(compacted, "a1").state], ["working", "running"]);
  const ended = seenGraph([...lines, line(100, "session-end")]);
  assert.deepEqual([ended.nodes[0]!.state, agentOf(ended, "a1").state, agentOf(ended, "a1").runs], ["ended", "not-seen-to-finish", [{ from: t(2), notSeenToFinish: true, source: "hook" }]]);
  // Opened again, it is still not running: the session that ran it closed.
  const again = seenGraph([...lines, line(100, "session-end"), line(200, "session-start"), line(201, "turn-start")]);
  assert.deepEqual([again.nodes[0]!.state, agentOf(again, "a1").state], ["working", "not-seen-to-finish"]);
  // A stop written after the session's end is still its stop.
  const stopped = seenGraph([...lines, line(100, "session-end"), line(100.2, "subagent-stop", { agent: "a1", type: "general-purpose" })]);
  assert.deepEqual([stopped.nodes[0]!.state, agentOf(stopped, "a1").state, agentOf(stopped, "a1").runs], ["ended", "done", [{ from: t(2), to: t(100.2), source: "hook" }]]);
  // With the harness's files, how it ended is known when it happened, long before the session closed.
  const failed = seenGraph([...lines, line(100, "session-end")], { harness: [ran("a1", 1.9, 40, {}, "failed")] });
  assert.deepEqual([agentOf(failed, "a1").state, agentOf(failed, "a1").runs, failed.differs], ["failed", [{ from: t(2), to: t(40), end: "failed", source: "both" }], [{ agent: "a1", what: "no-stop-line", run: 0 }]]);
  assert.equal(seenGraph([...lines, line(100, "session-end")], { harness: [ran("a1", 1.9, 40, {}, "failed")], at: t(50) }).nodes[0]!.state, "waiting");
});

test("an agent that runs again: a second run, and an edge from the one that started it", () => {
  const lines = [
    line(0, "turn-start"),
    line(1, "subagent-start", { agent: "a1", type: "general-purpose" }),
    line(1.01, "tool", { tool: "Agent", spawned: "a1" }),
    line(20, "subagent-stop", { agent: "a1", type: "general-purpose" }),
    line(300, "subagent-start", { agent: "a1", type: "general-purpose" }),
    line(320, "subagent-stop", { agent: "a1", type: "general-purpose" }),
  ];
  const g = seenGraph(lines);
  assert.deepEqual(agentOf(g, "a1").runs, [{ from: t(1), to: t(20), source: "hook" }, { from: t(300), to: t(320), source: "hook" }]);
  assert.deepEqual(edgeTo(g, "a1", "resumed"), { from: "s1", to: "a1", kind: "resumed", at: t(300), knownAt: t(300), source: "hook" });
  // Where no record says who started it, it has no edge of either kind: the graph does not guess.
  const orphan = seenGraph(lines.filter((e) => e.event !== "tool"));
  assert.deepEqual([agentOf(orphan, "a1").runs.length, orphan.edges], [2, []]);
  // A second start with no stop between: the first run was not seen to finish, and is not the one running.
  const twice = seenGraph(lines.filter((e) => e.t !== t(20)));
  assert.deepEqual(agentOf(twice, "a1").runs, [{ from: t(1), notSeenToFinish: true, source: "hook" }, { from: t(300), to: t(320), source: "hook" }]);
  // Codex's hook fires a stop each time a subagent's turn ends: a second stop is a run whose beginning was not seen.
  const stops = seenGraph([line(0, "turn-start"), line(1, "subagent-start", { agent: "a1", type: "default" }), line(5, "subagent-stop", { agent: "a1", type: "default" }), line(9, "subagent-stop", { agent: "a1", type: "default" })]);
  assert.deepEqual(agentOf(stops, "a1").runs, [{ from: t(1), to: t(5), source: "hook" }, { to: t(9), source: "hook" }]);
});

test("where the two records disagree, both are kept and the difference is listed", () => {
  const lines = [
    line(0, "turn-start", { model: "m-lead" }),
    line(1, "subagent-start", { agent: "p", type: "general-purpose" }),
    line(1, "tool", { tool: "Agent", spawned: "p" }),
    line(2, "subagent-start", { agent: "c", type: "Explore", model: "m-small" }),
    line(2, "tool", { tool: "Agent", spawned: "c" }),
    line(8, "subagent-stop", { agent: "c", type: "Explore", model: "m-small" }),
    line(9, "subagent-stop", { agent: "p", type: "general-purpose" }),
  ];
  const harness = [ran("p", 0.9, 8.9), ran("c", 1.9, 7.9, { type: "Plan", parent: "p", depth: 2, model: "m-large" })];
  const g = seenGraph(lines, { harness });
  // The node shows the hook's word; the list holds both.
  assert.deepEqual([agentOf(g, "c").type, agentOf(g, "c").model, g.nodes[0]!.kind === "session" && g.nodes[0]!.model], ["Explore", "m-small", "m-lead"]);
  assert.deepEqual(g.differs, [
    { agent: "c", what: "type", hook: "Explore", harness: "Plan" },
    { agent: "c", what: "parent", hook: "s1", harness: "p" },
    { agent: "c", what: "model", hook: "m-small", harness: "m-large" },
  ]);
  // Two parents are two edges, each from the record that names it.
  assert.deepEqual(g.edges.filter((x) => x.to === "c").map((x) => [x.from, x.source]), [["p", "harness"], ["s1", "hook"]]);
  // The harness's depth stands; the hook's lines would have made it 1.
  assert.equal(agentOf(g, "c").depth, 2);
});

test("an agent or a run that only one record holds", () => {
  const lines = [
    line(0, "turn-start"),
    line(1, "subagent-start", { agent: "seen-only", type: "Explore" }),
    line(3, "subagent-stop", { agent: "seen-only", type: "Explore" }),
    // The hook was installed while this one ran: its stop, and then a run of it from start to stop.
    line(30, "subagent-stop", { agent: "mid", type: "general-purpose" }),
    line(100, "subagent-start", { agent: "mid", type: "general-purpose" }),
    line(120, "subagent-stop", { agent: "mid", type: "general-purpose" }),
    // The hook saw this one run twice; the harness's files hold one run.
    line(200, "subagent-start", { agent: "twice", type: "general-purpose" }),
    line(210, "subagent-stop", { agent: "twice", type: "general-purpose" }),
    line(400, "subagent-start", { agent: "twice", type: "general-purpose" }),
    line(410, "subagent-stop", { agent: "twice", type: "general-purpose" }),
  ];
  const harness: HarnessAgent[] = [
    ran("gone", -500, -400),
    // Three runs: one wholly before the hook, one the hook saw end, one it saw whole.
    { id: "mid", type: "general-purpose", depth: 1, runs: [{ first: t(-300), last: t(-200), end: "completed" }, { first: t(-50), last: t(29.9), end: "completed" }, { first: t(99.9), last: t(119.9), end: "killed" }] },
    ran("twice", 199.9, 409.9),
  ];
  const g = seenGraph(lines, { harness });
  assert.deepEqual(g.differs, [
    { agent: "gone", what: "not-in-hook" },
    { agent: "mid", what: "run-not-in-hook", run: 0 },
    { agent: "mid", what: "no-start-line", run: 1 },
    { agent: "seen-only", what: "not-in-harness" },
    { agent: "twice", what: "run-not-in-harness", run: 1 },
  ]);
  assert.deepEqual(agentsOf(g).map((a) => [a.id, a.source, a.state, a.runs.map((r) => r.source)]), [
    ["gone", "harness", "done", ["harness"]],
    ["mid", "both", "stopped", ["harness", "both", "both"]],
    ["seen-only", "hook", "done", ["hook"]],
    ["twice", "both", "done", ["both", "hook"]],
  ]);
  // The run the hook saw only the end of begins when the harness's files say, and ends when the hook said.
  assert.deepEqual(agentOf(g, "mid").runs[1], { from: t(-50), to: t(30), end: "completed", source: "both" });
  // Resumed twice, by the one the harness's files say started it: the session, for an agent at depth 1.
  assert.deepEqual(g.edges.filter((x) => x.to === "mid").map((x) => [x.from, x.kind, x.at, x.source]), [["s1", "started", t(-300), "harness"], ["s1", "resumed", t(-50), "both"], ["s1", "resumed", t(100), "both"]]);
  // Before the hook's first line nothing says what the session itself was doing.
  assert.deepEqual([seenGraph(lines, { harness, at: t(-450) }).nodes[0]!.state, seenGraph(lines, { harness, at: t(-350) }).nodes[0]!.state], ["working", "not-yet-seen"]);
  // Files read and found empty are not the same as files not read: with none, every agent the hook saw differs.
  assert.deepEqual(seenGraph(lines, { harness: [] }).differs.map((d) => d.what), ["not-in-harness", "not-in-harness", "not-in-harness"]);
  assert.deepEqual([seenGraph(lines, { harness: [] }).record.harness, seenGraph(lines).record.harness], [{ agents: 0 }, undefined]);
});

test("a harness's files that are not in the shape expected draw less, and never throw", () => {
  const lines = [line(0, "turn-start"), line(1, "subagent-start", { agent: "a1", type: "Explore" }), line(5, "subagent-stop", { agent: "a1", type: "Explore" })];
  const odd = [
    { id: "a1", depth: 0, shape: "sideways", runs: [{ first: "not a time", last: t(4) }, { first: t(0.9), last: "nor this", end: "exploded" }] },
    { id: "a1", type: "Plan", runs: [] },
    { id: "", runs: [] },
    { id: "named-only", parent: "nobody-has-this-one", runs: "none" },
    null,
  ] as unknown as HarnessAgent[];
  const g = seenGraph(lines, { harness: odd });
  assert.deepEqual(agentOf(g, "a1"), { id: "a1", kind: "subagent", type: "Explore", state: "done", runs: [{ from: t(1), to: t(5), source: "both" }], source: "both" });
  assert.deepEqual(g.differs, []);
  assert.equal(g.record.harness!.agents, 2);
});
