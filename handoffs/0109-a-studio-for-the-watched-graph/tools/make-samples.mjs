#!/usr/bin/env node
/**
 * Makes the two sample sessions the watching studio draws (slice 0109): `handoffs/briefs/studio-watching/samples.json`.
 *
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/make-samples.mjs <events folder> <projects folder>
 *
 * `<events folder>` is the main clone's `.grooph/events/`; `<projects folder>` is `~/.claude/projects`, of which only
 * the folders whose names begin `-Users-noir-Documents-grooph` are opened: this project's own, and no other's.
 *
 * The small session is the watched run the repository already holds (`experiments/watching/haiku/four/invited-1/`):
 * its hook lines, its digest (which model answered each transcript) and the harness's own count of how its four
 * subagents were started. Nothing outside the repository is read for it.
 *
 * The large session is one real session of this project, whole. A sample keeps its shape and nothing else.
 *
 *   Kept: how many subagents there were; for each, its type (only the harness's own types: any other stops the
 *   script), its depth, which subagent started it, background or foreground, the model its call named (the one word
 *   the harness keeps in the subagent's meta file, `opus` or `sonnet`: any other shape stops the script) and the
 *   model that answered, and each run's first and last time and how it ended; when the hook learned who started it;
 *   the session's own turns as the hook timed them; whether the hook has a start and a stop line for it; how many
 *   lines the hook wrote, and how many of them were stops with no type.
 *   Changed: every id is renumbered in the order of first start (`a01`, `a02`, …); every time is written as
 *   milliseconds from the session's first line, so no date and no clock time is in the file. The time between any
 *   two moments is as it was, and so the real times can be worked out by anyone who has one of them: `RECORDS.md`
 *   beside slice 0104 gives two. Whether that is to be shown is the owner's to say.
 *   Never read into a variable that is kept: a prompt, a reply, a tool's input or result (but for that one word), a
 *   path, a description (not its text and not its length), a worktree's name or branch, a tool-use id. The only text
 *   matched in a transcript line is a notification's `<task-id>` and `<status>`.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const out = join(root, "handoffs", "briefs", "studio-watching", "samples.json");

const [eventsDir, projectsDir] = process.argv.slice(2);
if (!eventsDir || !projectsDir) {
  console.error("usage: make-samples.mjs <events folder> <projects folder>");
  process.exit(1);
}
/** The one of this project's own folders that holds a session. No other project's folder is opened. */
function folderOf(session) {
  const own = readdirSync(projectsDir).filter((name) => name.startsWith("-Users-noir-Documents-grooph") && existsSync(join(projectsDir, name, `${session}.jsonl`)));
  if (own.length !== 1) throw new Error(`a session is in ${own.length} of this project's folders, not one`);
  return join(projectsDir, own[0]);
}

const TYPES = ["general-purpose", "claude-code-guide", "Plan", "Explore", "statusline-setup"];
const LARGE = "3e9d2b43-91b3-40a4-9859-23f9fc76c901";
const RESUMED = "10ff70fe-372f-49cb-b190-c2c5e2553725";
const lines = (path) => readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
const ms = (t) => Date.parse(t);

/** Ids in the order of first start, every time counted from the session's first line, and the sample in one shape. */
function sample({ id, name, from, agents, turns, ended, lead, record }) {
  const first = Math.min(from, ...agents.flatMap((a) => a.runs.map((r) => r.from)));
  const moved = (t) => (t === undefined || t === null ? null : t - first);
  const order = [...agents].sort((a, b) => a.runs[0].from - b.runs[0].from);
  const ids = new Map(order.map((a, k) => [a.id, `a${String(k + 1).padStart(2, "0")}`]));
  return {
    id,
    name,
    // Milliseconds from the session's first line: the page shows no clock time.
    ended: moved(ended),
    lead,
    turns: turns.map(([a, b]) => [moved(a), moved(b)]),
    agents: order.map((a) => ({
      id: ids.get(a.id),
      type: a.type,
      depth: a.depth,
      parent: a.parent ? (ids.get(a.parent) ?? null) : null,
      // When the hook learned who started it; null when it knew from the start (within a few seconds).
      parentKnown: a.parentKnown !== undefined && a.parentKnown - a.runs[0].from > 5000 ? moved(a.parentKnown) : null,
      shape: a.shape,
      // The word its call named for a model; null when it named none; "not read" when no file kept here says.
      asked: a.asked ?? null,
      model: a.model ?? null,
      runs: a.runs.map((r) => ({ from: moved(r.from), to: moved(r.to), end: r.end })),
      hook: a.hook,
    })),
    record,
  };
}

