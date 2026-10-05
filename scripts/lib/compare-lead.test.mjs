import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { apiCalls, hookCalls, kindOfCall, kindOfUse, leadRows, onlyStarted, ORDER, RATES, tables, usd, written } from "./compare-lead.mjs";

const run = ".grooph/layer-settings/runs/20261004-211444";
const bash = (command) => ({ name: "Bash", input: { command } });
const file = (name, path, more = {}) => ({ name, input: { file_path: `/tmp/wk/x/settingskit/${path}`, ...more } });
const startedLine = '{"id":"n-0002","run":"r","at":"node:builder","started":"2026-10-04T21:15:14Z","outcome":"started","round":0}';
const endedLine = '{"id":"n-0003","run":"r","at":"node:builder","ended":"2026-10-04T21:16:15Z","outcome":"pass","round":0}';

test("a tool use is filed by what it was for", () => {
  const cases = [
    [{ name: "Agent", input: { subagent_type: "layer-settings--builder", prompt: "Round 0" } }, "dispatch"],
    [file("Read", ".grooph/layer-settings/LEAD.md"), "brief"],
    [file("Read", ".grooph/layer-settings/graph.grooph.json"), "brief"],
    [file("Read", ".claude/agents/layer-settings--critic.md"), "brief"],
    [file("Read", `${run}/graph.grooph.json`), "brief"],
    [bash("ls -la .grooph/layer-settings .claude/agents docs src tests"), "brief"],
    [bash("date -u +%Y%m%d-%H%M%S"), "run-folder"],
    [bash(`mkdir -p ${run}`), "run-folder"],
    [bash(`cp .grooph/layer-settings/graph.grooph.json ${run}/graph.grooph.json`), "run-folder"],
    [file("Edit", `${run}/graph.grooph.json`, { old_string: "a", new_string: "b" }), "amendment"],
    [file("Edit", ".claude/agents/layer-settings--builder.md", { old_string: "a", new_string: "b" }), "amendment"],
    [bash(`grooph validate --for-export ${run}/graph.grooph.json`), "amendment"],
    [bash("which grooph; date -u +%Y-%m-%dT%H:%M:%SZ"), "amendment"],
    [bash("date -u +%Y-%m-%dT%H:%M:%SZ"), "clock"],
    [file("Write", `${run}/PROGRESS.md`, { content: "# run" }), "progress"],
    [file("Write", `${run}/notes.jsonl`, { content: '{"id":"n-0001","run":"r","at":"graph","started":"2026-10-04T21:14:51Z","text":"run started"}' }), "note"],
    [file("Edit", `${run}/notes.jsonl`, { old_string: endedLine, new_string: `${endedLine}\n${startedLine}` }), "started-line"],
    [file("Edit", `${run}/notes.jsonl`, { old_string: startedLine, new_string: `${startedLine}\n${endedLine}` }), "note"],
    [bash(`printf '%s\\n' '${startedLine}' >> ${run}/notes.jsonl`), "started-line"],
    [bash(`printf '%s\\n' '${endedLine}' '${startedLine}' >> ${run}/notes.jsonl`), "note"],
    [bash(`cp REVIEW.md ${run}/REVIEW-round-0.md`), "report"],
    [bash(`cp REVIEW.md ${run}/REVIEW-round-0.md; date -u +%Y-%m-%dT%H:%M:%SZ`), "report"],
    [bash(`git diff > ${run}/diff-round-0.patch`), "check"],
    [bash(`npm test > ${run}/npm-test-round-0.txt 2>&1; echo "exit=$?"`), "check"],
    [bash(`printf '{\\"id\\":\\"n-0003\\",\\"at\\":\\"node:builder\\",\\"outcome\\":\\"started\\"}\\n' >> ${run}/notes.jsonl`), "started-line"],
    [bash("git status --porcelain"), "check"],
    [bash("npm test"), "check"],
    [file("Read", "REVIEW.md"), "check"],
    [file("Write", "src/layer.mjs", { content: "export {}" }), "other"],
  ];
  for (const [use, kind] of cases) assert.equal(kindOfUse(use), kind, JSON.stringify(use.input).slice(0, 90));
});

