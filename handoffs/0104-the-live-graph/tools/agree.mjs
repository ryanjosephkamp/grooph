#!/usr/bin/env node
/**
 * How far the hook's lines and Claude Code's own files agree, counted over real sessions (slice 0104).
 *
 *   pnpm -r build
 *   node handoffs/0104-the-live-graph/tools/agree.mjs <folder of event files> <project-folder prefix>
 *
 * It reads each Claude Code session's event file, asks the reader (`packages/cli/src/claude-files.ts`) what the
 * harness's files say of that session, looking only in project folders whose names begin with the prefix, and
 * draws the graph both ways (`seenGraph` in core). It prints ids, counts and times. The reader returns nothing a
 * session read, wrote or said, so nothing of that kind can reach this script.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const { parseEvents, seenGraph, summarizeSessions } = await import(join(root, "packages/core/dist/src/index.js"));
const { readClaudeAgents } = await import(join(root, "packages/cli/dist/src/claude-files.js"));

const [eventsDir, prefix] = process.argv.slice(2);
if (!eventsDir || !prefix) {
  console.error("usage: agree.mjs <folder of event files> <project-folder prefix>");
  process.exit(1);
}
const only = (folder) => folder.startsWith(prefix);
const ms = (t) => Date.parse(t);
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? "none" : `n=${s.length} min=${s[0].toFixed(2)} median=${s[Math.floor(s.length / 2)].toFixed(2)} max=${s[s.length - 1].toFixed(2)} s`;
};

const total = { sessions: 0, noFiles: 0, harnessAgents: 0, harnessRuns: 0, hookStarted: 0, hookStopped: 0, startLines: 0, typedStops: 0, matchedIds: 0, runsEqual: 0, parentAgree: 0, parentBoth: 0, typeAgree: 0, typeBoth: 0, spawnedLines: 0, nested: 0, stopsNotDrawn: 0, lateParents: 0, resumedEdges: 0, toolFirst: 0, toolFirstNested: 0, sessionEnds: 0, sessionStarts: 0, leftOpen: 0 };
const startDelay = [];
const stopDelay = [];
const knownLate = [];
const rows = [];
const kinds = new Map();
let stepped = 0;
let reopened = 0;

for (const file of readdirSync(eventsDir).filter((n) => n.endsWith(".jsonl") && !n.startsWith("said-")).sort()) {
  const events = parseEvents(readFileSync(join(eventsDir, file), "utf8")).events;
  if (events.length === 0 || events[0].harness !== "claude-code") continue;
  const session = events[0].session;
  const short = session.slice(0, 8);
  const harness = readClaudeAgents(session, { only });
  total.sessions += 1;
  if (harness.length === 0) total.noFiles += 1;

  const starts = new Map();
  const stops = new Map();
  for (const e of events) {
    if (e.event === "subagent-start" && e.agent) starts.set(e.agent, [...(starts.get(e.agent) ?? []), e.t]);
    if (e.event === "subagent-stop" && e.agent && e.type) stops.set(e.agent, [...(stops.get(e.agent) ?? []), e.t]);
    if (e.event === "tool" && e.spawned) total.spawnedLines += 1;
  }
  total.hookStarted += starts.size;
  total.hookStopped += stops.size;
  for (const list of starts.values()) total.startLines += list.length;
  for (const list of stops.values()) total.typedStops += list.length;

  const alone = seenGraph(events);
  const both = seenGraph(events, { harness });
  total.stopsNotDrawn += both.record.hook.stopsNotDrawn;
  const hookNode = new Map(alone.nodes.filter((n) => n.kind === "subagent").map((n) => [n.id, n]));
  const hookParent = new Map(alone.edges.filter((x) => x.kind === "started").map((x) => [x.to, x]));
  total.resumedEdges += both.edges.filter((x) => x.kind === "resumed").length;

  for (const agent of harness) {
    total.harnessAgents += 1;
    total.harnessRuns += agent.runs.length;
    if (agent.depth > 1) total.nested += 1;
    const seen = hookNode.get(agent.id);
    if (!starts.has(agent.id)) continue;
    total.matchedIds += 1;
    if (starts.get(agent.id).length === agent.runs.length) total.runsEqual += 1;
    if (seen?.type !== undefined && agent.type !== undefined) {
      total.typeBoth += 1;
      if (seen.type === agent.type) total.typeAgree += 1;
    }
    const edge = hookParent.get(agent.id);
    if (edge) {
      total.parentBoth += 1;
      if (edge.from === (agent.parent ?? session)) total.parentAgree += 1;
      const late = (ms(edge.knownAt) - ms(edge.at)) / 1000;
      knownLate.push(late);
      if (late > 5) {
        total.lateParents += 1;
        rows.push(`${short} ${agent.id} (${agent.shape ?? "?"}, depth ${agent.depth ?? "?"}): its parent was known to the hook ${late.toFixed(0)} s after it started`);
      }
    }
    // Each start line against the run it falls in; each typed stop against that run's last line.
    for (const t of starts.get(agent.id)) {
      const run = [...agent.runs].reverse().find((r) => ms(r.first) <= ms(t) + 1000);
      if (run) startDelay.push((ms(t) - ms(run.first)) / 1000);
    }
    for (const t of stops.get(agent.id) ?? []) {
      const run = [...agent.runs].reverse().find((r) => ms(r.first) <= ms(t));
      if (run) stopDelay.push((ms(t) - ms(run.last)) / 1000);
    }
  }
  for (const d of both.differs) {
    kinds.set(d.what, (kinds.get(d.what) ?? 0) + 1);
    const node = both.nodes.find((n) => n.id === d.agent);
    const run = d.run !== undefined ? node.runs[d.run] : undefined;
    rows.push(`${short} ${d.agent} (${node.type ?? "?"}): ${d.what}${d.run !== undefined ? `, run ${d.run + 1} of ${node.runs.length}${run.from ? ` from ${run.from}` : ""}${run.to ? ` to ${run.to}` : ""}${run.end ? `, ${run.end}` : ""}` : ""}${d.hook !== undefined ? ` (hook ${d.hook}, harness ${d.harness})` : ""}${d.what === "not-in-hook" ? `, ran ${node.runs[0]?.from} to ${node.runs[node.runs.length - 1]?.to ?? "?"}; the hook's first line is ${events[0].t}` : ""}`);
  }
  for (const n of both.nodes) if (n.kind === "subagent" && (n.state === "running" || n.state === "not-seen-to-finish")) rows.push(`${short} ${n.id} (${n.type ?? "?"}): ${n.state} at the end of the record, with the harness's files read`);

  // Where the graph from the hook alone and the list `grooph sessions` prints do not say the same of an agent or of
  // the session. Until the list's reading is put right (the slice's second pull request) there are two known kinds:
  // a run left open at its session's end, and a child first met through its parent's tool line.
  const [live] = summarizeSessions(events);
  const listed = new Map(live.agents.map((x) => [x.id, x]));
  for (const n of alone.nodes) {
    if (n.kind !== "subagent") continue;
    const x = listed.get(n.id);
    if (!x || x.state !== n.state || x.type !== (n.type ?? "subagent")) rows.push(`${short} ${n.id}: the graph from the hook alone says ${n.type ?? "no type"}, ${n.state}; the list says ${x ? `${x.type}, ${x.state}` : "nothing"}`);
  }
  if (live.state !== alone.nodes[0].state) rows.push(`${short}: the graph from the hook alone says the session is ${alone.nodes[0].state}; the list says ${live.state}`);
  // A tool line written before the child's own start line: how the child is first met, and whether its parent is a subagent.
  const startAt = new Map(events.filter((e) => e.event === "subagent-start" && e.agent).map((e) => [e.agent, e.t]));
  for (const e of events) {
    if (e.event !== "tool" || !e.spawned || !startAt.has(e.spawned) || e.t >= startAt.get(e.spawned)) continue;
    total.toolFirst += 1;
    if (e.agent) total.toolFirstNested += 1;
  }
  total.sessionEnds += events.filter((e) => e.event === "session-end").length;
  total.sessionStarts += events.filter((e) => e.event === "session-start").length;
  total.leftOpen += alone.nodes.filter((n) => n.kind === "subagent").reduce((count, n) => count + n.runs.filter((r) => r.notSeenToFinish).length, 0);

  // Stepping the moment: each graph is the one before with something added, dated that moment; the last is the whole.
  for (const [graph, opts] of [[alone, {}], [both, { harness }]]) {
    let prev;
    for (const at of graph.moments) {
      const g = seenGraph(events, { ...opts, at });
      stepped += 1;
      if (prev) {
        const same = JSON.stringify({ ...prev, at: "" }) === JSON.stringify({ ...g, at: "" });
        if (same) rows.push(`${short}: nothing changed at the moment ${at}`);
        for (const node of prev.nodes) if (!g.nodes.some((n) => n.id === node.id)) rows.push(`${short}: node ${node.id} was lost at ${at}`);
        for (const edge of prev.edges) if (!g.edges.some((x) => JSON.stringify(x) === JSON.stringify(edge))) rows.push(`${short}: an edge changed or was lost at ${at}`);
        for (const edge of g.edges) if (!prev.edges.some((x) => JSON.stringify(x) === JSON.stringify(edge)) && edge.knownAt !== at) rows.push(`${short}: an edge to ${edge.to} appeared at ${at} dated ${edge.knownAt}`);
      }
      prev = g;
    }
    if (prev && JSON.stringify(prev) !== JSON.stringify(graph)) rows.push(`${short}: the graph at the last moment is not the graph with no moment`);
  }
  // A run left open at a session's end that a later stop line then ended.
  const ends = events.filter((e) => e.event === "session-end").map((e) => e.t);
  for (const n of alone.nodes) {
    if (n.kind !== "subagent") continue;
    for (const r of n.runs) if (r.from && r.to && ends.some((t) => t > r.from && t < r.to)) reopened += 1;
  }
}

console.log(`sessions with an events file: ${total.sessions} (${total.noFiles} with no files of the harness's found)`);
console.log(`subagents: ${total.harnessAgents} in the harness's files; the hook wrote a start line for ${total.hookStarted} ids and a typed stop for ${total.hookStopped}; ${total.matchedIds} matched by id`);
console.log(`runs: ${total.harnessRuns} in the harness's files; ${total.startLines} start lines, ${total.typedStops} typed stop lines; run count equal for ${total.runsEqual} of ${total.matchedIds} agents`);
console.log(`parent: the hook names one for ${total.parentBoth} (${total.spawnedLines} spawned lines); ${total.parentAgree} agree with the harness's files; ${total.nested} agents are nested`);
console.log(`type: ${total.typeAgree} of ${total.typeBoth} agree`);
console.log(`stop lines with no type from ids never seen starting: ${total.stopsNotDrawn}`);
console.log(`resumed edges drawn: ${total.resumedEdges}`);
console.log(`a start line after its run's first line: ${stats(startDelay)}`);
console.log(`a typed stop line after its run's last line: ${stats(stopDelay)}`);
console.log(`a parent known to the hook after the child started: ${stats(knownLate)}; later than 5 s for ${total.lateParents}`);
console.log(`differences by kind: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
console.log(`tool lines written before the child's own start line: ${total.toolFirst} of ${total.spawnedLines}, of which ${total.toolFirstNested} from inside a subagent`);
console.log(`session-end lines: ${total.sessionEnds} (session-start lines: ${total.sessionStarts}); runs with no stop on record when one came, or when the same agent began again: ${total.leftOpen}; runs open at a session's end that a later stop line ended: ${reopened}`);
console.log(`graphs stepped through: ${stepped}`);
console.log("");
for (const row of rows) console.log(row);
