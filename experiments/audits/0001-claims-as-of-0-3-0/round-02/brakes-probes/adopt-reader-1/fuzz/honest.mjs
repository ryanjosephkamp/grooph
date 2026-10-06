/**
 * The other side: changes that loosen nothing by construction (they tighten, or touch no brake), and wild pairs for
 * crashes. node R/probe/fuzz/honest.mjs [seed=1] [trials=3000]
 * Counts: refused though honest (a false refusal), thrown errors, and a tightening not said.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { R, core, clone, errorsOf } from "../lib.mjs";
const seed = Number(process.argv[2] ?? 1), trials = Number(process.argv[3] ?? 3000);
let s = seed >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const pool = [];
for (const dir of ["fixtures/valid", "patterns", "fixtures/composed"]) for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
  const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8")); if (!parsed.doc) continue; let d = parsed.doc;
  if (d.template) { try { const out = core.instantiate(d, { name: d.name, values: Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example])) }); d = out.doc ?? out; } catch { continue; } }
  if (errorsOf(d).length === 0) pool.push({ file: `${dir}/${f}`, doc: d });
}
const ids = (d) => new Set([d.id, ...d.nodes.map((n) => n.id), ...d.edges.map((e) => e.id), ...d.loops.map((l) => l.id), ...(d.policies ?? []).map((p) => p.id), ...(d.groups ?? []).map((g) => g.id)]);
const fresh = (d, stem) => { const used = ids(d); let i = 0; let id = stem; while (used.has(id)) id = `${stem}-${++i}`; return id; };
const back = (d) => new Set(d.loops.flatMap((l) => l.back));
const H = {
  "cap lowered": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((x) => x.kind === "max-iterations" && x.n >= 2))); if (!l) return; l.stops.find((x) => x.kind === "max-iterations" && x.n >= 2).n -= 1; return "tightens"; },
  "budget lowered": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((x) => x.kind === "budget" && x.limit >= 2))); if (!l) return; const x = l.stops.find((x) => x.kind === "budget" && x.limit >= 2); x.limit = Math.floor(x.limit / 2); return "tightens"; },
  "a cap added to a loop that had none (last)": (d) => { const l = pick(d.loops.filter((l) => !l.stops.some((x) => x.kind === "max-iterations"))); if (!l) return; l.stops.push({ kind: "max-iterations", n: 3 }); return "tightens"; },
  "a human stop added (last)": (d) => { const l = pick(d.loops.filter((l) => !l.stops.some((x) => x.kind === "human"))); if (!l) return; l.stops.push({ kind: "human", every: 2 }); return "tightens"; },
  "an approval added": (d) => { const e = pick(d.edges.filter((e) => !e.approval && d.nodes.find((n) => n.id === e.from)?.kind !== "human-gate")); if (!e) return; e.approval = true; return "tightens"; },
  "a marker added to a step already behind a person": (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent" && !(n.irreversible ?? []).length && d.edges.some((e) => e.to === n.id) && d.edges.filter((e) => e.to === n.id).every((e) => e.approval || d.nodes.find((x) => x.id === e.from)?.kind === "human-gate") && !d.loops.some((l) => l.stops.some((x) => x.then === n.id)))); if (!n) return; n.irreversible = ["publish"]; return "tightens"; },
  "level made stricter": (d) => { if ((d.adaptation ?? "adaptive") === "fixed") return; d.adaptation = d.adaptation === "propose" ? "fixed" : "propose"; return "tightens"; },
  "a brief reworded": (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent")); if (!n) return; n.brief += " Be brief."; return "neutral"; },
  "a notes step added after an agent that led nowhere or anywhere": (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent" && n.role !== "lead")); if (!n) return; const id = fresh(d, "notes"); d.nodes.push({ id, kind: "agent", name: id, role: "tester", brief: "Write notes.", outputs: ["NOTES.md"], allow: ["read-files", "write-outputs"] }); d.edges.push({ id: fresh(d, `e-${id}`), from: n.id, to: id, approval: true }); return "neutral"; },
  "a policy under another id, same kind and scope": (d) => { const p = pick(d.policies ?? []); if (!p) return; p.id = fresh(d, `${p.id}-b`); return "neutral"; },
  "a loop under another id, nothing else changed": (d) => { const l = pick(d.loops); if (!l) return; const old = l.id; l.id = fresh(d, `${old}-b`); for (const p of d.policies ?? []) if (p.scope === `loop:${old}`) p.scope = `loop:${l.id}`; return "neutral"; },
  "an edge under another id, nothing else changed": (d) => { const e = pick(d.edges); if (!e) return; const old = e.id; e.id = fresh(d, `${old}-b`); for (const l of d.loops) l.back = l.back.map((b) => (b === old ? e.id : b)); for (const p of d.policies ?? []) if (p.scope === `edge:${old}`) p.scope = `edge:${e.id}`; return "neutral"; },
  "a second gate put in front of a gate (on the edge into it)": (d) => { const b = back(d); const e = pick(d.edges.filter((e) => d.nodes.find((n) => n.id === e.to)?.kind === "human-gate" && !b.has(e.id))); if (!e) return; const id = fresh(d, "pre-gate"); d.nodes.push({ id, kind: "human-gate", name: "First look", prompt: "Go on to the merge question?", options: ["go on"] }); const to = e.to; e.to = id; d.edges.push({ id: fresh(d, `e-${id}`), from: id, to }); for (const l of d.loops) if (l.members.includes(to) && l.members.includes(e.from)) l.members.push(id); return "tightens"; },
  "gate: an answer added (no edge)": (d) => { const g = pick(d.nodes.filter((n) => n.kind === "human-gate" && n.options)); if (!g) return; g.options.push("ask me later"); return "neutral"; },
  "critic handed one more piece of evidence": (d) => { const e = pick(d.edges.filter((e) => ["critic", "judge", "red-team"].includes(d.nodes.find((n) => n.id === e.to)?.role) && e.evidence)); if (!e) return; e.evidence.push("the test log"); return "neutral"; },
  "nodes, edges and stops' keys reordered": (d) => { d.nodes.reverse(); d.edges.reverse(); (d.policies ?? []).reverse(); return "neutral"; },
  "the cap's halt made a halting stop node": (d) => { const l = pick(d.loops.filter((l) => l.stops.some((x) => x.kind === "max-iterations" && x.then === undefined))); if (!l) return; const id = fresh(d, "halted"); d.nodes.push({ id, kind: "stop", name: "Halted", outcome: "halt" }); l.stops.find((x) => x.kind === "max-iterations").then = id; return "neutral"; },
  "bar-passed moved after the cap (order only)": (d) => { const l = pick(d.loops.filter((l) => l.stops[0]?.kind === "bar-passed" && l.stops[0].then === undefined && l.stops.length > 1 && l.stops.every((x) => x.then === undefined))); if (!l) return; l.stops.push(l.stops.shift()); return "neutral"; },
};
const tally = new Map(); let thrown = 0; const errs = new Map();
const names = Object.keys(H);
for (let t = 0; t < trials; t++) {
  const start = pick(pool); const working = clone(start.doc); const family = names[t % names.length];
  const kind = H[family](working); if (kind === undefined) continue;
  const parsed = core.parseGraphText(JSON.stringify(working)); if (!parsed.doc) continue;
  let adopted, check;
  try { adopted = core.adoptWorkingCopy(start.doc, parsed.doc, { run: "h" }); if (!adopted.ok) continue; check = core.checkAdoption(start.doc, adopted.doc, {}); }
  catch (e) { thrown++; errs.set(String(e.message).slice(0, 80), (errs.get(String(e.message).slice(0, 80)) ?? 0) + 1); continue; }
  const row = tally.get(family) ?? tally.set(family, { n: 0, refused: 0, said: 0, kind, why: new Map() }).get(family);
  row.n++; if (check.refused.length) { row.refused++; const w = check.refused[0].loosens.split(/[;:(]/)[0].replace(/"[^"]*"/g, '"…"').slice(0, 70); row.why.set(w, (row.why.get(w) ?? 0) + 1); }
  if (check.changes.some((c) => c.tightens !== undefined)) row.said++;
}
console.log(`seed ${seed}, ${trials} trials; thrown: ${thrown} ${JSON.stringify([...errs])}`);
console.log("family".padEnd(62), "kind      counted refused  said-to-tighten   first reason given (count)");
for (const [f, r] of tally) console.log(`${f.padEnd(62)} ${r.kind.padEnd(9)} ${String(r.n).padStart(6)} ${String(r.refused).padStart(7)} ${String(r.said).padStart(8)}          ${[...r.why].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w, n]) => `${w} (${n})`).join(" | ")}`);

// wild pairs: any two graphs of the pool as source and working copy; and sources that are themselves broken
let wild = 0, wildThrown = 0; const wildErrs = new Map();
for (let t = 0; t < 600; t++) {
  const a = clone(pick(pool).doc), b = clone(pick(pool).doc);
  if (rnd() < 0.5) { const n = pick(a.nodes); a.nodes = a.nodes.filter((x) => x !== n); } // a source with dangling references
  if (rnd() < 0.3) a.loops.forEach((l) => l.stops.forEach((x) => { if (rnd() < 0.5) x.then = "nowhere"; }));
  try { core.checkAdoption(a, b, {}); core.checkAdoption(b, a, { allow: ["x"] }); wild++; } catch (e) { wildThrown++; wildErrs.set(String(e.stack).split("\n").slice(0, 2).join(" @ ").slice(0, 200), 1); }
}
console.log(`wild pairs: ${wild} compared, ${wildThrown} threw ${JSON.stringify([...wildErrs.keys()])}`);
