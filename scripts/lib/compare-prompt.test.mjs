// The derivation rule (handoff 0016, criterion 2): the derived prompt holds every agent brief's
// text and none of the removed mechanics. Run with: node --test scripts/lib/compare-prompt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { DESIGN_WORDS, GATE_SENTENCE, MECHANICS, derive, deriveD, filterBlock, filterSentences, gateSentence, iterationPrompt, leadSections, loopScript, loopSentence, readPackage, roundCap, saysDone, sentences } from "./compare-prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const golden = join(root, "fixtures", "golden", "claude-code", "review-loop");
const pkg = readPackage(golden);
const { prompt, report } = derive(pkg);

test("the prompt holds every agent brief, its inputs, outputs and capabilities", () => {
  for (const node of pkg.doc.nodes.filter((n) => n.kind === "agent")) {
    assert.ok(prompt.includes(node.brief), `brief of ${node.id}`);
    for (const input of node.inputs ?? []) assert.ok(prompt.includes(input), `input "${input}" of ${node.id}`);
    for (const output of node.outputs ?? []) assert.ok(prompt.includes(output), `output "${output}" of ${node.id}`);
    for (const cap of node.allow ?? []) assert.ok(prompt.includes(`\`${cap}\``), `capability ${cap} of ${node.id}`);
    assert.ok(prompt.includes(`role ${node.role}`), `role of ${node.id}`);
  }
  assert.match(prompt, /model opus, effort high/);
});

test("the prompt holds the goal verbatim and the sections the rule keeps", () => {
  assert.ok(prompt.includes(pkg.doc.goal.trim()));
  for (const heading of ["## You are the lead", "## Goal and constraints", "## Nodes", "## Edges", "## Loops", "## Human gates", "## Briefs"]) {
    assert.ok(prompt.includes(heading), heading);
  }
  const sections = leadSections(pkg.lead);
  for (const n of [3, 8, 9, 10, 11]) assert.ok(!prompt.includes(`## ${sections[n].heading}`), `§${n} ${sections[n].heading} is removed`);
  assert.deepEqual(report.sections_kept, [1, 2, 4, 5, 6, 7]);
});

