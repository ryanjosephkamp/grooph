#!/usr/bin/env node
// Round two, finding F1: are the built-in templates and the plan templates open to it?
// For every loop in patterns/ and plans/ this asks two things of the comparison adoption makes. No model is started.
//
//   node stops-in-built-ins-probe.mjs <repository root, built>
//
//   reordering   does the loop hold a limit that halts AHEAD of a limit that leads on? (Only then can a swap turn a
//                halt into going on.)
//   a new stop   for each kind of stop, leading on to each node of the graph in turn, put just ahead of the loop's
//                first halting limit: is the copy refused? Copies that do not validate are left out.
//
// Each template is first made a graph, as `grooph template use` would: its slots filled from their own examples, its
// template block taken off, a harness named. (A first version of this probe compared the templates as they are, and
// adoption refuses a template outright, so it reported nothing open for the wrong reason. It now counts every copy
// that adoption would not take for a reason other than a brake, and stops if there is one.)
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const core = await import(join(root, "packages/core/dist/src/index.js"));
console.log(`grooph ${JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version} at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);

const files = ["patterns", "plans"].flatMap((dir) => {
  try { return readdirSync(join(root, dir)).filter((f) => f.endsWith(".grooph.json")).sort().map((f) => [dir, f]); } catch { return []; }
});
const limit = (s) => ["budget", "max-iterations", "diminishing-returns", "evidence-invalid"].includes(s.kind);
const NEW = [
  { kind: "max-iterations", n: 1 }, { kind: "budget", measure: "dispatches", limit: 1 }, { kind: "budget", measure: "minutes", limit: 1 },
  { kind: "budget", measure: "usd", limit: 0.01 }, { kind: "budget", measure: "turns", limit: 1 }, { kind: "budget", measure: "tokens", limit: 1 },
  { kind: "diminishing-returns", rounds: 1 }, { kind: "evidence-invalid", rounds: 1 }, { kind: "human", every: 1 },
];
const name = (s) => `${s.kind}${s.measure ? ":" + s.measure : ""}`;
let loops = 0, docs = 0, tried = 0, invalid = 0, open = 0, haltAhead = 0, notCompared = 0, why;
const sorts = { "asks a person and goes on": 0, "leads to a human gate": 0, "leads where a stop of the loop already led": 0, "OTHER": 0 };
const lines = [];
for (const [dir, file] of files) {
  const template = JSON.parse(readFileSync(join(root, dir, file), "utf8"));
  let text = JSON.stringify({ ...template, template: undefined });
  for (const slot of template.template?.slots ?? []) text = text.split(`{{${slot.key}}}`).join(String(slot.example).replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
  const source = JSON.parse(text);
  source.target ??= { harness: "claude-code" };
  if (!source.goal) source.goal = "A goal, for the probe: two built-in templates are fragments and carry none.";
  const blocked = core.validate(source, { forExport: true }).filter((i) => i.severity === "error" && i.code !== "E_PERSON_STEP_NOT_COMPILED");
  if (blocked.length > 0) { console.log(`${dir}/${file}: filled from its examples it does not validate for export (${blocked.map((i) => i.code).join(", ")}); left out`); continue; }
  docs += 1;
  for (const [li, loop] of (source.loops ?? []).entries()) {
    loops += 1;
    const stops = loop.stops ?? [];
    const firstHalt = stops.findIndex((s) => limit(s) && !s.then);
    const leadsOnBehind = firstHalt >= 0 && stops.slice(firstHalt + 1).some((s) => limit(s) && s.then);
    if (leadsOnBehind) haltAhead += 1;
    const notRefused = [];
    if (firstHalt >= 0) {
      for (const add of NEW) for (const node of source.nodes) {
        const working = structuredClone(source);
        working.loops[li].stops.splice(firstHalt, 0, { ...add, then: node.id });
        if (core.validate(working).some((i) => i.severity === "error")) { invalid += 1; continue; }
        tried += 1;
        const adopted = core.adoptWorkingCopy(source, working, { run: "r1" });
        // A plan (a graph with a person's step) is not adopted at all, since no package is made of one: compare it directly.
        if (!adopted.ok && !/E_PERSON_STEP_NOT_COMPILED/.test(adopted.message ?? "")) { notCompared += 1; why ??= adopted.message; continue; }
        const check = core.checkAdoption(source, adopted.ok ? adopted.doc : working);
        if (check.refused.length === 0) {
          open += 1;
          const sort = add.kind === "human" ? "asks a person and goes on" : node.kind === "human-gate" ? "leads to a human gate" : stops.some((s) => s.then === node.id) ? "leads where a stop of the loop already led" : "OTHER";
          sorts[sort] += 1;
          notRefused.push(`${name(add)} then ${node.id}${check.changes.some((c) => c.tightens) ? " [called a tightening]" : ""}${sort === "OTHER" ? " <== OTHER" : ""}`);
        }
      }
    }
    const id = `${dir}/${file.replace(".grooph.json", "")} · ${loop.id}`;
    lines.push(`${id}: ${firstHalt < 0 ? "no halting limit" : notRefused.length === 0 ? "every new leading-on stop ahead of its first halting limit is refused" : "NOT REFUSED: " + notRefused.join("; ")}${leadsOnBehind ? "  [holds a halting limit ahead of one that leads on]" : ""}`);
  }
}
console.log(lines.join("\n"));
console.log(`\n${docs} documents, ${loops} loops. Loops that hold a halting limit ahead of one that leads on: ${haltAhead}.`);
console.log(`New leading-on stops tried: ${tried} (${invalid} more did not validate). Not refused: ${open}.`);
for (const [sort, count] of Object.entries(sorts)) console.log(`  ${String(count).padStart(4)}  ${sort}${sort === "OTHER" ? " (a new stop that leads on with nobody asked, to a place no stop of the loop led)" : ""}`);
if (notCompared > 0) { console.log(`NOT COMPARED: ${notCompared} copies that adoption would not take for another reason, so this run shows nothing about them. First: ${String(why).slice(0, 300)}`); process.exit(1); }
