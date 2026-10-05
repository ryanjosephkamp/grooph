/**
 * Fuzzer for `adoptWorkingCopy` + `checkAdoption` with no --allow.
 *   node R/probe/fuzz/fuzz.mjs [seed=1] [trials=4000] [--show N]
 *
 * Each trial: a starting graph (fixtures/valid and the built-in patterns, instantiated with their example values),
 * decorated at random with brakes it lacks (an approval, an irreversible marker behind a person, a human stop, a
 * level), then ONE mutation that loosens a listed brake by construction, plus 0-2 changes that are harmless or
 * tighten something (to hide it). The working copy must pass validate(forExport) (adoptWorkingCopy says so);
 * otherwise the trial is not counted. "Through" = `refused` is empty.
 *
 * Oracle: construction, plus two checks of my own in ./oracle.mjs (worst-case dispatches; person-free reach
 * between pairs). Nothing here imports brakes.ts or reach.ts.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { R, SCRATCH, core, clone, errorsOf } from "../lib.mjs";
import { roundsLoosened, personLoosened } from "./oracle.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const seed = Number(args[0] ?? 1), trials = Number(args[1] ?? 4000);
const showN = process.argv.includes("--show") ? Number(process.argv[process.argv.indexOf("--show") + 1]) : 2;
let s = seed >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ---- starting graphs
const pool = [];
for (const dir of ["fixtures/valid", "patterns", "fixtures/composed"]) {
  for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
    const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8"));
    if (!parsed.doc) continue;
    let d = parsed.doc;
    if (d.template) { try { const out = core.instantiate(d, { name: d.name, values: Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example])) }); d = out.doc ?? out; } catch { continue; } }
    if (errorsOf(d).length === 0) pool.push({ file: `${dir}/${f}`, doc: d });
  }
}

// ---- helpers
const isCritic = (n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role);
const ids = (d) => new Set([d.id, ...d.nodes.map((n) => n.id), ...d.edges.map((e) => e.id), ...d.loops.map((l) => l.id), ...(d.policies ?? []).map((p) => p.id), ...(d.groups ?? []).map((g) => g.id)]);
const fresh = (d, stem) => { const used = ids(d); let i = 0; let id = stem; while (used.has(id)) id = `${stem}-${++i}`; return id; };
const newAgent = (d, stem, extra = {}) => { const id = fresh(d, stem); const n = { id, kind: "agent", name: id, role: "tester", brief: `${id}: do the step and write what you did.`, outputs: [`${id}.md`], allow: ["read-files", "write-outputs"], ...extra }; d.nodes.push(n); return n; };
const newEdge = (d, from, to, extra = {}) => { const e = { id: fresh(d, `e-${from}-${to}`.slice(0, 40).replace(/-+$/, "")), from, to, ...extra }; d.edges.push(e); return e; };
const allBack = (d) => new Set(d.loops.flatMap((l) => l.back));
const plainBar = () => ({ name: "Bar", inspects: [{ kind: "file", ref: "REVIEW.md" }], acceptance: "The review file lists no open finding." });
const brakeStop = (st) => st.kind === "max-iterations" || st.kind === "budget" || st.kind === "human";
const passesHuman = (d, e) => e.approval === true || d.nodes.find((n) => n.id === e.from)?.kind === "human-gate";
const renameNode = (d, from, to) => {
  for (const n of d.nodes) if (n.id === from) n.id = to;
  for (const e of d.edges) { if (e.from === from) e.from = to; if (e.to === from) e.to = to; }
  for (const l of d.loops) { l.members = l.members.map((m) => (m === from ? to : m)); for (const st of l.stops) if (st.then === from) st.then = to; if (l.bar?.answerKeyFrom === from) l.bar.answerKeyFrom = to; }
  for (const g of d.groups ?? []) g.members = g.members.map((m) => (m === from ? to : m));
  for (const p of d.policies ?? []) if (p.scope === `node:${from}`) p.scope = `node:${to}`;
  if (d.layout?.[from]) { d.layout[to] = d.layout[from]; delete d.layout[from]; }
};

// ---- decorations of the source (so that it has the brake to lose)
function decorate(d) {
  if (chance(0.5)) { const e = pick(d.edges.filter((e) => !e.approval)); if (e) e.approval = true; }
  if (chance(0.3)) { const e = pick(d.edges.filter((e) => allBack(d).has(e.id) && !e.approval)); if (e) e.approval = true; }
  if (chance(0.45)) {
    const led = new Set(d.loops.flatMap((l) => l.stops.filter((st) => st.then !== undefined && st.kind !== "human").map((st) => st.then)));
    const n = pick(d.nodes.filter((n) => n.kind === "agent" && n.role !== "lead" && !(n.irreversible ?? []).length && !led.has(n.id) && d.edges.some((e) => e.to === n.id)));
    if (n) { n.irreversible = chance(0.5) ? ["publish"] : ["merge", "publish"]; for (const e of d.edges) if (e.to === n.id && !passesHuman(d, e)) e.approval = true; }
  }
  if (chance(0.4) && d.loops.length) { const l = pick(d.loops); if (!l.stops.some((st) => st.kind === "human")) l.stops.push({ kind: "human", every: int(1, 3) }); }
  if (chance(0.5) && d.loops.length) { const l = pick(d.loops); if (!l.stops.some((st) => st.kind === "max-iterations")) l.stops.push({ kind: "max-iterations", n: int(2, 6) }); if (!l.stops.some((st) => st.kind === "budget")) l.stops.push({ kind: "budget", measure: "dispatches", limit: int(6, 20) }); }
  if (chance(0.25)) { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" && st.then === undefined && st.n >= 3) && !l.stops.some((st) => st.kind === "max-iterations" && st.then !== undefined))); if (l) { const halt = l.stops.find((st) => st.kind === "max-iterations"); const w = newAgent(d, "wrap-up"); l.stops.splice(l.stops.indexOf(halt), 0, { kind: "max-iterations", n: halt.n - 1, then: w.id }); } }
  if (chance(0.35)) d.adaptation = pick(["fixed", "propose"]);
  if (chance(0.2)) (d.policies ??= []).push({ id: fresh(d, "p-no-live"), kind: "no-live-graph-rewrite", scope: "graph" });
}

// ---- mutations: each loosens one listed brake by construction; returns a note, or undefined when it does not apply
const withStop = (d, kind) => d.loops.filter((l) => l.stops.some((st) => st.kind === kind));
const M = {
  // round caps and budgets
  "cap: raised": (d) => { const l = pick(withStop(d, "max-iterations")); if (!l) return; for (const st of l.stops) if (st.kind === "max-iterations") st.n += int(1, 60); return l.id; },
  "budget: raised": (d) => { const l = pick(withStop(d, "budget")); if (!l) return; for (const st of l.stops) if (st.kind === "budget") st.limit = st.limit * int(2, 9) + 1; return l.id; },
  "cap: removed": (d) => { const l = pick(withStop(d, "max-iterations").filter((l) => l.stops.some((st) => st.kind !== "max-iterations"))); if (!l) return; l.stops = l.stops.filter((st) => st.kind !== "max-iterations"); return l.id; },
  "budget: removed": (d) => { const l = pick(withStop(d, "budget").filter((l) => l.stops.some((st) => st.kind !== "budget"))); if (!l) return; l.stops = l.stops.filter((st) => st.kind !== "budget"); return l.id; },
  "budget: measure changed, huge limit": (d) => { const l = pick(withStop(d, "budget")); if (!l) return; const st = l.stops.find((st) => st.kind === "budget"); st.measure = pick(["dispatches", "minutes", "usd", "turns", "tokens"].filter((m) => !l.stops.some((o) => o.kind === "budget" && o.measure === m))); st.limit = 1e9; return l.id; },
  "cap or budget: leads on to a member (goes round again)": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => (st.kind === "max-iterations" || st.kind === "budget") && st.then === undefined))); if (!l) return; const st = pick(l.stops.filter((st) => (st.kind === "max-iterations" || st.kind === "budget") && st.then === undefined)); const m = pick(l.members.filter((m) => d.nodes.find((n) => n.id === m)?.kind === "agent" && !(d.nodes.find((n) => n.id === m).irreversible ?? []).length)); if (!m) return; st.then = m; return l.id; },
  "cap or budget: leads on to a new success stop": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => (st.kind === "max-iterations" || st.kind === "budget") && st.then === undefined))); if (!l) return; const st = pick(l.stops.filter((st) => (st.kind === "max-iterations" || st.kind === "budget") && st.then === undefined)); const id = fresh(d, "ok"); d.nodes.push({ id, kind: "stop", name: "OK", outcome: "success" }); st.then = id; return l.id; },
  "an earlier stop of another measure that leads on to a member": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => (st.kind === "max-iterations" || st.kind === "budget") && st.then === undefined))); if (!l) return; const measure = pick(["minutes", "usd", "turns", "tokens"].filter((m) => !l.stops.some((o) => o.kind === "budget" && o.measure === m))); const m = pick(l.members.filter((m) => { const n = d.nodes.find((n) => n.id === m); return n?.kind === "agent" && !(n.irreversible ?? []).length; })); if (!m || !measure) return; l.stops.unshift({ kind: "budget", measure, limit: 0, then: m }); return l.id; },
  "loop: same loop under another id, cap or budget raised": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" || st.kind === "budget"))); if (!l) return; const old = l.id; l.id = fresh(d, `${old}-b`); for (const st of l.stops) { if (st.kind === "max-iterations") st.n += 30; if (st.kind === "budget") st.limit = st.limit * 10 + 1; } for (const p of d.policies ?? []) if (p.scope === `loop:${old}`) p.scope = `loop:${l.id}`; return old; },
  "loop: split, one back edge counted by a second loop": (d) => { const l = pick(d.loops.filter((l) => l.back.length >= 2 && l.stops.some(brakeStop))); if (!l) return; const moved = pick(l.back); l.back = l.back.filter((b) => b !== moved); d.loops.push({ id: fresh(d, `${l.id}-two`), name: "Two", members: [...l.members], back: [moved], mode: "judgment", bar: clone(l.bar) ?? plainBar(), stops: clone(l.stops) }); return l.id; },
  "loop: an outer loop added around it (nested: inner counters start afresh)": (d) => {
    const back = allBack(d);
    const cands = d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" || st.kind === "budget")).flatMap((l) => d.edges.filter((e) => !back.has(e.id) && !l.members.includes(e.from) && l.members.includes(e.to) && d.nodes.find((n) => n.id === e.from)?.kind === "agent").map((e) => ({ l, e })));
    const c = pick(cands); if (!c) return;
    const from = pick(c.l.members.filter((m) => ["agent", "check"].includes(d.nodes.find((n) => n.id === m)?.kind) && m !== c.e.to)) ?? c.e.to;
    if ((d.nodes.find((n) => n.id === c.e.from).irreversible ?? []).length) return;
    const e = newEdge(d, from, c.e.from, { when: { verdict: "start-over" } });
    d.loops.push({ id: fresh(d, `${c.l.id}-outer`), name: "Outer", members: [...new Set([c.e.from, ...c.l.members])], back: [e.id], mode: "judgment", bar: plainBar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
    return c.l.id;
  },
  "loop: a second way round through a new step, counted by a second loop": (d) => {
    const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" || st.kind === "budget"))); if (!l) return;
    const b = d.edges.find((e) => e.id === pick(l.back)); if (!b) return;
    if ((d.nodes.find((n) => n.id === b.to)?.irreversible ?? []).length) return;
    const step = newAgent(d, "redo");
    newEdge(d, b.from, step.id, { when: { verdict: "redo" } });
    const e2 = newEdge(d, step.id, b.to, b.evidence ? { evidence: [...b.evidence] } : {});
    d.loops.push({ id: fresh(d, `${l.id}-redo`), name: "Redo", members: [...l.members, step.id], back: [e2.id], mode: "judgment", bar: plainBar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
    return l.id;
  },
  "human stop: asked less often": (d) => { const l = pick(withStop(d, "human")); if (!l) return; for (const st of l.stops) if (st.kind === "human") st.every = (st.every ?? 1) + int(1, 9); return l.id; },
  "human stop: removed": (d) => { const l = pick(withStop(d, "human").filter((l) => l.stops.some((st) => st.kind !== "human"))); if (!l) return; l.stops = l.stops.filter((st) => st.kind !== "human"); return l.id; },
  // the bar
  "bar: acceptance weakened": (d) => { const l = pick(d.loops.filter((l) => l.bar)); if (!l) return; l.bar.acceptance = "It looks about right."; return l.id; },
  // gates
  "gate: removed, its way in joined to its way on": (d) => {
    const back = allBack(d); const g = pick(d.nodes.filter((n) => n.kind === "human-gate")); if (!g) return;
    if (d.loops.some((l) => l.stops.some((st) => st.then === g.id) || l.bar?.answerKeyFrom === g.id)) return;
    const ins = d.edges.filter((e) => e.to === g.id), outs = d.edges.filter((e) => e.from === g.id && !back.has(e.id));
    d.nodes = d.nodes.filter((n) => n.id !== g.id);
    const gone = new Set(d.edges.filter((e) => e.from === g.id || e.to === g.id).map((e) => e.id));
    d.edges = d.edges.filter((e) => !gone.has(e.id));
    for (const i of ins) for (const o of outs) if (i.from !== o.to) newEdge(d, i.from, o.to, i.when !== undefined ? { when: i.when } : {});
    for (const l of d.loops) { l.members = l.members.filter((m) => m !== g.id); l.back = l.back.filter((b) => !gone.has(b)); }
    if (d.loops.some((l) => l.back.length === 0)) return;
    for (const gr of d.groups ?? []) gr.members = gr.members.filter((m) => m !== g.id);
    d.policies = (d.policies ?? []).filter((p) => p.scope !== `node:${g.id}` && ![...gone].some((id) => p.scope === `edge:${id}`));
    if (d.layout) delete d.layout[g.id];
    return g.id;
  },
  "gate: becomes a check": (d) => { const i = d.nodes.findIndex((n) => n.kind === "human-gate"); if (i < 0) return; const g = d.nodes[i]; d.nodes[i] = { id: g.id, kind: "check", name: g.name, check: { kind: "command", run: "true", pass: "exit 0" } }; return g.id; },
  "gate: an answer cut": (d) => { const g = pick(d.nodes.filter((n) => n.kind === "human-gate" && (n.options ?? []).length >= 2)); if (!g) return; g.options.splice(int(0, g.options.length - 1), 1); return g.id; },
  "gate: a way around it (edge from what led to it, to what it led to)": (d) => { const back = allBack(d); const cands = d.nodes.filter((n) => n.kind === "human-gate").flatMap((g) => d.edges.filter((i) => i.to === g.id && d.nodes.find((n) => n.id === i.from)?.kind !== "human-gate").flatMap((i) => d.edges.filter((o) => o.from === g.id && !back.has(o.id) && o.to !== i.from && !(d.nodes.find((n) => n.id === o.to)?.irreversible ?? []).length).map((o) => ({ i, o })))); const c = pick(cands); if (!c) return; newEdge(d, c.i.from, c.o.to, { when: { verdict: "obvious" } }); return c.o.to; },
  "gate: a twin of the round it stands on, around it": (d) => { const cands = d.nodes.filter((n) => n.kind === "human-gate").flatMap((g) => d.edges.filter((i) => i.to === g.id && d.nodes.find((n) => n.id === i.from)?.kind !== "human-gate").flatMap((i) => d.edges.filter((o) => o.from === g.id && allBack(d).has(o.id) && !(d.nodes.find((n) => n.id === o.to)?.irreversible ?? []).length && !d.edges.some((x) => x.from === i.from && x.to === o.to && !x.approval)).map((o) => ({ i, o })))); const c = pick(cands); if (!c) return; const e = newEdge(d, c.i.from, c.o.to, { when: { verdict: "minor" } }); for (const l of d.loops) if (l.back.includes(c.o.id) && l.members.includes(c.i.from)) l.back.push(e.id); return c.o.id; },
  // approvals
  "approval: flag removed": (d) => { const e = pick(d.edges.filter((e) => e.approval === true)); if (!e) return; delete e.approval; return e.id; },
  "approval: edge replaced under another id without it": (d) => { const e = pick(d.edges.filter((e) => e.approval === true)); if (!e) return; const old = e.id; e.id = fresh(d, `${old}-b`); delete e.approval; for (const l of d.loops) l.back = l.back.map((b) => (b === old ? e.id : b)); for (const p of d.policies ?? []) if (p.scope === `edge:${old}`) p.scope = `edge:${e.id}`; return old; },
  "approval: a twin edge beside it without approval": (d) => { const e = pick(d.edges.filter((e) => e.approval === true && d.nodes.find((n) => n.id === e.from)?.kind !== "human-gate" && !(d.nodes.find((n) => n.id === e.to)?.irreversible ?? []).length)); if (!e) return; const t = newEdge(d, e.from, e.to, { ...(e.when !== undefined ? { when: e.when } : {}), ...(e.evidence ? { evidence: [...e.evidence] } : {}) }); for (const l of d.loops) if (l.back.includes(e.id)) l.back.push(t.id); return e.id; },
  // irreversible markers
  "marker: removed": (d) => { const n = pick(d.nodes.filter((n) => (n.irreversible ?? []).length)); if (!n) return; delete n.irreversible; return n.id; },
  "marker: list shortened": (d) => { const n = pick(d.nodes.filter((n) => (n.irreversible ?? []).length >= 2)); if (!n) return; n.irreversible.pop(); return n.id; },
  "marker: node replaced under another id without it": (d) => { const n = pick(d.nodes.filter((n) => (n.irreversible ?? []).length)); if (!n) return; const old = n.id; delete n.irreversible; renameNode(d, old, fresh(d, `${old}-b`)); return old; },
  // critics
  "critic: given another role": (d) => { const n = pick(d.nodes.filter(isCritic)); if (!n) return; n.role = pick(["tester", "researcher", { custom: "critic" }]); return n.id; },
  "critic: a way around it": (d) => { const back = allBack(d); const cands = d.nodes.filter(isCritic).flatMap((c) => d.edges.filter((i) => i.to === c.id && !back.has(i.id)).flatMap((i) => d.edges.filter((o) => o.from === c.id && !back.has(o.id) && o.to !== i.from && !d.edges.some((x) => x.from === i.from && x.to === o.to) && !isCritic(d.nodes.find((n) => n.id === o.to) ?? {}) && !(d.nodes.find((n) => n.id === o.to)?.irreversible ?? []).length).map((o) => ({ i, o })))); const c = pick(cands); if (!c) return; newEdge(d, c.i.from, c.o.to); return c.o.to; },
  "critic: an evidence item no longer handed": (d) => { const e = pick(d.edges.filter((e) => isCritic(d.nodes.find((n) => n.id === e.to) ?? {}) && (e.evidence ?? []).length >= 2)); if (!e) return; e.evidence.splice(int(0, e.evidence.length - 1), 1); return e.id; },
  "critic isolation: policy removed": (d) => { if (!(d.policies ?? []).some((p) => p.kind === "critic-isolation")) return; d.policies = d.policies.filter((p) => p.kind !== "critic-isolation"); return "policy"; },
  "critic isolation: policy re-scoped to one node": (d) => { const p = pick((d.policies ?? []).filter((p) => p.kind === "critic-isolation" && p.scope === "graph")); const n = pick(d.nodes.filter((n) => n.kind === "stop")); if (!p || !n) return; p.scope = `node:${n.id}`; return p.id; },
  "critic isolation: policy removed and the edge into the critic shared": (d) => { const e = pick(d.edges.filter((e) => isCritic(d.nodes.find((n) => n.id === e.to) ?? {}) && e.isolation !== "shared")); if (!e) return; d.policies = (d.policies ?? []).filter((p) => p.kind !== "critic-isolation"); e.isolation = "shared"; return e.id; },
  "two caps: the one that leads on to a wrap-up step now leads back into the loop": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" && st.then === undefined) && l.stops.some((st) => st.kind === "max-iterations" && st.then !== undefined && !l.members.includes(st.then)))); if (!l) return; const st = l.stops.find((st) => st.kind === "max-iterations" && st.then !== undefined); const m = pick(l.members.filter((m) => { const n = d.nodes.find((n) => n.id === m); return n?.kind === "agent" && !(n.irreversible ?? []).length; })); if (!m) return; st.then = m; return l.id; },
  "two caps: a second cap of the same n that leads on to a member, set before the one that halts": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" && st.then === undefined))); if (!l) return; const halt = l.stops.find((st) => st.kind === "max-iterations" && st.then === undefined); const m = pick(l.members.filter((m) => { const n = d.nodes.find((n) => n.id === m); return n?.kind === "agent" && !(n.irreversible ?? []).length; })); if (!m) return; l.stops.splice(l.stops.indexOf(halt), 0, { kind: "max-iterations", n: halt.n, then: m }); return l.id; },
  "stops: cap raised and budget lowered in the same loop": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations") && l.stops.some((st) => st.kind === "budget" && st.limit >= 4))); if (!l) return; for (const st of l.stops) { if (st.kind === "max-iterations") st.n += 40; if (st.kind === "budget") st.limit = Math.floor(st.limit / 2); } return l.id; },
  "stops: budget raised and cap lowered in the same loop": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "max-iterations" && st.n >= 2) && l.stops.some((st) => st.kind === "budget"))); if (!l) return; for (const st of l.stops) { if (st.kind === "max-iterations") st.n -= 1; if (st.kind === "budget") st.limit = st.limit * 50 + 1; } return l.id; },
  "human stop: leads on to a member instead of asking and halting": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((st) => st.kind === "human" && st.then === undefined))); if (!l) return; const m = pick(l.members.filter((m) => { const n = d.nodes.find((n) => n.id === m); return n?.kind === "agent" && !(n.irreversible ?? []).length; })); if (!m) return; l.stops.find((st) => st.kind === "human").then = m; return l.id; },
  "bar: removed, the loop called a grind": (d) => { const l = pick(d.loops.filter((l) => l.bar)); if (!l) return; delete l.bar; l.mode = "grind"; return l.id; },
  "gate: its answers no longer listed": (d) => { const g = pick(d.nodes.filter((n) => n.kind === "human-gate" && (n.options ?? []).length >= 1)); if (!g) return; delete g.options; return g.id; },
  "approval: the approved edge moved aside to a new step, an unapproved edge in its place": (d) => { const e = pick(d.edges.filter((e) => e.approval === true && d.nodes.find((n) => n.id === e.from)?.kind !== "human-gate" && !(d.nodes.find((n) => n.id === e.to)?.irreversible ?? []).length)); if (!e) return; const t = newEdge(d, e.from, e.to, { ...(e.when !== undefined ? { when: e.when } : {}), ...(e.evidence ? { evidence: [...e.evidence] } : {}) }); for (const l of d.loops) l.back = l.back.map((b) => (b === e.id ? t.id : b)); const aside = newAgent(d, "aside"); e.to = aside.id; e.when = { verdict: "aside" }; delete e.evidence; return e.id; },
  "marker: the marked node becomes a check": (d) => { const i = d.nodes.findIndex((n) => (n.irreversible ?? []).length); if (i < 0) return; const n = d.nodes[i]; d.nodes[i] = { id: n.id, kind: "check", name: n.name, check: { kind: "command", run: "make release", pass: "exit 0" } }; return n.id; },
  "critic: removed, its way in joined to its way on": (d) => {
    const back = allBack(d); const c = pick(d.nodes.filter(isCritic)); if (!c) return;
    if (d.loops.some((l) => l.stops.some((st) => st.then === c.id) || l.bar?.answerKeyFrom === c.id)) return;
    const ins = d.edges.filter((e) => e.to === c.id && !back.has(e.id)), outs = d.edges.filter((e) => e.from === c.id);
    const gone = new Set(d.edges.filter((e) => e.from === c.id || e.to === c.id).map((e) => e.id));
    d.nodes = d.nodes.filter((n) => n.id !== c.id); d.edges = d.edges.filter((e) => !gone.has(e.id));
    for (const l of d.loops) l.members = l.members.filter((m) => m !== c.id);
    for (const i of ins) for (const o of outs) { if (i.from === o.to) continue; const e = newEdge(d, i.from, o.to, o.when !== undefined ? { when: o.when } : {}); if (back.has(o.id)) for (const l of d.loops) if (l.back.includes(o.id)) l.back.push(e.id); }
    for (const l of d.loops) l.back = l.back.filter((b) => !gone.has(b));
    if (d.loops.some((l) => l.back.length === 0)) return;
    for (const gr of d.groups ?? []) gr.members = gr.members.filter((m) => m !== c.id);
    d.policies = (d.policies ?? []).filter((p) => p.scope !== `node:${c.id}` && ![...gone].some((id) => p.scope === `edge:${id}`));
    if (d.layout) delete d.layout[c.id];
    return c.id;
  },
  // the adaptation level
  "level: loosened": (d) => {
    const level = (x) => { const ls = [x.adaptation ?? "adaptive"]; if ((x.policies ?? []).some((p) => p.kind === "no-live-graph-rewrite" && p.scope === "graph")) ls.push("propose"); return ["fixed", "propose", "adaptive"].find((l) => ls.includes(l)); };
    const was = level(d); if (was === "adaptive") return;
    d.policies = (d.policies ?? []).filter((p) => p.kind !== "no-live-graph-rewrite");
    if (was === "fixed" && chance(0.5)) d.adaptation = "propose"; else if (chance(0.5)) delete d.adaptation; else d.adaptation = "adaptive";
    return `${was} -> ${level(d)}`;
  },
};

// ---- noise: harmless, or tightening (to hide the loosening behind). Never on the brake the family loosens:
// each one leaves alone anything the source had of that kind, so it cannot undo the mutation.
const STOPS = /^(cap|budget|loop|an earlier|cap or budget|human stop|two caps|stops)/;
const NOISE = [
  (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent")); if (n) n.brief += " Say what you tried."; },
  (d) => { d.description = `${d.description ?? ""} Amended during the run.`.trim(); },
  (d) => { const from = pick(d.nodes.filter((n) => n.kind === "agent" && n.role !== "lead")); if (from) { const n = newAgent(d, "notes"); newEdge(d, from.id, n.id); } },
  (d, src, family) => { if (STOPS.test(family)) return; const l = pick(withStop(d, "budget")); if (l) for (const st of l.stops) if (st.kind === "budget" && st.limit > 2 && st.then === undefined) { st.limit = Math.floor(st.limit / 2); break; } },
  (d, src, family) => { if (/^(approval|gate|critic: a way)/.test(family)) return; const had = new Set(src.edges.map((e) => e.id)); const e = pick(d.edges.filter((e) => !e.approval && had.has(e.id))); if (e) e.approval = true; },
  (d) => { d.nodes.reverse(); d.edges.reverse(); },
  (d, src, family) => { if (/^level/.test(family)) return; if (d.adaptation === undefined && src.adaptation === undefined) d.adaptation = "propose"; },
  (d, src, family) => { if (STOPS.test(family)) return; const l = pick(d.loops.filter((l) => !l.stops.some((st) => st.kind === "human"))); if (l) l.stops.push({ kind: "human", every: 2 }); },
];

// ---- run
const tally = new Map(); const examples = new Map();
let counted = 0, through = 0, invalid = 0, na = 0, saidTighter = 0;
const names = Object.keys(M);
for (let t = 0; t < trials; t++) {
  const start = pick(pool);
  let source;
  for (let tries = 0; tries < 6 && !source; tries++) { const d = clone(start.doc); if (tries < 5) decorate(d); const p = core.parseGraphText(JSON.stringify(d)); if (p.doc && errorsOf(p.doc).length === 0) source = p.doc; }
  const family = names[t % names.length];
  const working = clone(source);
  const note = M[family](working);
  if (note === undefined) { na++; continue; }
  const noise = int(0, 2); const hidden = [];
  for (let i = 0; i < noise; i++) { const k = int(0, NOISE.length - 1); hidden.push(k); NOISE[k](working, source, family); }
  const parsed = core.parseGraphText(JSON.stringify(working));
  const adopted = parsed.doc ? core.adoptWorkingCopy(source, parsed.doc, { run: "fuzz" }) : { ok: false };
  if (!adopted.ok) { invalid++; continue; }
  const check = core.checkAdoption(source, adopted.doc, {});
  const row = tally.get(family) ?? tally.set(family, { n: 0, through: 0, rounds: 0, people: 0, throughConfirmed: 0 }).get(family);
  row.n++; counted++;
  const got = check.refused.length === 0;
  // my own oracle, where it has something to say
  const rounds = /^(cap|budget|loop|an earlier|cap or budget|two caps|stops)/.test(family) ? roundsLoosened(source, adopted.doc) : [];
  const people = /^(gate|approval)/.test(family) ? personLoosened(source, adopted.doc) : [];
  if (rounds.length) row.rounds++;
  if (people.length) row.people++;
  if (got) {
    through++; row.through++;
    if (rounds.length || people.length) row.throughConfirmed++;
    if (check.changes.some((c) => c.tightens !== undefined)) saidTighter++;
    const list = examples.get(family) ?? examples.set(family, []).get(family);
    if (list.length < showN) list.push({ start: start.file, note, noise: hidden, changes: check.changes.map((c) => `${c.kind} ${c.name}${c.tightens ? ` [said to tighten: ${c.tightens}]` : ""}`), oracle: { rounds, people: people.slice(0, 4) }, source, working: adopted.doc });
  }
}
console.log(`seed ${seed}: ${trials} trials; ${na} mutation did not apply to the graph drawn; ${invalid} not valid for export (refused earlier, not counted); ${counted} counted`);
console.log(`THROUGH with nothing refused: ${through} of ${counted}; of those, the report marked a change as tightening in ${saidTighter}`);
console.log(`THROUGH and my own oracle also finds it looser (worst-case dispatches grew, or a pair of steps lost the person between them): ${[...tally.values()].reduce((n, r) => n + r.throughConfirmed, 0)}`);
console.log("\nfamily".padEnd(76), "counted  through  (my oracle agrees it is looser: of counted / of through)");
for (const [family, row] of tally) console.log(`${row.through ? "!!" : "  "} ${family.padEnd(72)} ${String(row.n).padStart(6)} ${String(row.through).padStart(8)}   ${/^(cap|budget|loop|an earlier|cap or budget|two caps|stops)/.test(family) ? `rounds ${row.rounds}/${row.throughConfirmed}` : /^(gate|approval)/.test(family) ? `people ${row.people}/${row.throughConfirmed}` : "by construction"}`);
mkdirSync(join(SCRATCH, "adopt-reader-1/fuzz"), { recursive: true });
for (const [family, list] of examples) list.forEach((ex, i) => {
  const stem = join(SCRATCH, "adopt-reader-1/fuzz", `seed${seed}-${family.replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}-${i}`);
  writeFileSync(`${stem}.source.json`, core.canonicalize(ex.source)); writeFileSync(`${stem}.adopted.json`, core.canonicalize(ex.working));
  console.log(`\n-- through: ${family}\n   start ${ex.start}; at ${ex.note}; noise ${JSON.stringify(ex.noise)}\n   changes: ${ex.changes.join("; ")}\n   my oracle: ${JSON.stringify(ex.oracle)}\n   files: ${stem}.{source,adopted}.json`);
});