test("none of the removed mechanics survive", () => {
  for (const needle of ["notes.jsonl", "PROGRESS.md", "grooph ", ".grooph/", "runs/", "MAPPING.md", "LEAD.md", ".claude/agents", "working copy", "amendment", "run id"]) {
    assert.ok(!prompt.includes(needle), `"${needle}" is still in the prompt`);
  }
  assert.ok(!prompt.includes(`${pkg.id}--`), "agent-file names become node ids");
  assert.deepEqual(report.mechanics_left, []);
  assert.ok(!MECHANICS.test(prompt.replace(/^## Goal[\s\S]*?(?=^## )/m, "")), "no mechanic outside the goal");
});

test("the loop is one sentence with the bar and every cap; the gate is the protocol's sentence", () => {
  const loop = pkg.doc.loops[0];
  const sentence = loopSentence(pkg.doc, loop);
  assert.equal(sentence.split(/(?<=\.)\s+(?=[A-Z])/).length, 1, "one sentence");
  assert.ok(sentence.includes(loop.bar.acceptance.replace(/\.$/, "")));
  for (const stop of loop.stops) {
    if (stop.kind === "max-iterations") assert.ok(sentence.includes(`at most ${stop.n} rounds`));
    if (stop.kind === "budget") assert.ok(sentence.includes(`at most ${stop.limit} ${stop.measure}`));
  }
  assert.ok(prompt.includes(sentence));
  const gate = pkg.doc.nodes.find((n) => n.kind === "human-gate");
  assert.equal(GATE_SENTENCE, "stop and report when you reach this point; do not proceed past it.", "protocol version 2's words (decision 0012)");
  assert.ok(gateSentence(gate).endsWith(GATE_SENTENCE));
  assert.ok(prompt.includes(gateSentence(gate)));
  assert.ok(!prompt.includes("do not merge"), "version 1's ending is gone");
});

test("a loop's other stops are said as the package says them: a check-in every n rounds, rounds that bring no improvement", () => {
  const doc = { nodes: [], edges: [{ id: "e-back", from: "critic", to: "owner" }] };
  const loop = { id: "polish", members: ["owner", "critic"], back: ["e-back"], bar: { acceptance: "No major gap." }, stops: [{ kind: "bar-passed" }, { kind: "diminishing-returns", rounds: 2, metric: "major gaps remaining" }, { kind: "human", every: 2 }, { kind: "max-iterations", n: 5 }, { kind: "budget", measure: "dispatches", limit: 16 }] };
  const sentence = loopSentence(doc, loop);
  assert.ok(sentence.includes("stop when 2 rounds in a row bring no improvement in major gaps remaining"), sentence);
  assert.ok(sentence.includes("stop and ask the human every 2 rounds"), sentence);
  assert.ok(sentence.includes("at most 5 rounds, at most 16 dispatches"), sentence);
  assert.ok(loopSentence(doc, { ...loop, stops: [{ kind: "diminishing-returns", rounds: 3 }] }).includes("stop when 3 rounds in a row add no progress"));
  assert.ok(loopSentence(doc, { ...loop, stops: [{ kind: "human", at: "merge-gate" }] }).includes("stop and ask at `merge-gate`"));
});

test("arm D's prompt is the task, the acceptance files by name and the test command, and nothing of the design", () => {
  const task = "Add `slugify(text)` in src/slug.mjs. Tests go in tests/slug.test.mjs.";
  const { prompt, report } = deriveD({ task, testCommand: "npm test", acceptance: ["README.md", "docs/REVIEW-CHECKLIST.md"], heldOutMarks: ["<held-out>", "/tmp/x.harness/held-out"] });
  assert.ok(prompt.startsWith(`# Task\n\n${task}\n`));
  assert.ok(prompt.includes("`README.md` and `docs/REVIEW-CHECKLIST.md` in this project say what the result must satisfy."));
  assert.ok(prompt.includes("# Test command\n\n`npm test`"));
  assert.deepEqual(report.design_words, []);
  assert.deepEqual(report.held_out_named, []);
  assert.deepEqual(report.mechanics_left, []);
  // None of what arms A, B and C are told: no role, no routing, no loop, no brief, no gate, no model.
  for (const word of ["builder", "critic", "subagent", "dispatch", "round", "loop", "brief", "gate", "model", "effort", "Iteration", "done: yes"]) assert.ok(!prompt.includes(word), word);
  assert.equal(deriveD({ task, testCommand: "npm test", acceptance: ["README.md", "docs/REVIEW-CHECKLIST.md"] }).prompt, prompt, "deterministic");
  // One file, and none.
  assert.ok(deriveD({ task, testCommand: "npm test", acceptance: ["STYLE.md"] }).prompt.includes("`STYLE.md` in this project says what the result must satisfy. Read it before you start."));
  assert.ok(deriveD({ task, testCommand: "npm test", acceptance: [] }).prompt.includes("The task above is all of it."));
  // What the runner refuses: a task text that carries the design, the held-out suite, or the tool.
  const leaky = deriveD({ task: "The builder adds it; the critic runs <held-out>/cases.test.mjs. Keep notes in the run folder.", testCommand: "npm test", acceptance: [], heldOutMarks: ["<held-out>"] }).report;
  assert.deepEqual(leaky.design_words, ["builder", "critic"]);
  assert.deepEqual(leaky.held_out_named, ["<held-out>"]);
  assert.ok(leaky.mechanics_left.length > 0);
  assert.ok("leading zeros, a reviewed page, briefly".match(DESIGN_WORDS) === null, "whole words only");
});

test("the sentence filter splits on sentence ends, not on file names, and drops what refers back", () => {
  assert.deepEqual(sentences("Read src/a.mjs first. Then run `npm test`. Done."), ["Read src/a.mjs first. ", "Then run `npm test`. ", "Done."]);
  assert.equal(filterSentences("Read `.grooph/x/LEAD.md` first and follow it. It is the brief for this run. Start at `builder`."), "Start at `builder`.");
  assert.equal(filterSentences("Write PROGRESS.md there. Never write the source document."), "");
  assert.equal(filterBlock("**Before you touch anything:**\n\n1. Read a run id from the clock.\n2. Write `PROGRESS.md`.\n3. Start at `builder`."), "**Before you touch anything:**\n\n1. Start at `builder`.");
  assert.equal(filterBlock("| a | b |\n|---|---|\n| `x` | copy the working copy |\n| `y` | fine |"), "| a | b |\n|---|---|\n| `y` | fine |");
  assert.equal(filterBlock("```json\n{}\n```"), "");
});

test("the goal paragraph passes as written even when it names a mechanic", () => {
  const out = filterBlock("**Goal.**\n\nKeep notes in NOTES.md and amend the plan as you go. Done when tests pass.\n\n**What this graph does.**\n\nA builder builds.");
  assert.ok(out.includes("Keep notes in NOTES.md and amend the plan as you go."));
});

test("arm C: N is the round cap, each iteration carries its number and the done line, and the reply's last line is read", () => {
  assert.equal(roundCap(pkg.doc), pkg.doc.loops[0].stops.find((s) => s.kind === "max-iterations").n);
  const it = iterationPrompt(prompt, 2, 4);
  assert.ok(it.startsWith(prompt.trimEnd()));
  assert.ok(it.includes("Iteration 2 of 4. Continue from the working tree as it is. Stop when your done check passes."));
  assert.ok(it.includes("`done: yes`"));
  assert.equal(saysDone("All good.\n\ndone: yes\n"), true);
  assert.equal(saysDone("All good.\n\n`done: yes`"), true);
  assert.equal(saysDone("done: yes\n\nbut wait, more to do"), false);
  assert.equal(saysDone("done: no"), false);
  assert.equal(saysDone(""), false);
  const script = loopScript({ project: "review-gate", n: 4, testCommand: "npm test" });
  assert.ok(script.includes("N=4"));
  assert.ok(script.includes("--model claude-opus-5-5 --effort high"), "the loop script names the lead's model of its project");
  assert.ok(loopScript({ project: "p", n: 2, testCommand: "npm test", model: "m-1", effort: "max" }).includes("--model m-1 --effort max"));
  assert.ok(script.includes("Iteration $i of $N. Continue from the working tree as it is. Stop when your done check passes."));
  assert.ok(script.includes("prompt-B.md"));
});

test("the derivation is deterministic", () => {
  assert.equal(derive(readPackage(golden)).prompt, prompt);
  assert.ok(readFileSync(join(golden, ".grooph", "review-loop", "KICKOFF.md"), "utf8").includes("grooph"), "the source names grooph");
});
