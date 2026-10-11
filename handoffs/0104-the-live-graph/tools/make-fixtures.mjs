#!/usr/bin/env node
/**
 * Makes the fixtures under `fixtures/seen/` from real sessions of this project (slice 0104).
 *
 *   pnpm -r build
 *   node handoffs/0104-the-live-graph/tools/make-fixtures.mjs <folder of event files> <project-folder prefix> [<config folder of the watched run> <its project folder>]
 *   node handoffs/0104-the-live-graph/tools/make-fixtures.mjs --expected      # only expected.json again, from the files in the repository
 *
 * The watched run (`experiments/watching/haiku/four/invited-1/`) was a session in a profile of its own, so its
 * events are read from the repository and its subagents' files from that profile's folder, when the two last
 * arguments name it. Without them its `harness.json` is made from the run's committed `transcript-digest.json`,
 * which holds less: a type, the model that answered, and a first and a last time.
 *
 * Each fixture is a run of consecutive lines from one session's events file, and what the harness's own files said
 * of the subagents that began inside those lines. Three files:
 *
 *   events.jsonl    the hook's lines, each rebuilt from a fixed list of keys
 *   harness.json    one entry a subagent, as `packages/cli/src/claude-files.ts` returns it
 *   expected.json   the graph `seenGraph` draws from those two, at chosen moments
 *
 * What is kept: the kind of each line, a subagent's type (only the harness's own types), the tool's name on a tool
 * line, model names, depth, background or foreground, and how each run ended.
 * What is changed: every id is renumbered in the order it first appears; every time is moved by one amount, so
 * that the fixture begins at 2026-01-01T00:00:00.000Z; the working folder becomes `/work/demo`.
 * What is left out: where a transcript is kept. Nothing a session read, wrote or said is in the hook's lines or in
 * what the reader returns, so none can be here; a line with a key this script does not know stops it.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const out = join(root, "fixtures", "seen");
const { parseEvents, seenGraph } = await import(join(root, "packages/core/dist/src/index.js"));
const { readClaudeAgents } = await import(join(root, "packages/cli/dist/src/claude-files.js"));

/**
 * `lines`: the first and last line of the session's events file, counted from 1. `at` and `alone`: which moments
 * to keep a graph of, with the harness's files and from the hook alone, counted from 0 in each one's own list; the
 * last moment is always kept.
 */
const FIXTURES = [
  // A child met through its parent's tool line before its own start line; a nested child; an agent resumed; a session that ends.
  { name: "nested-and-resumed", session: "a9e0c432-7fe5-4eb3-9878-a594b724e4a4", lines: [1, 35], at: [8, 12], alone: [5] },
  // Five running at once; a foreground child whose parent the hook learns only when it ends; a nested child in the background.
  { name: "five-at-once", session: "3e9d2b43-91b3-40a4-9859-23f9fc76c901", lines: [123, 166], at: [5], alone: [12] },
  // A run that failed: the hook has its start and no stop.
  { name: "failed", session: "3e9d2b43-91b3-40a4-9859-23f9fc76c901", lines: [1314, 1331], at: [1], alone: [] },
  // Two subagents that had come and gone before the hook was installed.
  { name: "before-the-hook", session: "3e9d2b43-91b3-40a4-9859-23f9fc76c901", lines: [1, 8], before: true, at: [1, 3], alone: [] },
  // The run of the watching check that the repository holds: four subagents started in one turn.
  { name: "watched-run", session: "8636ef98-4c57-4312-9a58-279d2590405d", run: "experiments/watching/haiku/four/invited-1", lines: [1, 24], at: [6], alone: [4] },
];

const START = Date.parse("2026-01-01T00:00:00.000Z");
const TYPES = ["general-purpose", "claude-code-guide", "Plan", "Explore", "statusline-setup"];
const EVENT_KEYS = ["v", "t", "harness", "event", "session", "agent", "type", "tool", "spawned", "model", "cwd", "transcript"];