/* ── the small session: from the repository alone ─────────────────────────────────────────────────────────── */
function small() {
  const dir = join(root, "experiments/watching/haiku/four/invited-1");
  const events = lines(join(dir, "events", readdirSync(join(dir, "events"))[0]));
  const digest = JSON.parse(readFileSync(join(dir, "transcript-digest.json"), "utf8"));
  const stats = JSON.parse(readFileSync(join(dir, "claude-output.json"), "utf8")).subagent_stats;
  // The harness's own count: four spawned, all four started in the background, none by a subagent.
  if (stats.spawned !== 4 || stats.started_in_background !== 4 || stats.spawned_by_subagents !== 0 || stats.failed !== 0) throw new Error("the watched run is not what this script was written for");
  const agents = new Map();
  for (const e of events) {
    if (e.event === "subagent-start") agents.set(e.agent, { id: e.agent, type: e.type, depth: 1, shape: "background", asked: "not read", runs: [{ from: ms(e.t), to: null, end: "completed" }], hook: { start: true, stop: false } });
    if (e.event === "subagent-stop") Object.assign(agents.get(e.agent), { hook: { start: true, stop: true } }).runs[0].to = ms(e.t);
  }
  for (const a of agents.values()) {
    if (!TYPES.includes(a.type)) throw new Error("a subagent type that is not the harness's own");
    a.model = digest.find((d) => d.transcript === `agent-${a.id}.jsonl`)?.models[0];
  }
  const starts = events.filter((e) => e.event === "turn-start").map((e) => ms(e.t));
  const ends = events.filter((e) => e.event === "turn-end").map((e) => ms(e.t));
  return sample({
    id: "small",
    name: "Four at once",
    from: ms(events[0].t),
    ended: ms(events.at(-1).t),
    lead: digest.find((d) => d.who === "lead").models[0],
    turns: starts.map((t, k) => [t, ends[k]]),
    agents: [...agents.values()],
    record: { hookLines: events.length, untypedStops: 0 },
  });
}

