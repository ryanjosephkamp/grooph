// The derivation rule (handoff 0016, criterion 2): the derived prompt holds every agent brief's
// text and none of the removed mechanics. Run with: node --test scripts/lib/compare-prompt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { MECHANICS, derive, filterBlock, filterSentences, gateSentence, iterationPrompt, leadSections, loopScript, loopSentence, readPackage, roundCap, saysDone, sentences } from "./compare-prompt.mjs";

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
  assert.ok(gateSentence(gate).endsWith("stop and report when you reach this point; do not merge."));
  assert.ok(prompt.includes(gateSentence(gate)));
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
  assert.ok(script.includes("Iteration $i of $N. Continue from the working tree as it is. Stop when your done check passes."));
  assert.ok(script.includes("prompt-B.md"));
});

test("the derivation is deterministic", () => {
  assert.equal(derive(readPackage(golden)).prompt, prompt);
  assert.ok(readFileSync(join(golden, ".grooph", "review-loop", "KICKOFF.md"), "utf8").includes("grooph"), "the source names grooph");
});