/** One element a line: a fixture is read by a person, on a phone. */
const rows = (list) => (list.length === 0 ? "[]" : `[\n${list.map((x) => `    ${JSON.stringify(x)}`).join(",\n")}\n  ]`);
const graphText = (g) => `{\n  "at": ${JSON.stringify(g.at)},\n  "nodes": ${rows(g.nodes)},\n  "edges": ${rows(g.edges)},\n  "differs": ${rows(g.differs)}\n}`.replace(/\n/g, "\n    ");

/** The moments, the record, and the graph at each chosen moment and at the last. */
function side(events, options, at, indent) {
  const whole = seenGraph(events, options);
  const chosen = [...new Set([...at.filter((k) => k < whole.moments.length - 1), whole.moments.length - 1])].map((k) => {
    const g = seenGraph(events, { ...options, at: whole.moments[k] });
    return { at: g.at, nodes: g.nodes, edges: g.edges, differs: g.differs };
  });
  const text = [`"moments": ${JSON.stringify(whole.moments)},`, `"record": ${JSON.stringify(whole.record)},`, `"graphs": [\n  ${chosen.map(graphText).join(",\n  ").replace(/\n {4}/g, "\n  ")}\n]`].join("\n");
  return { whole, text: text.replace(/\n/g, `\n${indent}`) };
}

function expected(dir, fixture) {
  const events = parseEvents(readFileSync(join(dir, "events.jsonl"), "utf8")).events;
  const harness = JSON.parse(readFileSync(join(dir, "harness.json"), "utf8"));
  const both = side(events, { harness }, fixture.at, "  ");
  const alone = side(events, {}, fixture.alone, "    ");
  writeFileSync(join(dir, "expected.json"), `{\n  ${both.text},\n  "fromTheHookAlone": {\n    ${alone.text}\n  }\n}\n`);
  return { whole: both.whole, alone: alone.whole };
}

const args = process.argv.slice(2);
if (args[0] === "--expected") {
  for (const name of readdirSync(out).sort()) {
    const fixture = FIXTURES.find((f) => f.name === name);
    if (fixture) expected(join(out, name), fixture);
  }
  process.exit(0);
}
const [eventsDir, prefix, watchedConfig, watchedProject] = args;
if (!eventsDir || !prefix) {
  console.error("usage: make-fixtures.mjs <folder of event files> <project-folder prefix>   |   make-fixtures.mjs --expected");
  process.exit(1);
}

