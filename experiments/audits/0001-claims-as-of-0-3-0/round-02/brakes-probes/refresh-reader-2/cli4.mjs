// Do the holes found in the library go through `grooph sub update --write`?
import { box, ADD } from "./cli1.mjs";
import { newer, agent } from "./h2.mjs";
const go = (name, v1, versions, check) => {
  const b = box(name);
  if (v1) b.put(v1);
  const add = b.grooph(...ADD);
  let last;
  for (const v of versions) { b.put(v); last = b.grooph("sub", "update", "plan.grooph.json", "--write"); }
  const lines = last.out.trim().split("\n");
  console.log(`${name}: add exit ${add.code}; update exit ${last.code}; held back: ${lines.some((l) => l.includes("held back"))}; last line: ${lines.at(-1)}; errors in file: ${JSON.stringify(b.errors())}\n   ${check(b.read())}`);
};
go("critic-bypass", null, [newer((t) => { t.edges = t.edges.filter((x) => x.id !== "e-critic-pass"); t.edges.push({ id: "e-builder-merge-gate", from: "builder", to: "merge-gate" }); })], (d) => `into the gate: ${d.edges.filter((e) => e.to === "review-merge-gate").map((e) => e.from)}; out of the critic: ${d.edges.filter((e) => e.from === "review-critic").map((e) => `${e.when}->${e.to}`)}`);
go("critic-evidence", null, [newer((t) => { const e = t.edges.find((x) => x.id === "e-builder-critic"); e.id = "to-critic"; e.evidence = ["CHANGES.md"]; })], (d) => `critic is handed: ${JSON.stringify(d.edges.find((e) => e.to === "review-critic").evidence)}`);
const v2 = newer((t) => { t.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "halt" }); t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "halted" }; t.loops[0].stops[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "halted" }; }, 2);
const v3 = newer((t) => { const i = t.nodes.findIndex((n) => n.id === "halted"); t.nodes[i] = agent("halted", "builder", "RETRY.md", { name: "Try again" }); t.edges.push({ id: "e-halted-builder", from: "halted", to: "builder" }); }, 3, v2);
go("cap-target", null, [v2, v3], (d) => `stops: ${JSON.stringify(d.loops[0].stops)}; review-halted is a ${d.nodes.find((n) => n.id === "review-halted").kind} that leads to ${d.edges.filter((e) => e.from === "review-halted").map((e) => e.to)}`);
const t1 = newer((t) => { t.nodes.push(agent("tag", "builder", "TAG.md", { brief: "Tag the merged commit and push the tag." })); t.edges.find((e) => e.id === "e-merge-gate-done").to = "tag"; t.edges.push({ id: "e-tag-done", from: "tag", to: "done" }); }, 1);
const t2 = newer((t) => { t.nodes.find((n) => n.id === "tag").id = "tagger"; t.edges = t.edges.filter((e) => e.id !== "e-tag-done"); t.edges.find((e) => e.id === "e-merge-gate-done").to = "done"; t.edges.push({ id: "e-critic-tagger", from: "critic", to: "tagger", when: "pass" }); }, 2, t1);
go("step-renamed", t1, [t2], (d) => `nodes: ${d.nodes.map((n) => n.id).filter((id) => id.includes("tag"))}; into review-tagger: ${d.edges.filter((e) => e.to === "review-tagger").map((e) => e.from)}`);
go("critic-to-check", null, [newer((t) => { const i = t.nodes.findIndex((n) => n.id === "critic"); t.nodes[i] = { id: "critic", kind: "check", name: "Critic", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } }; })], (d) => `review-critic: ${JSON.stringify(d.nodes.find((n) => n.id === "review-critic"))}`);
