#!/usr/bin/env node
// Round two, finding F9 (Codex): when does the validator warn about a loop's length (W_LONG_LOOP_NO_BUDGET)?
// No model is started.   node capless-loop-probe.mjs <repository root, built>
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(process.argv[2] ?? ".");
const core = await import(join(root, "packages/core/dist/src/index.js"));
console.log(`validator at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);
const graph = (stops) => ({
  grooph: 0, id: "capless", name: "Capless", version: 1, goal: "Make the test pass. Done when it passes.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "pnpm test", pass: "exit 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e1", from: "builder", to: "tests" }, { id: "e2", from: "tests", to: "builder", when: "fail" }, { id: "e3", from: "tests", to: "done", when: "pass" }],
  loops: [{ id: "work", name: "Work", members: ["builder", "tests"], back: ["e2"], mode: "grind", stops }],
});
const cases = [
  ["a cap of 4, no budget", [{ kind: "max-iterations", n: 4 }]],
  ["a cap of 5, no budget", [{ kind: "max-iterations", n: 5 }]],
  ["a cap of 6, no budget", [{ kind: "max-iterations", n: 6 }]],
  ["no cap, no budget (the check passing is the only stop)", [{ kind: "check-passed" }]],
  ["no cap, a budget of 10 dispatches", [{ kind: "budget", measure: "dispatches", limit: 10 }]],
  ["no cap, a budget of 100000 dispatches", [{ kind: "budget", measure: "dispatches", limit: 100000 }]],
  ["a cap of 50, a budget of 100000 dispatches", [{ kind: "max-iterations", n: 50 }, { kind: "budget", measure: "dispatches", limit: 100000 }]],
];
for (const [label, stops] of cases) {
  const issues = core.validate(graph(stops), { forExport: true });
  const codes = issues.map((i) => i.code);
  console.log(`${label.padEnd(58)} ${codes.includes("W_LONG_LOOP_NO_BUDGET") ? "WARNS  W_LONG_LOOP_NO_BUDGET" : "no warning about its length"}${codes.filter((c) => c !== "W_LONG_LOOP_NO_BUDGET").length ? "  (also " + codes.filter((c) => c !== "W_LONG_LOOP_NO_BUDGET").join(", ") + ")" : ""}`);
}