for (const fixture of FIXTURES) {
  const all = readFileSync(join(fixture.run !== undefined ? join(root, fixture.run, "events") : eventsDir, `${fixture.session}.jsonl`), "utf8").split("\n").filter((line) => line.trim() !== "");
  const kept = all.slice(fixture.lines[0] - 1, fixture.lines[1]).map((line) => JSON.parse(line));
  for (const e of kept) {
    const unknown = Object.keys(e).filter((key) => !EVENT_KEYS.includes(key));
    if (unknown.length > 0) throw new Error(`${fixture.name}: a line has a key this script does not know (${unknown.join(", ")})`);
    if (e.type !== undefined && !TYPES.includes(e.type)) throw new Error(`${fixture.name}: a subagent type that is not the harness's own`);
  }
  const from = Math.min(...kept.map((e) => Date.parse(e.t)));
  const to = Math.max(...kept.map((e) => Date.parse(e.t)));

  // The subagents that began inside these lines (and, for one fixture, the ones that had come and gone before them).
  const read =
    fixture.run === undefined
      ? readClaudeAgents(fixture.session, { only: (folder) => folder.startsWith(prefix) })
      : watchedConfig !== undefined && watchedProject !== undefined
        ? readClaudeAgents(fixture.session, { env: { CLAUDE_CONFIG_DIR: watchedConfig }, only: (folder) => folder === watchedProject })
        : // What the runner's digest of that run's transcripts kept of each subagent, and no more.
          JSON.parse(readFileSync(join(root, fixture.run, "transcript-digest.json"), "utf8"))
            .filter((entry) => /^agent-[A-Za-z0-9_-]+\.jsonl$/.test(entry.transcript))
            .map((entry) => ({ id: entry.transcript.slice(6, -6), type: entry.who, ...(entry.models.length === 1 ? { model: entry.models[0] } : {}), runs: [{ first: entry.started, last: entry.ended }] }))
            .sort((a, b) => (a.runs[0].first < b.runs[0].first ? -1 : 1));
  const harness = read
    .map((agent) => ({ ...agent, runs: agent.runs.filter((run) => Date.parse(run.first) <= to) }))
    .filter((agent) => agent.runs.length > 0 && (Date.parse(agent.runs[0].first) >= from || (fixture.before === true && agent.runs.every((run) => Date.parse(run.last) < from))));
  for (const agent of harness) {
    if (agent.type !== undefined && !TYPES.includes(agent.type)) throw new Error(`${fixture.name}: a subagent type that is not the harness's own`);
    for (const run of agent.runs) if (Date.parse(run.last) > to) throw new Error(`${fixture.name}: a run goes on past the last line kept; choose lines that hold it whole`);
  }

  const shift = START - Math.min(from, ...harness.flatMap((agent) => agent.runs.map((run) => Date.parse(run.first))));
  const moved = (t) => new Date(Date.parse(t) + shift).toISOString();
  // Ids in the order they first appear, in either record.
  const seen = [
    ...harness.map((agent) => ({ t: Date.parse(agent.runs[0].first), id: agent.id })),
    ...kept.flatMap((e) => [e.agent, e.spawned].filter((id) => id !== undefined).map((id) => ({ t: Date.parse(e.t), id }))),
  ].sort((a, b) => a.t - b.t);
  const ids = new Map();
  for (const { id } of seen) if (!ids.has(id)) ids.set(id, `a${String(ids.size + 1).padStart(2, "0")}`);
  const session = `seen-${fixture.name}`;

  const events = kept.map((e) => ({
    v: e.v,
    t: moved(e.t),
    harness: e.harness,
    event: e.event,
    session,
    ...(e.agent !== undefined ? { agent: ids.get(e.agent) } : {}),
    ...(e.type !== undefined ? { type: e.type } : {}),
    ...(e.tool !== undefined ? { tool: e.tool } : {}),
    ...(e.spawned !== undefined ? { spawned: ids.get(e.spawned) } : {}),
    ...(e.model !== undefined ? { model: e.model } : {}),
    ...(e.cwd !== undefined ? { cwd: "/work/demo" } : {}),
  }));
  const files = harness.map((agent) => ({
    id: ids.get(agent.id),
    ...(agent.type !== undefined ? { type: agent.type } : {}),
    ...(agent.depth !== undefined ? { depth: agent.depth } : {}),
    ...(agent.parent !== undefined ? { parent: ids.get(agent.parent) ?? "a00" } : {}),
    ...(agent.shape !== undefined ? { shape: agent.shape } : {}),
    ...(agent.modelAsked !== undefined ? { modelAsked: agent.modelAsked } : {}),
    ...(agent.model !== undefined ? { model: agent.model } : {}),
    runs: agent.runs.map((run) => ({ first: moved(run.first), last: moved(run.last), ...(run.end !== undefined ? { end: run.end } : {}) })),
  }));

  const dir = join(out, fixture.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "events.jsonl"), `${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
  writeFileSync(join(dir, "harness.json"), `[\n${files.map((agent) => `  ${JSON.stringify(agent)}`).join(",\n")}\n]\n`);
  const { whole, alone } = expected(dir, fixture);
  console.log(`${fixture.name}: session ${fixture.session}, lines ${fixture.lines[0]} to ${fixture.lines[1]} of ${all.length}; ${harness.length} subagents from the harness's files; ${whole.moments.length} moments (${alone.moments.length} from the hook alone); ${whole.record.hook.stopsNotDrawn} stops not drawn; differs: ${whole.differs.map((d) => `${d.agent} ${d.what}`).join(", ") || "none"}`);
}
