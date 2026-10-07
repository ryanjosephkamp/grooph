#!/usr/bin/env node
// Round three, finding F2 (Codex): the reason the comparison prints when "ask a person every 3 rounds" becomes "every 2"
// says "on round 3 nobody would be asked". This prints that reason beside the passes on which each version asks, by
// the rule in docs/graph-ir.md §2 (the first pass is round 0; a person asked every N is asked at the end of the Nth
// pass, the 2Nth, the 3Nth). No model is started.   node person-every-reason-probe.mjs <repository root, built>
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(process.argv[2] ?? ".");
const core = await import(join(root, "packages/core/dist/src/index.js"));
console.log(`grooph at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);
const graph = (every) => ({
  grooph: 0, id: "every", name: "Every", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
  nodes: [
    { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files", "write-outputs"] },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }],
  loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops: [{ kind: "human", every }, { kind: "budget", measure: "dispatches", limit: 4, then: "done" }] }],
});
const source = graph(3), copy = graph(2);
const adopted = core.adoptWorkingCopy(source, copy, { run: "r1" });
if (!adopted.ok) { console.log("adoption refused for another reason:", adopted.message); process.exit(1); }
const check = core.checkAdoption(source, adopted.doc);
for (const r of check.refused) console.log(`refused ${r.name}, and the reason printed:\n  ${r.loosens}`);
if (check.refused.length === 0) { console.log("NOT REFUSED: the change this probe is about was adopted, which is not what round three found."); process.exit(1); }
const said = check.refused.map((r) => String(r.loosens)).join(" ");
const names = /\bon round 3\b/.test(said) ? "round" : /\bpass 3\b|third pass/.test(said) ? "pass" : "neither";
console.log(names === "round" ? 'The reason says "on round 3".' : names === "pass" ? "The reason names the pass." : 'The reason says neither "on round 3" nor the pass: read it.');
const asks = (n) => [1, 2, 3, 4, 5, 6].filter((pass) => pass % n === 0);
console.log(`\nBy graph-ir §2, the source (every 3) asks at the end of pass ${asks(3).join(", ")}: that is round ${asks(3).map((p) => p - 1).join(", ")}, counting the first pass as round 0.`);
console.log(`The copy (every 2) asks at the end of pass ${asks(2).join(", ")}: round ${asks(2).map((p) => p - 1).join(", ")}.`);
console.log(`So the asking the copy loses is the one after pass 3, which is round 2. ${names === "round" ? '"On round 3" names it by its pass.' : names === "pass" ? "The reason counts as the rule does." : "Compare the reason with that."}`);
