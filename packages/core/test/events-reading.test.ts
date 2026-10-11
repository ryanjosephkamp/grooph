/**
 * Three things in the reading of the hook's lines that slice 0104 put right or put a number to (`src/events.ts`,
 * `summarizeSessions`). Two were seen in this project's own records and one was read in the code
 * (`handoffs/0104-the-live-graph/RECORDS.md` §2 and §5). Each test fails without its change.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { isQuiet, mapLive, parseEvents, planLine, sessionLine, summarizeSessions, type SessionEvent } from "../src/events.js";
import { seenGraph } from "../src/seen.js";
import type { OperationMap } from "../src/types.js";
import { fixturesDir, read } from "./helpers.js";

const T0 = Date.parse("2026-02-01T10:00:00.000Z");
const t = (seconds: number): string => new Date(T0 + seconds * 1000).toISOString();
const line = (seconds: number, event: SessionEvent["event"], extra: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t: t(seconds), harness: "claude-code", event, session: "s1", ...extra });

test("a subagent whose run left no stop line is not running for ever: its session's end says it was not seen to finish", () => {
  // The shape of the one failed run in the records: a start, the tool's line, and never a stop. The harness fires
  // no stop hook for a run that fails. The session goes on, and closes hours later.
  const lines = [
    line(0, "session-start"),
    line(1, "turn-start"),
    line(2, "subagent-start", { agent: "a-ok", type: "general-purpose" }),
    line(2, "tool", { tool: "Agent", spawned: "a-ok" }),
    line(3, "subagent-start", { agent: "a-failed", type: "general-purpose" }),
    line(3, "tool", { tool: "Agent", spawned: "a-failed" }),
    line(4, "turn-end"),
    line(60, "subagent-stop", { agent: "a-ok", type: "general-purpose" }),
    line(61, "turn-start"),
    line(70, "turn-end"),
  ];
  // While the session is open the hook's lines cannot tell a run that failed from one still going.
  const [open] = summarizeSessions(lines);
  assert.deepEqual([open!.state, open!.agents.map((a) => a.state)], ["working", ["done", "running"]]);
  assert.equal(sessionLine(open!), "claude-code · working · 1 running, 1 done");

  const [ended] = summarizeSessions([...lines, line(5 * 3600, "session-end")]);
  // Before: the session read `working` for good, and the subagent `running`.
  assert.equal(ended!.state, "ended");
  assert.deepEqual(ended!.agents.map((a) => [a.id, a.state, a.ended]), [["a-ok", "done", t(60)], ["a-failed", "not-seen-to-finish", undefined]]);
  assert.equal(sessionLine(ended!), "claude-code · ended · 0 running, 1 done, 1 not seen to finish");
  // A session that ended is never "last seen", however long ago, and its line says the same a day on.
  assert.equal(isQuiet(ended!, t(30 * 3600)), false);
  assert.equal(sessionLine(ended!, t(30 * 3600)), "claude-code · ended · 0 running, 1 done, 1 not seen to finish");

  // Opened again (the same id starts again), the subagent of the session that closed is still not running.
  const [again] = summarizeSessions([...lines, line(5 * 3600, "session-end"), line(6 * 3600, "session-start"), line(6 * 3600 + 1, "turn-start"), line(6 * 3600 + 9, "turn-end")]);
  assert.deepEqual([again!.state, again!.agents[1]!.state], ["waiting", "not-seen-to-finish"]);
  assert.equal(sessionLine(again!), "claude-code · waiting · 0 running, 1 done, 1 not seen to finish");
  // Gone quiet, it is counted with the others that have no stop on record.
  const [quiet] = summarizeSessions([...lines, line(5 * 3600, "session-end"), line(6 * 3600, "session-start"), line(6 * 3600 + 1, "turn-start"), line(6 * 3600 + 2, "subagent-start", { agent: "a-new", type: "Explore" })]);
  assert.equal(sessionLine(quiet!, t(9 * 3600 + 2)), "claude-code · last seen 3 h ago, working then · 2 not seen to finish, 1 done");

  // A stop that is written after the session's end still ends the run; and work seen from it means it is running.
  const [late] = summarizeSessions([...lines, line(5 * 3600, "session-end"), line(5 * 3600 + 0.2, "subagent-stop", { agent: "a-failed", type: "general-purpose" })]);
  assert.deepEqual([late!.state, late!.agents[1]!.state, late!.agents[1]!.stops], ["ended", "done", 1]);
  const [alive] = summarizeSessions([...lines, line(5 * 3600, "session-end"), line(5 * 3600 + 5, "tool", { agent: "a-failed", type: "general-purpose", tool: "Read" })]);
  assert.deepEqual([alive!.state, alive!.agents[1]!.state], ["working", "running"]);
  // A session's start while a subagent runs (the harness fires one when it compacts) ends nothing.
  const [compacted] = summarizeSessions([...lines, line(100, "session-start")]);
  assert.equal(compacted!.agents[1]!.state, "running");

  // It is not counted as running or as done anywhere: not against a plan, and not on an operation map.
  const [planned] = summarizeSessions([line(0, "session-start"), line(1, "plan", { agents: [{ type: "general-purpose", count: 2 }] }), ...lines.slice(1), line(5 * 3600, "session-end")]);
  assert.equal(planLine(planned!.plans![0]!), "2 of 2 started");
  const map = { id: "m", name: "m", sessions: [{ id: "lane" }] } as unknown as OperationMap;
  const onMap = mapLive(summarizeSessions([...lines, line(5 * 3600, "session-end")].map((e) => ({ ...e, source: "lane" }))), map, t(6 * 3600));
  assert.deepEqual([onMap["lane"]!.ended, onMap["lane"]!.agentsRunning, onMap["lane"]!.agentsDone], [1, 0, 1]);
});

test("the failed run, as the fixture cut from the real record holds it: running while the lines go on, not seen to finish once the session ends", () => {
  const events = parseEvents(read(join(fixturesDir, "seen", "failed", "events.jsonl"))).events;
  const [open] = summarizeSessions(events);
  assert.deepEqual([open!.state, open!.agents.map((a) => a.state)], ["working", ["running"]]);
  const last = Date.parse(events[events.length - 1]!.t);
  // In the real record the session's end came 4 h 43 min after these lines.
  const end: SessionEvent = { v: 1, t: new Date(last + 16_966_375).toISOString(), harness: "claude-code", event: "session-end", session: events[0]!.session };
  const [ended] = summarizeSessions([...events, end]);
  assert.deepEqual([ended!.state, ended!.agents.map((a) => a.state)], ["ended", ["not-seen-to-finish"]]);
  assert.equal(sessionLine(ended!, new Date(last + 86_400_000).toISOString()), "claude-code · ended · 0 running, 0 done, 1 not seen to finish");
});

test("a child first met through its parent's tool line takes its own type when its start line comes, not its parent's", () => {
  const lines = [
    line(0, "turn-start"),
    line(1, "subagent-start", { agent: "parent", type: "general-purpose" }),
    line(1, "tool", { tool: "Agent", spawned: "parent" }),
    // The hooks run in the background, so the tool's line can be written before the child's own start line: in the
    // records 5 of 127 were, though none of those was from inside a subagent. This line is the parent's, and so is the
    // type on it.
    line(5, "tool", { agent: "parent", type: "general-purpose", tool: "Agent", spawned: "child" }),
    line(5.01, "subagent-start", { agent: "child", type: "Explore" }),
  ];
  const [met] = summarizeSessions(lines.slice(0, 4));
  // Before its own line it has no type of its own; before the change it read `general-purpose`, for good.
  assert.deepEqual(met!.agents.map((a) => [a.id, a.type, a.parent]), [["parent", "general-purpose", undefined], ["child", "subagent", "parent"]]);
  const [s] = summarizeSessions(lines);
  assert.deepEqual(s!.agents.map((a) => [a.id, a.type, a.parent, a.state]), [["parent", "general-purpose", undefined, "running"], ["child", "Explore", "parent", "running"]]);
  // Nor does the child take a model from its parent's line (Codex puts one on most lines).
  const [codexLike] = summarizeSessions([line(0, "turn-start"), line(1, "tool", { agent: "parent", type: "worker", model: "m-large", tool: "spawn", spawned: "child" }), line(2, "subagent-start", { agent: "child", type: "explorer" })]);
  assert.deepEqual(codexLike!.agents.map((a) => [a.id, a.type, a.model]), [["parent", "worker", "m-large"], ["child", "explorer", undefined]]);
  // The parent's tool call is still counted as the parent's.
  assert.equal(s!.agents[0]!.tools, 1);
});

test("stop lines with no type from ids never seen starting stay undrawn, and are counted; a stop that names its type is still named", () => {
  const lines = [
    line(0, "turn-start"),
    line(5, "turn-end"),
    // The harness's own helpers: it reports their stops with an empty type, a few seconds after a turn's end.
    line(7, "subagent-stop", { agent: "helper-1" }),
    line(20, "turn-start"),
    line(25, "turn-end"),
    line(27, "subagent-stop", { agent: "helper-2" }),
    // An agent from before the hook was installed: its stop names its type, and it is drawn.
    line(30, "subagent-stop", { agent: "early", type: "Plan" }),
  ];
  const [s] = summarizeSessions(lines);
  assert.deepEqual(s!.agents.map((a) => [a.id, a.type, a.state]), [["early", "Plan", "done"]]);
  // The list has no place for the number; the graph of the same lines says how many there were.
  const g = seenGraph(lines);
  assert.equal(g.record.hook.stopsNotDrawn, 2);
  assert.deepEqual(g.nodes.slice(1).map((n) => n.id), ["early"]);
});
