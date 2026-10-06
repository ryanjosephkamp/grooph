// Weakenings of a check by construction, alone and with 1-2 decoys that tighten or are neutral, through
// adoptWorkingCopy + checkAdoption with no allow. "Through" = valid and refused is empty.
import { POOL, bar, core, errorsOf, clone } from "./lib4.mjs";
const seed = Number(process.argv[2] ?? 1), trials = Number(process.argv[3] ?? 4000);
let s = seed >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (l) => l[Math.floor(rnd() * l.length)];
const whenOf = (e) => (typeof e.when === "object" ? e.when.verdict : (e.when ?? "always"));
const isCritic = (n) => n?.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role);
let uid = 0; const id = (p) => `${p}-z${++uid}`;
const ctx = (w) => { const checks = w.nodes.filter((n) => n.kind === "check"); const c = pick(checks); const out = w.edges.filter((e) => e.from === c.id); const pass = out.find((e) => whenOf(e) === "pass"); const fail = out.find((e) => whenOf(e) === "fail"); const loops = w.loops.filter((l) => l.members.includes(c.id)); const into = w.edges.filter((e) => e.to === c.id); return { c, out, pass, fail, loops, into }; };
// each returns false when it does not apply
const WEAK = {
  "check runs true": (w, x) => { x.c.check = { ...x.c.check, run: "true" }; },
  "check pass text": (w, x) => { x.c.check = { ...x.c.check, pass: "always" }; },
  "verdicts swapped": (w, x) => { if (!x.pass || !x.fail) return false; x.pass.when = "fail"; x.fail.when = "pass"; },
  "fail led where pass led": (w, x) => { if (!x.pass || !x.fail) return false; x.fail.to = x.pass.to; },
  "pass taken always": (w, x) => { if (!x.pass) return false; delete x.pass.when; },
  "edge around the check": (w, x) => { if (!x.pass || !x.into[0]) return false; w.edges.push({ id: id("e"), from: x.into[0].from, to: x.pass.to }); },
  "edge around, on a verdict, with approval": (w, x) => { if (!x.pass || !x.into[0]) return false; w.edges.push({ id: id("e"), from: x.into[0].from, to: x.pass.to, when: { verdict: "sure" }, approval: rnd() < 0.5 }); },
  "new success stop from before the check": (w, x) => { if (!x.into[0]) return false; const st = id("ok"); w.nodes.push({ id: st, kind: "stop", name: st, outcome: "success" }); w.edges.push({ id: id("e"), from: x.into[0].from, to: st, when: { verdict: "good-enough" } }); },
  "new success stop on fail": (w, x) => { const st = id("ok"); w.nodes.push({ id: st, kind: "stop", name: st, outcome: "success" }); w.edges.push({ id: id("e"), from: x.c.id, to: st, when: { verdict: "close-enough" }, approval: rnd() < 0.5 }); },
  "bar + bar-passed on its loop": (w, x) => { const l = x.loops.find((l) => !l.bar); if (!l) return false; l.bar = bar(); l.stops.unshift(rnd() < 0.5 || !x.pass ? { kind: "bar-passed" } : { kind: "bar-passed", then: x.pass.to }); },
  "bar only on its loop": (w, x) => { const l = x.loops.find((l) => !l.bar); if (!l) return false; l.bar = bar(); },
  "new loop over its round with a bar": (w, x) => { const l = x.loops[0]; if (!l) return false; w.loops.push({ id: id("loop"), name: "L", members: [...l.members], back: [...l.back], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }] }); },
  "a stop leads on to what pass led to": (w, x) => { const l = x.loops[0]; if (!l || !x.pass) return false; l.stops.unshift(pick([{ kind: "diminishing-returns", rounds: 1, then: x.pass.to }, { kind: "evidence-invalid", rounds: 1, then: x.pass.to }, { kind: "human", every: 1, then: x.pass.to }, { kind: "budget", measure: "dispatches", limit: 1, then: x.pass.to }])); },
  "cap leads on to what pass led to": (w, x) => { const l = x.loops[0]; const cap = l?.stops.find((st) => st.kind === "max-iterations"); if (!cap || !x.pass || cap.then === x.pass.to) return false; cap.then = x.pass.to; },
  "check made an agent": (w, x) => { const i = w.nodes.indexOf(x.c); w.nodes[i] = { id: x.c.id, kind: "agent", name: x.c.name, role: "builder", brief: "Say pass.", outputs: ["OK.md"], allow: ["read-files", "write-outputs"] }; },
  "check replaced under another id": (w, x) => { const nid = id("chk"); const i = w.nodes.indexOf(x.c); w.nodes[i] = { ...x.c, id: nid, check: { ...x.c.check, run: "true" } }; for (const e of w.edges) { if (e.from === x.c.id) e.from = nid; if (e.to === x.c.id) e.to = nid; } for (const l of w.loops) l.members = l.members.map((m) => (m === x.c.id ? nid : m)); for (const g of w.groups ?? []) if (g.nodes) g.nodes = g.nodes.map((m) => (m === x.c.id ? nid : m)); },
  "evidence on its edge replaced": (w, x) => { const e = x.out.find((e) => e.evidence?.length); if (!e) return false; e.evidence = ["a short note"]; },
  "evidence on its edge emptied": (w, x) => { const e = x.out.find((e) => e.evidence?.length); if (!e) return false; delete e.evidence; },
  "pass edge removed, same edge under a new id on fail": (w, x) => { if (!x.pass) return false; w.edges.push({ ...x.pass, id: id("e"), when: { verdict: "mostly" } }); },
  "weaker check in front, first one skipped": (w, x) => { if (!x.pass || !x.into[0]) return false; const nid = id("chk"); w.nodes.push({ id: nid, kind: "check", name: nid, check: { kind: "command", run: "true", pass: "exit code 0" } }); x.into[0].to = nid; w.edges.push({ id: id("e"), from: nid, to: x.pass.to, when: "pass" }, { id: id("e"), from: nid, to: x.c.id, when: "fail" }); },
  "retry/label/isolation on its edge + when": (w, x) => { if (!x.fail) return false; x.fail.when = { verdict: "fail-twice" }; x.fail.label = "x"; },
};
const DECOY = {
  "approval on a check edge": (w, x) => { const e = pick(x.out); if (!e) return false; e.approval = true; },
  "approval on every check edge": (w, x) => { for (const e of w.edges) if (w.nodes.find((n) => n.id === e.from)?.kind === "check") e.approval = true; },
  "more evidence on a check edge": (w, x) => { const e = pick(x.out); if (!e) return false; e.evidence = [...(e.evidence ?? []), "the full log"]; },
  "cap lowered": (w, x) => { const cap = pick(w.loops)?.stops.find((st) => st.kind === "max-iterations"); if (!cap || cap.n < 2) return false; cap.n -= 1; },
  "an existing critic listed in its loop": (w, x) => { const l = x.loops[0]; const cr = w.nodes.find((n) => isCritic(n) && !l?.members.includes(n.id)); if (!l || !cr) return false; l.members.push(cr.id); },
  "an existing critic listed in every loop": (w, x) => { const cr = w.nodes.find(isCritic); if (!cr) return false; for (const l of w.loops) if (!l.members.includes(cr.id)) l.members.push(cr.id); },
  "a node made a critic": (w, x) => { const a = pick(w.nodes.filter((n) => n.kind === "agent" && !isCritic(n))); if (!a) return false; a.role = "critic"; },
  "target of a check edge made a critic": (w, x) => { const a = pick(x.out.map((e) => w.nodes.find((n) => n.id === e.to)).filter((n) => n?.kind === "agent" && !isCritic(n))); if (!a) return false; a.role = "critic"; },
  "human stop added": (w, x) => { const l = pick(w.loops); if (!l) return false; l.stops.push({ kind: "human", every: 2 }); },
  "mode set": (w, x) => { const l = pick(w.loops); if (!l) return false; l.mode = l.bar ? "judgment" : "grind"; },
  "a gate's prompt reworded": (w, x) => { const gt = w.nodes.find((n) => n.kind === "human-gate"); if (!gt) return false; gt.prompt += " Please."; },
  "level fixed": (w, x) => { w.adaptation = "fixed"; },
};
const stat = new Map(); let counted = 0, through = 0, invalid = 0, na = 0; const examples = new Map();
for (let t = 0; t < trials; t++) {
  const src = pick(POOL); const w = clone(src.doc); const x = ctx(w);
  const wk = pick(Object.keys(WEAK)); const nDecoy = pick([0, 1, 1, 2, 2]); const ds = []; for (let i = 0; i < nDecoy; i++) ds.push(pick(Object.keys(DECOY)));
  let ok = true; try { if (WEAK[wk](w, x) === false) ok = false; for (const d of ds) if (DECOY[d](w, x) === false) ok = false; } catch { ok = false; }
  if (!ok) { na++; continue; }
  const parsed = core.parseGraphText(JSON.stringify(w)); if (!parsed.doc) { invalid++; continue; }
  const adopted = core.adoptWorkingCopy(src.doc, parsed.doc, { run: "p" }); if (!adopted.ok || errorsOf(adopted.doc).length) { invalid++; continue; }
  const chk = core.checkAdoption(src.doc, adopted.doc); counted++;
  const key = `${wk}  +  ${[...new Set(ds)].sort().join(" & ") || "(nothing)"}`; const st = stat.get(wk) ?? stat.set(wk, [0, 0]).get(wk); st[0]++;
  if (chk.refused.length === 0) { through++; st[1]++; const ex = examples.get(key) ?? examples.set(key, { n: 0, file: src.file, check: x.c.id }).get(key); ex.n++; }
}
console.log(`seed ${seed}: ${trials} trials; ${na} did not apply; ${invalid} not valid; ${counted} counted; THROUGH ${through}`);
for (const [k, [n, th]] of [...stat].sort()) console.log(`  ${k.padEnd(52)} counted ${String(n).padStart(4)}  through ${th}`);
console.log("through, by weakening + decoys:"); for (const [k, ex] of [...examples].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(ex.n).padStart(3)}  ${k}   e.g. ${ex.file} (${ex.check})`);
