import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "../../../../../../packages/core/dist/src/index.js";
import { root, host, errs } from "../refresh-reader-1/h.mjs";
const { parseGraphText, placeSubgrooph, reachedWithout } = core;
console.log("exports:", Object.keys(core).filter((k) => /reach|ways|decision|shut/i.test(k)));
for (const f of readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".grooph.json"))) {
  const t = parseGraphText(readFileSync(join(root, "patterns", f), "utf8")).doc;
  const vals = Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example ?? "x"]));
  const lead = t.nodes.find((n) => n.kind === "agent" && n.role === "lead");
  const gates = t.nodes.filter((n) => n.kind === "human-gate").map((n) => n.id);
  const appr = t.edges.filter((e) => e.approval).map((e) => e.id);
  const irr = t.nodes.filter((n) => (n.irreversible ?? []).length).map((n) => n.id);
  const thens = t.loops.flatMap((l) => l.stops.filter((s) => s.then).map((s) => `${l.id}:${s.kind}->${s.then}`));
  const human = t.loops.flatMap((l) => l.stops.filter((s) => s.kind === "human").map((s) => `${l.id}:human/${s.every ?? 1}`));
  const groups = (t.groups ?? []).map((g) => g.id);
  const merges = t.nodes.filter((n) => n.kind === "merge").map((n) => n.id);
  console.log(`${t.id} [${t.template.kind}] lead=${lead?.id ?? "-"} gates=${gates} approvals=${appr} irr=${irr} thens=${thens} human=${human} groups=${groups} merges=${merges} loops=${t.loops.length}`);
}