test("only a write whose every new line is a started line is one a hook could write whole", () => {
  assert.equal(onlyStarted(startedLine), true);
  assert.equal(onlyStarted(`${startedLine}\n${startedLine.replace("n-0002", "n-0004")}`), true);
  assert.equal(onlyStarted(`${startedLine}\n${endedLine}`), false);
  assert.equal(onlyStarted(endedLine), false);
  assert.equal(onlyStarted("no note here"), false);
});

test("a call is filed once, a clock read or a started line only when it did nothing else", () => {
  assert.equal(kindOfCall(["clock", "report"], false), "report");
  assert.equal(kindOfCall(["started-line", "dispatch"], false), "dispatch");
  assert.equal(kindOfCall(["progress", "note"], false), "note");
  assert.equal(kindOfCall(["run-folder", "brief"], false), "brief");
  assert.equal(kindOfCall(["clock", "started-line"], false), "started-line");
  assert.equal(kindOfCall(["clock"], false), "clock");
  assert.equal(kindOfCall([], true), "reply");
  assert.equal(kindOfCall([], false), "text");
  assert.deepEqual(ORDER.slice(-2), ["started-line", "clock"]);
});

test("what a use sent is counted by size and never kept", () => {
  assert.equal(written({ input: { command: "date", description: "clock" } }), 9);
  assert.equal(written({ input: { file_path: "a", content: "bcd" } }), 4);
  assert.equal(written({ input: {} }), 0);
});

const call = (tokens, uses = []) => ({ model: "claude-opus-5-5", tokens: { input: 2, cache_read: 0, cache_write_1h: 0, cache_write_5m: 0, output: 0, ...tokens }, uses, text: false });

test("the lead's rows charge what a call added to the context to that call, and add up to the session", () => {
  const calls = [
    call({ cache_read: 16000, cache_write_1h: 5000, output: 200 }, [file("Read", ".grooph/layer-settings/LEAD.md")]),
    call({ cache_read: 21000, cache_write_1h: 12000, output: 100 }, [bash("date -u +%Y-%m-%dT%H:%M:%SZ")]),
    call({ cache_read: 33000, cache_write_1h: 300, output: 700 }, [{ name: "Agent", input: { prompt: "Round 0" } }]),
    call({ cache_read: 33300, cache_write_1h: 2000, output: 400 }, [file("Edit", `${run}/notes.jsonl`, { old_string: startedLine, new_string: `${startedLine}\n${endedLine}` })]),
    call({ cache_read: 35300, cache_write_1h: 600, output: 800 }),
  ];
  const rows = leadRows(calls);
  assert.deepEqual(rows.map((row) => row.kind), ["prompt", "brief", "clock", "dispatch", "note", "reply"]);
  assert.deepEqual(rows.map((row) => row.phase), ["setup", "setup", "setup", "cycle 1", "cycle 1", "reply"]);
  assert.equal(rows[0].tokens.added, 5000, "the first call's cache write is the prompt as given");
  assert.equal(rows[1].tokens.added, 12000, "the brief is charged the write the next call made of it");
  assert.equal(rows[3].tokens.added, 2000, "a dispatch is charged its subagent's reply");
  assert.equal(rows[5].tokens.added, 0, "nothing follows the reply");
  assert.equal(rows[2].context, 2 + 21000 + 12000);
  assert.equal(rows[1].read_back_later.tokens, 12000 * 3, "what the brief added is read back by the three calls after the one that wrote it");
  assert.equal(rows[0].read_back_later.tokens, 5000 * 4, "the prompt is read back by every call but the first");
  assert.equal(rows[5].read_back_later.tokens, 0);
  const readBack = rows.reduce((sum, row) => sum + row.read_back_later.tokens, 0) + calls.length * calls[0].tokens.cache_read;
  assert.equal(readBack, calls.reduce((sum, c) => sum + c.tokens.cache_read, 0), "by origin, the read-back is the same tokens");
  const session = calls.reduce((sum, c) => sum + Object.values(usd(c.tokens, RATES[c.model])).reduce((a, b) => a + b, 0), 0);
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.usd.total, 0) - session) < 1e-5);
  assert.deepEqual(hookCalls({ rows }).map((row) => row.n), [2]);
});

