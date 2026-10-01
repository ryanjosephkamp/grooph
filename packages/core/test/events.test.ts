/**
 * Session events (docs/subagents.md): the lines a hook wrote, read back into
 * sessions and subagents. Two of the fixtures are real recordings, one from
 * each harness.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { durationText, nodesLive, parseEvents, secondsBetween, sessionLine, summarizeSessions, type SessionEvent } from "../src/events.js";
import { parseGraphText } from "../src/parse.js";
import { fixturesDir, read } from "./helpers.js";

const fixture = (name: string): string => read(join(fixturesDir, "events", name));
const events = (name: string): SessionEvent[] => parseEvents(fixture(name)).events;

test("a real Claude Code session: three subagents, one started by another, all done, the session ended", () => {
  const parsed = parseEvents(fixture("claude-code-nested.jsonl"));
  assert.deepEqual(parsed.issues, []);
  const [s, ...rest] = summarizeSessions(parsed.events);
  assert.equal(rest.length, 0);
  assert.equal(s!.harness, "claude-code");
  assert.equal(s!.state, "ended");
  assert.equal(s!.cwd, "/work/demo");
  assert.deepEqual(s!.agents.map((a) => `${a.type}:${a.state}`), ["general-purpose:done", "general-purpose:done", "Explore:done"]);
  const explore = s!.agents.find((a) => a.type === "Explore")!;
  // The harness says which agent started which only in the spawn tool's result; the hook keeps that one fact.
  assert.equal(explore.parent, s!.agents[0]!.id);
  assert.equal(s!.agents[0]!.parent, undefined);
  assert.equal(explore.lastTool, "Read");
  assert.match(explore.transcript!, /subagents\/agent-.*\.jsonl$/);
  assert.equal(sessionLine(s!), "claude-code · ended · 0 running, 3 done");
});

test("a real Codex session: the same shape from the other harness, with the model on every line", () => {
  const [s] = summarizeSessions(events("codex-two-subagents.jsonl"));
  assert.equal(s!.harness, "codex");
  assert.equal(s!.state, "ended");
  assert.equal(s!.model, "gpt-6-luna");
  assert.deepEqual(s!.agents.map((a) => `${a.type}:${a.state}:${a.tools}:${a.lastTool}`), ["default:done:1:Bash", "default:done:1:Bash"]);
  assert.ok(s!.agents.every((a) => a.model === "gpt-6-luna" && a.parent === undefined));
  // The spawn and the wait are the main session's own tool calls.
  assert.equal(s!.tools, 4);
});

test("a session caught mid-run: one subagent done, one running, the session working", () => {
  const [s] = summarizeSessions(events("claude-code-running.jsonl"));
  assert.equal(s!.state, "working");
  assert.deepEqual(s!.agents.map((a) => `${a.type}:${a.state}`), ["review-loop--builder:done", "review-loop--critic:running"]);
  assert.equal(s!.agents[0]!.tools, 2);
  assert.equal(secondsBetween(s!.agents[0]!.started, s!.agents[0]!.ended!), 39);
  assert.equal(sessionLine(s!), "claude-code · working · 1 running, 1 done");
});

test("a graph's nodes as the hooks saw them: a subagent's type names its node", () => {
  const graph = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const sessions = summarizeSessions(events("claude-code-running.jsonl"));
  assert.deepEqual(nodesLive(sessions, graph), {
    builder: { running: 0, runs: 1, lastStarted: "2026-10-01T02:00:05.000Z", lastEnded: "2026-10-01T02:00:44.000Z" },
    critic: { running: 1, runs: 1, lastStarted: "2026-10-01T02:00:50.000Z" },
  });
  // Subagents from before the run began are another run's.
  assert.deepEqual(Object.keys(nodesLive(sessions, graph, "2026-10-01T02:00:45.000Z")), ["critic"]);
  // Another graph's subagents, and ones that are not a package's at all, light nothing.
  assert.deepEqual(nodesLive(summarizeSessions(events("claude-code-nested.jsonl")), graph), {});
});

test("several files merge into one list; a waiting session, a resumed subagent and a late-installed hook all read true", () => {
  const all = [...events("claude-code-nested.jsonl"), ...events("codex-two-subagents.jsonl")].sort((a, b) => (a.t < b.t ? -1 : 1));
  assert.deepEqual(summarizeSessions(all).map((s) => s.harness).sort(), ["claude-code", "codex"]);

  const e = (t: number, event: SessionEvent["event"], more: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t: new Date(Date.UTC(2026, 9, 1, 3, 0, t)).toISOString(), harness: "claude-code", event, session: "s1", ...more });
  // A reply ended and nothing is running: the session is waiting for its person, not working and not ended.
  assert.equal(summarizeSessions([e(0, "session-start"), e(1, "turn-start"), e(9, "turn-end")])[0]!.state, "waiting");
  // A subagent that works again after its stop was resumed, and is running until it stops again.
  const resumed = summarizeSessions([e(0, "subagent-start", { agent: "a", type: "builder" }), e(5, "subagent-stop", { agent: "a" }), e(9, "tool", { agent: "a", tool: "Edit" })])[0]!;
  assert.equal(resumed.agents[0]!.state, "running");
  assert.equal(resumed.state, "working");
  const twice = summarizeSessions([e(0, "subagent-start", { agent: "a", type: "builder" }), e(5, "subagent-stop", { agent: "a" }), e(9, "tool", { agent: "a", tool: "Edit" }), e(12, "subagent-stop", { agent: "a" })])[0]!;
  assert.deepEqual([twice.agents[0]!.state, twice.agents[0]!.stops], ["done", 2]);
  // The hook was installed after a subagent started: its stop still names it.
  const late = summarizeSessions([e(3, "subagent-stop", { agent: "z", type: "critic" })])[0]!;
  assert.deepEqual(late.agents.map((a) => `${a.type}:${a.state}`), ["critic:done"]);
  // The harness's own helper agents stop with no type and were never seen starting: they are not the session's subagents.
  assert.deepEqual(summarizeSessions([e(0, "session-start"), e(2, "subagent-stop", { agent: "internal" })])[0]!.agents, []);
  // A closed session whose subagent is still going is still working.
  assert.equal(summarizeSessions([e(0, "subagent-start", { agent: "a" }), e(1, "session-end")])[0]!.state, "working");
});

test("an events file is read line by line: a half-written or foreign line is an issue, never a throw", () => {
  const good = fixture("claude-code-running.jsonl").split("\n")[0]!;
  const parsed = parseEvents([good, "{ not json", '{"v":1,"t":"2026-10-01T02:00:00Z","event":"subagent-start"}', '{"v":9,"t":"x","session":"s","event":"tool"}', '{"v":1,"t":"2026-10-01T02:00:00Z","session":"s","event":"dance"}', "[]", good.slice(0, 40)].join("\n"));
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(parsed.issues.map((i) => `${i.line}:${i.message}`), ["2:not JSON", "3:no session id", "4:written by a newer grooph (events format 9)", '5:unknown event "dance"', "6:not an object", "7:not JSON"]);
  assert.deepEqual(parseEvents("").events, []);
  // Nothing an agent said or was told is ever a field: the type has no place to put it, and unknown keys are dropped on read.
  const sneaky = parseEvents('{"v":1,"t":"2026-10-01T02:00:00Z","harness":"codex","session":"s","event":"tool","tool":"Bash","tool_input":{"command":"cat secrets"},"prompt":"p","last_assistant_message":"m"}').events[0]!;
  assert.deepEqual(Object.keys(sneaky).sort(), ["event", "harness", "session", "t", "tool", "v"]);
});

test("durations read as a person says them", () => {
  assert.deepEqual([0, 8, 60, 200, 3600, 3900].map(durationText), ["0 s", "8 s", "1 min", "3 min 20 s", "1 h", "1 h 5 min"]);
});