/* ── the large session: its shape, from the harness's own files and the hook's lines ──────────────────────── */
function real(session, id, name) {
  const projectDir = folderOf(session);
  const dir = join(projectDir, session, "subagents");
  const agents = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".meta.json"))) {
    const id = file.slice("agent-".length, -".meta.json".length);
    const meta = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (!TYPES.includes(meta.agentType)) throw new Error("a subagent type that is not the harness's own");
    if (meta.model !== undefined && !/^[a-z][a-z0-9.-]{1,30}$/.test(meta.model)) throw new Error("a model named in a call is not one plain word");
    if (!["background", "foreground"].includes(meta.requestShape)) throw new Error("a subagent is neither background nor foreground");
    const a = { id, type: meta.agentType, depth: meta.spawnDepth ?? 1, parent: meta.parentAgentId, shape: meta.requestShape, asked: meta.model, runs: [], hook: { start: false, stop: false } };
    // A run is from one line of the transcript to the last before the next resume: only stamps and the model's name are read.
    let run = null;
    for (const line of lines(join(dir, `agent-${id}.jsonl`))) {
      const t = typeof line.timestamp === "string" ? ms(line.timestamp) : undefined;
      if (t === undefined) continue;
      if (run === null || (line.type === "user" && line.isMeta === true && line.origin?.kind === "coordinator")) a.runs.push((run = { from: t, to: t, end: "completed" }));
      run.to = Math.max(run.to, t);
      if (line.type === "assistant" && typeof line.message?.model === "string" && line.message.model !== "<synthetic>") a.model = line.message.model;
    }
    if (a.runs.length > 0) agents.set(id, a);
  }
  // How a background run ended: the notification the harness queues in the session's own transcript.
  const endings = new Map();
  let lead;
  let firstLine = Infinity;
  for (const line of lines(join(projectDir, `${session}.jsonl`))) {
    if (typeof line.timestamp === "string") firstLine = Math.min(firstLine, ms(line.timestamp));
    if (line.type === "assistant" && typeof line.message?.model === "string" && line.message.model !== "<synthetic>") lead = line.message.model;
    if (line.type !== "queue-operation" || line.operation !== "enqueue" || typeof line.content !== "string") continue;
    const id = /<task-id>(a[0-9a-f]{16})<\/task-id>/.exec(line.content)?.[1];
    const status = /<status>(completed|failed|killed)<\/status>/.exec(line.content)?.[1];
    if (id && status) endings.set(id, [...(endings.get(id) ?? []), { status, t: ms(line.timestamp) }]);
  }
  for (const a of agents.values()) for (const end of endings.get(a.id) ?? []) {
    // The run this notification closes: the last that began before it.
    const run = [...a.runs].reverse().find((r) => r.from <= end.t);
    if (run) run.end = end.status;
  }

  // The hook's lines: who it saw start and stop, when it learned a parent, the session's turns, and what it could not name.
  const events = lines(join(eventsDir, `${session}.jsonl`));
  let untypedStops = 0;
  for (const e of events) {
    // A tool line names the agent that called the tool and, as `spawned`, the one it started: that one is meant here.
    const a = agents.get(e.event === "tool" ? e.spawned : e.agent);
    if (e.event === "subagent-stop" && e.type === undefined) untypedStops += 1;
    if (!a) continue;
    if (e.event === "subagent-start") a.hook.start = true;
    if (e.event === "subagent-stop") a.hook.stop = true;
    if (e.event === "tool" && e.spawned !== undefined && a.parentKnown === undefined) a.parentKnown = ms(e.t);
  }
  const turns = [];
  let open = null;
  for (const e of events) {
    if (e.event === "turn-start" && e.agent === undefined) open = ms(e.t);
    if (e.event === "turn-end" && e.agent === undefined && open !== null) {
      turns.push([open, ms(e.t)]);
      open = null;
    }
  }
  const all = [...agents.values()];
  // The sample ends at the last thing it holds: the end of the last run, or of the last turn the hook timed. A hook
  // line later than both (the session opened again, and nothing started) is not drawn and is not counted.
  const last = Math.max(...turns.map(([, b]) => b), ...all.flatMap((a) => a.runs.map((r) => r.to)));
  return sample({
    id,
    name,
    from: Math.min(firstLine, ms(events[0].t), ...all.map((a) => a.runs[0].from)),
    ended: last,
    lead,
    turns,
    agents: all,
    record: { hookLines: events.length, untypedStops },
  });
}

const data = [small(), real(LARGE, "large", "Dozens over days"), real(RESUMED, "resumed", "Resumed often")];
const text = `[\n${data
  .map((s) => {
    const { agents, turns, ...head } = s;
    return `  {\n${Object.entries(head).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n    "turns": ${JSON.stringify(turns)},\n    "agents": [\n${agents.map((a) => `      ${JSON.stringify(a)}`).join(",\n")}\n    ]\n  }`;
  })
  .join(",\n")}\n]\n`;
writeFileSync(out, text);
for (const s of data) {
  const runs = s.agents.flatMap((a) => a.runs);
  console.log(`${s.id}: ${s.agents.length} subagents, ${runs.length} runs, ${s.turns.length} turns, ended ${(s.ended / 3600000).toFixed(2)} h; depth 2: ${s.agents.filter((a) => a.depth > 1).length}; foreground: ${s.agents.filter((a) => a.shape === "foreground").length}; failed: ${runs.filter((r) => r.end === "failed").length}; most runs of one agent: ${Math.max(...s.agents.map((a) => a.runs.length))}; parent known late: ${s.agents.filter((a) => a.parentKnown !== null).length}; no hook start: ${s.agents.filter((a) => !a.hook.start).length}; no hook stop: ${s.agents.filter((a) => !a.hook.stop).length}; models: ${[...new Set(s.agents.map((a) => a.model))].join(", ")}; lead ${s.lead}`);
}