test("records of one request are one call, with the largest count each record gave", () => {
  const dir = mkdtempSync(join(tmpdir(), "lead-"));
  try {
    const record = (id, content, usage) => JSON.stringify({ type: "assistant", message: { id, model: "claude-opus-5-5", content, usage } });
    const usage = (output) => ({ input_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: 40, cache_creation: { ephemeral_1h_input_tokens: 40, ephemeral_5m_input_tokens: 0 }, output_tokens: output });
    const lines = [
      JSON.stringify({ type: "user", message: { content: "go" } }),
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "refused" }] } }),
      record("m1", [{ type: "text", text: "first" }], usage(5)),
      record("m1", [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "date" } }], usage(60)),
      record("m2", [{ type: "tool_use", id: "t2", name: "Read", input: { file_path: "/x" } }], usage(30)),
      JSON.stringify({ type: "assistant", message: { id: "m3", model: "<synthetic>", content: [], usage: usage(1) } }),
      "not json",
    ];
    writeFileSync(join(dir, "t.jsonl"), lines.join("\n"), "utf8");
    const calls = apiCalls(join(dir, "t.jsonl"));
    assert.equal(calls.length, 2);
    assert.equal(calls[0].tokens.output, 60);
    assert.deepEqual(calls[0].uses.map((use) => use.name), ["Bash"]);
    assert.equal(calls[0].uses[0].refused, true);
    assert.equal(calls[1].uses[0].refused, false);
    assert.equal(calls[0].text, true);
    assert.equal(calls[1].tokens.cache_write_1h, 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const derived = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "experiments", "comparisons", "derived");

test("the kept numbers hold counts and kinds and nothing a session said", { skip: !existsSync(join(derived, "lead-cost.json")) }, () => {
  const data = JSON.parse(readFileSync(join(derived, "lead-cost.json"), "utf8"));
  assert.equal(data.runs.length, 12);
  for (const kept of data.runs) {
    assert.equal(kept.rates_give_the_reported_cost_back, true, kept.run);
    for (const row of kept.rows) {
      assert.deepEqual(Object.keys(row).sort(), ["characters_sent", "context", "kind", "n", "phase", "read_back_later", "refused", "tokens", "tools", "usd", "uses"]);
      for (const kind of row.uses) assert.ok([...ORDER, "other"].includes(kind), kind);
      for (const tool of row.tools) assert.match(tool, /^[A-Za-z]+$/);
    }
    const byOrigin = Object.values(kept.read_back_by_origin).reduce((sum, cell) => sum + cell.tokens, 0);
    assert.equal(byOrigin, kept.rows.reduce((sum, row) => sum + row.tokens.read, 0), `${kept.run}: by origin, the read-back is the same tokens`);
    const lead = kept.rows.reduce((sum, row) => sum + row.usd.total, 0);
    assert.ok(Math.abs(lead - kept.lead.usd.total) < 1e-4, kept.run);
    assert.ok(Math.abs(lead + kept.subagents.usd - kept.reported_usd) < 0.005, `${kept.run}: the lead and the subagents make the reported cost`);
  }
});

test("the page's tables are the ones the kept numbers give", { skip: !existsSync(join(derived, "lead-cost.md")) }, () => {
  const page = readFileSync(join(derived, "lead-cost.md"), "utf8");
  const held = page.slice(page.indexOf("-->", page.indexOf("<!-- tables:")) + 3, page.indexOf("<!-- end of tables -->")).trim();
  assert.equal(held, tables(JSON.parse(readFileSync(join(derived, "lead-cost.json"), "utf8"))));
});
