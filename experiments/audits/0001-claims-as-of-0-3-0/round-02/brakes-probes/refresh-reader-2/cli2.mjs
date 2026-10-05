import { writeFileSync, readFileSync } from "node:fs";
import { box, say, ADD } from "./cli1.mjs";
import { newer, agent, canonicalize, tpl } from "./h2.mjs";

// 1. dry run leaves the file alone; a second --write is idempotent
{
  const b = box("dry");
  b.grooph(...ADD);
  b.put(newer((t) => { t.nodes[0].brief += " Keep it small."; t.loops[0].stops[1] = { kind: "max-iterations", n: 9 }; }));
  const h0 = b.hash();
  const r = b.grooph("sub", "update", "plan.grooph.json");
  console.log("1a dry run: exit", r.code, "| last line:", r.out.trim().split("\n").at(-1), "| file changed:", h0 !== b.hash());
  const w = b.grooph("sub", "update", "plan.grooph.json", "--write");
  const h1 = b.hash();
  console.log("1b --write: exit", w.code, "| last line:", w.out.trim().split("\n").at(-1), "| file changed:", h0 !== h1, "| from:", b.read().groups[0].from, "| cap:", JSON.stringify(b.read().loops[0].stops[1]));
  const w2 = b.grooph("sub", "update", "plan.grooph.json", "--write");
  console.log("1c --write again: exit", w2.code, "| last line:", w2.out.trim().split("\n").at(-1), "| file changed:", h1 !== b.hash());
  const w3 = b.grooph("sub", "update", "plan.grooph.json", "--write", "--allow", "loop:review-review.stops");
  console.log("1d --allow: exit", w3.code, "| last line:", w3.out.trim().split("\n").at(-1), "| cap:", JSON.stringify(b.read().loops[0].stops[1]));
  const w4 = b.grooph("sub", "update", "plan.grooph.json", "--write", "--allow", "loop:review-review.nope");
  console.log("1e --allow unknown: exit", w4.code, "|", (w4.err || w4.out).trim().split("\n").at(-1));
}

// 2. a note says an edge "is removed" where nothing is written
{
  const b = box("note");
  b.grooph(...ADD);
  const d = JSON.parse(readFileSync(b.file, "utf8"));
  d.edges.push({ id: "e-x", from: "review-critic", to: "nowhere" });
  writeFileSync(b.file, JSON.stringify(d, null, 2));
  const h0 = b.hash();
  const r = b.grooph("sub", "update", "plan.grooph.json", "--write");
  say("2 same version, the file has an edge to a missing node", r);
  console.log("file changed:", h0 !== b.hash(), "| e-x still there:", JSON.parse(readFileSync(b.file, "utf8")).edges.some((e) => e.id === "e-x"));
}

// 3. the partial result P2 through the CLI (cap leads on to an agent; the stops change is not among the held)
{
  const b = box("p2");
  const v1 = newer((t) => { t.nodes.push(agent("triage", "builder", "TRIAGE.md")); t.edges.push({ id: "e-triage-builder", from: "triage", to: "builder" }); }, 1);
  b.put(v1);
  b.grooph(...ADD);
  b.put(newer((t) => {
    const i = t.nodes.findIndex((n) => n.id === "triage");
    t.nodes[i] = { id: "triage", kind: "human-gate", name: "Triage", prompt: "The cap was hit. Go on?" };
    t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "triage" };
    t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
  }, 2, v1));
  say("3 update --write", b.grooph("sub", "update", "plan.grooph.json", "--write"));
  const d = b.read();
  console.log("triage is:", d.nodes.find((n) => n.id === "review-triage").kind, "| cap:", JSON.stringify(d.loops[0].stops[1]), "| errors:", b.errors());
}

// 4. an older version found (the project's newer copy is gone): any word that this goes backwards?
{
  const b = box("older");
  const v3 = newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 2 }; t.nodes[0].brief += " v3."; }, 3);
  b.put(v3);
  b.grooph(...ADD);
  const { rmSync } = await import("node:fs");
  rmSync(`${b.dir}/work/.grooph/templates/review-gate.grooph.json`);
  say("4 update --write from the built-in @1 after being placed from @3", b.grooph("sub", "update", "plan.grooph.json", "--write"));
  console.log("from:", b.read().groups[0].from);
}
