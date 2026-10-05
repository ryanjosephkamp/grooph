// A fuzzer: random "newer versions" of built-in templates, refreshed with no allow, checked by an oracle of my own.
import { host, values, tpl, pattern, examples, placeSubgrooph, refreshSubgrooph, validate, parseGraph, canonicalize, agent, TemplateError } from "../refresh-reader-2/h2.mjs";

let seed = Number(process.argv[2] ?? 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;

// ── my own reach, written apart from reach.ts ──
function reach(doc, closed) {
  const kind = new Map(doc.nodes.map((n) => [n.id, n.kind]));
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const adj = new Map();
  const add = (a, b) => { if (kind.has(a) && kind.has(b)) (adj.get(a) ?? adj.set(a, []).get(a)).push(b); };
  for (const e of doc.edges) {
    const person = e.approval === true || kind.get(e.from) === "human-gate";
    const shut = closed === "every" ? person : closed.gate ? e.from === closed.gate : e.id === closed.approval;
    if (!shut) add(e.from, e.to);
  }
  for (const l of doc.loops) for (const s of l.stops) if (s.then !== undefined && !(closed === "every" && s.kind === "human")) for (const m of l.members) add(m, s.then);
  const seen = new Set(doc.nodes.filter((n) => !doc.edges.some((e) => e.to === n.id && !back.has(e.id)) && !(process.env.NEW_ENTRY && doc.loops.some((l) => !l.members.includes(n.id) && l.stops.some((st) => st.then === n.id)))).map((n) => n.id));
  const q = [...seen];
  while (q.length) for (const n of adj.get(q.pop()) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}

const isCritic = (n) => n?.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role);
const byId = (list) => new Map((list ?? []).map((o) => [o.id, o]));
function oracle(B, A) {
  const out = [];
  const nA = byId(A.nodes), eA = byId(A.edges), lA = byId(A.loops), pA = byId(A.policies);
  for (const n of B.nodes) {
    const a = nA.get(n.id);
    if (n.kind === "human-gate") {
      if (!a || a.kind !== "human-gate") out.push(`gate-lost:${n.id}`);
      else if ((n.options ?? []).some((o) => !(a.options ?? []).includes(o))) out.push(`gate-options:${n.id}`);
      else {
        const was = new Set(B.edges.filter((e) => e.from === n.id).map((e) => `${JSON.stringify(e.when ?? "always")}>${e.to}`));
        const now = A.edges.filter((e) => e.from === n.id).map((e) => `${JSON.stringify(e.when ?? "always")}>${e.to}`);
        const bIds = new Set(B.nodes.map((x) => x.id));
        const odd = A.edges.filter((e) => e.from === n.id && bIds.has(e.to) && !B.edges.some((b) => b.from === n.id && b.to === e.to && JSON.stringify(b.when ?? "always") === JSON.stringify(e.when ?? "always")));
        if (odd.length) out.push(`gate-answer-leads-elsewhere:${n.id}`);
      }
    }
    if (n.kind === "agent" && (n.irreversible ?? []).length && (!a || n.irreversible.some((m) => !(a.irreversible ?? []).includes(m)))) out.push(`marker-lost:${n.id}`);
    if (isCritic(n)) {
      if (!isCritic(a)) out.push(`critic-lost:${n.id}`);
      else {
        const ev = (doc) => new Set(doc.edges.filter((e) => e.to === n.id).flatMap((e) => e.evidence ?? []));
        const had = ev(B), has = ev(A);
        if ([...had].some((x) => !has.has(x))) out.push(`critic-evidence-less:${n.id}`);
        const sharedWas = new Set(B.edges.filter((e) => e.to === n.id && e.isolation === "shared").map((e) => e.from));
        if (A.edges.some((e) => e.to === n.id && e.isolation === "shared" && !sharedWas.has(e.from))) out.push(`critic-shared:${n.id}`);
        if (B.edges.some((e) => e.from === n.id && (e.when ?? "always") !== "always") && !A.edges.some((e) => e.from === n.id && (e.when ?? "always") !== "always")) out.push(`critic-verdict-undecided:${n.id}`);
        if (B.edges.some((e) => e.to === n.id) && !A.edges.some((e) => e.to === n.id)) out.push(`critic-cut-off:${n.id}`);
      }
    }
  }
  for (const e of B.edges) if (e.approval === true && eA.get(e.id)?.approval !== true) out.push(`approval-lost:${e.id}`);
  const haltsOrAsks = (doc, id) => { const n = doc.nodes.find((x) => x.id === id); return n?.kind === "human-gate" || (n?.kind === "stop" && n.outcome === "halt"); };
  const capOver = (doc, edgeId) => { // the tightest round cap among the loops that count this back edge
    const caps = doc.loops.filter((l) => l.back.includes(edgeId)).flatMap((l) => l.stops.filter((s) => s.kind === "max-iterations" && (s.then === undefined || haltsOrAsks(doc, s.then))).map((s) => s.n));
    return caps.length ? Math.min(...caps) : Infinity;
  };
  for (const l of B.loops) {
    const a = lA.get(l.id);
    if (!a) { if (l.stops.some((s) => ["max-iterations", "budget", "human"].includes(s.kind)) || l.bar) out.push(`loop-lost:${l.id}`); continue; }
    if (l.bar && (!a.bar || a.bar.acceptance !== l.bar.acceptance)) out.push(`bar:${l.id}`);
    for (const s of l.stops) {
      if (s.kind === "max-iterations") { const c = a.stops.filter((x) => x.kind === "max-iterations").map((x) => x.n); if (!c.length || Math.min(...c) > s.n) out.push(`cap:${l.id}`); }
      if (s.kind === "budget") { const c = a.stops.filter((x) => x.kind === "budget" && x.measure === s.measure).map((x) => x.limit); if (!c.length || Math.min(...c) > s.limit) out.push(`budget:${l.id}`); }
      if (s.kind === "human") { const c = a.stops.filter((x) => x.kind === "human").map((x) => x.every ?? 1); if (!c.length || Math.min(...c) > (s.every ?? 1)) out.push(`human-stop:${l.id}`); }
    }
    for (const s of a.stops) if (["max-iterations", "budget", "human"].includes(s.kind) && s.then !== undefined && !haltsOrAsks(A, s.then)) {
      const same = l.stops.filter((x) => x.kind === s.kind && x.then === s.then);
      if (!same.length) out.push(`brake-leads-on:${l.id}`);
      else if (same.length && haltsOrAsks(B, s.then)) out.push(`brake-target-no-longer-halts:${l.id}`);
    }
    for (const be of l.back) if (eA.has(be) && capOver(A, be) > capOver(B, be)) out.push(`cycle-out-from-under-cap:${be}`);
  }
  for (const p of B.policies ?? []) if (["critic-isolation", "no-self-grading", "no-live-graph-rewrite"].includes(p.kind) && JSON.stringify(pA.get(p.id)) !== JSON.stringify(p)) out.push(`policy:${p.id}`);
  const free0 = reach(A, "every"), freeB0 = reach(B, "every");
  const decisions = ["every", ...B.nodes.filter((n) => n.kind === "human-gate").map((n) => ({ gate: n.id })), ...B.edges.filter((e) => e.approval === true).map((e) => ({ approval: e.id }))];
  for (const d of decisions) {
    const was = reach(B, d), now = reach(A, d);
    const opened = B.nodes.filter((n) => nA.has(n.id) && !was.has(n.id) && now.has(n.id)).map((n) => n.id);
    if (opened.length) out.push(`opened(${d === "every" ? "every" : d.gate ?? d.approval}):${opened.join(",")}`);
  }
  for (const n of B.nodes) if (n.kind === "agent" && !nA.has(n.id) && !freeB0.has(n.id)) { const twin = A.nodes.find((x) => x.kind === "agent" && x.brief === n.brief && !byId(B.nodes).has(x.id)); if (twin && free0.has(twin.id)) out.push(`came-back-under-another-id-with-no-person:${n.id}`); }
  // an irreversible node, old or new, reached with no person at all
  const free = reach(A, "every"), freeB = reach(B, "every");
  for (const n of A.nodes) if (n.kind === "agent" && (n.irreversible ?? []).length && free.has(n.id) && !(byId(B.nodes).has(n.id) && freeB.has(n.id))) out.push(`marked-reached:${n.id}`);
  return [...new Set(out)];
}
const structural = (B, A) => {
  const p = parseGraph(JSON.parse(canonicalize(A)));
  if (!p.doc) return [`schema:${p.issues[0]?.message?.slice(0, 60)}`];
  const said = (i) => `${i.code} ${i.message}`;
  const had = new Set(validate(B).filter((i) => i.severity === "error").map(said));
  return [...new Set(validate(p.doc).filter((i) => i.severity === "error" && !had.has(said(i))).map((i) => `new-error:${i.code}`))];
};

// ── mutations of a template ──
const newId = (t, base) => { const ids = new Set([...t.nodes, ...t.edges, ...t.loops].map((o) => o.id)); let i = 2, id = base; while (ids.has(id)) id = `${base}${i++}`; return id; };
const whens = ["always", "pass", "fail", { verdict: "trivial" }];
const M = {
  brief: (t) => { const n = pick(t.nodes.filter((x) => x.kind === "agent")); if (!n) return; n.brief += " Keep it small."; return `brief ${n.id}`; },
  removeNode: (t) => { const n = pick(t.nodes); t.nodes = t.nodes.filter((x) => x !== n); const gone = new Set(t.edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => e.id)); t.edges = t.edges.filter((e) => !gone.has(e.id)); for (const l of t.loops) { l.members = l.members.filter((m) => m !== n.id); l.back = l.back.filter((b) => !gone.has(b)); l.stops = l.stops.map((s) => (s.then === n.id ? (({ then, ...r }) => r)(s) : s)); if (l.bar?.answerKeyFrom === n.id) delete l.bar.answerKeyFrom; } t.loops = t.loops.filter((l) => l.back.length && l.members.length); t.policies = (t.policies ?? []).filter((p) => p.scope !== `node:${n.id}`); return `removeNode ${n.id}`; },
  bypassNode: (t) => { const n = pick(t.nodes.filter((x) => x.kind !== "stop")); if (!n) return; const ins = t.edges.filter((e) => e.to === n.id), outs = t.edges.filter((e) => e.from === n.id); const r = M.removeNodeOf(t, n); for (const i of ins) for (const o of outs) if (i.from !== o.to && i.from !== n.id && o.to !== n.id) t.edges.push({ id: newId(t, `e-${i.from}-${o.to}`), from: i.from, to: o.to, ...(o.when ? { when: o.when } : {}) }); return `bypassNode ${n.id}`; },
  removeNodeOf: (t, n) => { t.nodes = t.nodes.filter((x) => x !== n); const gone = new Set(t.edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => e.id)); t.edges = t.edges.filter((e) => !gone.has(e.id)); for (const l of t.loops) { l.members = l.members.filter((m) => m !== n.id); l.back = l.back.filter((b) => !gone.has(b)); l.stops = l.stops.map((s) => (s.then === n.id ? (({ then, ...r }) => r)(s) : s)); if (l.bar?.answerKeyFrom === n.id) delete l.bar.answerKeyFrom; } t.loops = t.loops.filter((l) => l.back.length && l.members.length); t.policies = (t.policies ?? []).filter((p) => p.scope !== `node:${n.id}`); },
  renameNode: (t) => { const n = pick(t.nodes); const id = newId(t, `${n.id}x`); const old = n.id; n.id = id; for (const e of t.edges) { if (e.from === old) e.from = id; if (e.to === old) e.to = id; } for (const l of t.loops) { l.members = l.members.map((m) => (m === old ? id : m)); l.stops = l.stops.map((s) => (s.then === old ? { ...s, then: id } : s)); if (l.bar?.answerKeyFrom === old) l.bar.answerKeyFrom = id; } for (const p of t.policies ?? []) if (p.scope === `node:${old}`) p.scope = `node:${id}`; return `renameNode ${old}`; },
  kind: (t) => { const i = Math.floor(rnd() * t.nodes.length); const n = t.nodes[i]; const to = pick(["human-gate", "check", "agent", "stop-halt", "stop"]); const base = { id: n.id, name: n.name }; t.nodes[i] = to === "human-gate" ? { ...base, kind: "human-gate", prompt: "Go on?" } : to === "check" ? { ...base, kind: "check", check: { kind: "command", run: "make", pass: "exit 0" } } : to === "agent" ? { ...agent(n.id, "builder", "OUT.md"), name: n.name } : { ...base, kind: "stop", outcome: to === "stop" ? "success" : "halt" }; return `kind ${n.id} ${n.kind}->${to}`; },
  addNode: (t) => { const id = newId(t, pick(["lint", "smoke", "wrap", "audit"])); const k = pick(["agent", "check", "human-gate", "agent-marked"]); t.nodes.push(k === "check" ? { id, kind: "check", name: id, check: { kind: "command", run: "make", pass: "exit 0" } } : k === "human-gate" ? { id, kind: "human-gate", name: id, prompt: "Go on?" } : agent(id, "builder", `${id}.md`, k === "agent-marked" ? { irreversible: ["publish"] } : {})); const a = pick(t.nodes.filter((x) => x.kind !== "stop" && x.id !== id)), b = pick(t.nodes.filter((x) => x.id !== id)); if (a) t.edges.push({ id: newId(t, `e-${a.id}-${id}`), from: a.id, to: id }); if (b && chance(0.8)) t.edges.push({ id: newId(t, `e-${id}-${b.id}`), from: id, to: b.id }); return `addNode ${id}(${k}) ${a?.id}-> ->${b?.id}`; },
  addEdge: (t) => { const a = pick(t.nodes.filter((x) => x.kind !== "stop")), b = pick(t.nodes); if (!a || a === b) return; const w = pick(whens); t.edges.push({ id: newId(t, `x-${a.id}-${b.id}`), from: a.id, to: b.id, ...(w === "always" ? {} : { when: w }), ...(chance(0.15) ? { approval: true } : {}), ...(chance(0.15) ? { isolation: "shared" } : {}) }); return `addEdge ${a.id}->${b.id} ${JSON.stringify(w)}`; },
  removeEdge: (t) => { const e = pick(t.edges); if (!e) return; t.edges = t.edges.filter((x) => x !== e); for (const l of t.loops) l.back = l.back.filter((b) => b !== e.id); t.loops = t.loops.filter((l) => l.back.length); return `removeEdge ${e.id}`; },
  reidEdge: (t) => { const e = pick(t.edges); if (!e) return; const id = newId(t, `r-${e.id}`); for (const l of t.loops) l.back = l.back.map((b) => (b === e.id ? id : b)); const old = e.id; e.id = id; if (chance(0.5)) delete e.evidence; if (chance(0.3)) e.when = pick(whens.slice(1)); return `reidEdge ${old}`; },
  repoint: (t) => { const e = pick(t.edges); if (!e) return; const f = pick(["from", "to"]); const n = pick(t.nodes.filter((x) => f === "to" || x.kind !== "stop")); if (!n || n.id === e[f]) return; const old = e[f]; e[f] = n.id; return `repoint ${e.id}.${f} ${old}->${n.id}`; },
  when: (t) => { const e = pick(t.edges); if (!e) return; const w = pick(whens); if (w === "always") delete e.when; else e.when = w; return `when ${e.id}=${JSON.stringify(w)}`; },
  edgeField: (t) => { const e = pick(t.edges); if (!e) return; const f = pick(["approval", "isolation", "evidence"]); if (f === "approval") { if (e.approval) delete e.approval; else e.approval = true; } else if (f === "isolation") e.isolation = e.isolation === "shared" ? "fresh" : "shared"; else e.evidence = (e.evidence ?? []).slice(1); return `edgeField ${e.id}.${f}`; },
  stops: (t) => { const l = pick(t.loops); if (!l) return; const i = Math.floor(rnd() * l.stops.length); const s = l.stops[i]; const what = pick(["raise", "lower", "then", "drop", "addHuman", "unthen"]); if (what === "raise") { if (s.n) s.n += 5; else if (s.limit) s.limit *= 3; else if (s.kind === "human") s.every = (s.every ?? 1) + 3; else return; } else if (what === "lower") { if (s.n > 1) s.n -= 1; else if (s.limit > 2) s.limit -= 1; else return; } else if (what === "then") s.then = pick(t.nodes).id; else if (what === "unthen") { if (!s.then) return; delete s.then; } else if (what === "drop") { if (l.stops.length < 2) return; l.stops.splice(i, 1); } else l.stops.push({ kind: "human", every: 2 }); return `stops ${l.id}[${i}:${s.kind}] ${what}${what === "then" ? `=${s.then}` : ""}`; },
  members: (t) => { const l = pick(t.loops); if (!l) return; if (chance(0.5) && l.members.length > 2) { const m = pick(l.members); l.members = l.members.filter((x) => x !== m); return `members ${l.id} -${m}`; } const n = pick(t.nodes.filter((x) => !l.members.includes(x.id))); if (!n) return; l.members.push(n.id); return `members ${l.id} +${n.id}`; },
  back: (t) => { const l = pick(t.loops); if (!l) return; if (chance(0.5) && l.back.length > 1) { const b = pick(l.back); l.back = l.back.filter((x) => x !== b); return `back ${l.id} -${b}`; } const e = pick(t.edges.filter((x) => !l.back.includes(x.id))); if (!e) return; l.back.push(e.id); return `back ${l.id} +${e.id}`; },
  splitLoop: (t) => { const l = pick(t.loops.filter((x) => x.back.length > 1)); if (!l) return; const b = pick(l.back); l.back = l.back.filter((x) => x !== b); const e = t.edges.find((x) => x.id === b); t.loops.push({ id: newId(t, `${l.id}-b`), name: "Split", members: [...l.members], back: [b], mode: "grind", stops: [{ kind: "max-iterations", n: 5 }, { kind: "budget", measure: "minutes", limit: 30 }] }); return `splitLoop ${l.id} ${b}`; },
  removeLoop: (t) => { const l = pick(t.loops); if (!l) return; t.loops = t.loops.filter((x) => x !== l); return `removeLoop ${l.id}`; },
  bar: (t) => { const l = pick(t.loops.filter((x) => x.bar)); if (!l) return; if (chance(0.5)) l.bar.acceptance = "Looks fine."; else l.bar.inspects = [{ kind: "artifact", ref: "REVIEW.md" }]; return `bar ${l.id}`; },
  policy: (t) => { const p = pick(t.policies ?? []); if (!p) return; t.policies = t.policies.filter((x) => x !== p); return `policy -${p.id}`; },
  role: (t) => { const n = pick(t.nodes.filter((x) => x.kind === "agent")); if (!n) return; const r = pick(["builder", "tester", "critic", "judge"]); const old = n.role; n.role = r; return `role ${n.id} ${JSON.stringify(old)}->${r}`; },
  options: (t) => { const n = pick(t.nodes.filter((x) => x.kind === "human-gate" && (x.options ?? []).length > 1)); if (!n) return; n.options = n.options.slice(0, -1); return `options ${n.id}`; },
  marker: (t) => { const n = pick(t.nodes.filter((x) => x.kind === "agent")); if (!n) return; if (n.irreversible) delete n.irreversible; else n.irreversible = ["publish"]; return `marker ${n.id}`; },
  outcome: (t) => { const n = pick(t.nodes.filter((x) => x.kind === "stop")); if (!n) return; n.outcome = (n.outcome ?? "success") === "success" ? "halt" : "success"; return `outcome ${n.id}`; },
};
const kinds = Object.keys(M).filter((k) => k !== "removeNodeOf");

// ── the graphs to refresh ──
const withGate = () => { const h = host(); h.nodes.push({ id: "go", kind: "human-gate", name: "Go", prompt: "Start?" }, agent("prep", "planner", "PREP.md")); h.edges.push({ id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-prep", from: "go", to: "prep", when: "pass" }); return h; };
const withDeploy = () => { const h = host(); h.nodes.push(agent("deploy", "builder", "DEPLOY.md", { irreversible: ["deploy"] })); h.edges = h.edges.filter((e) => e.id !== "e-release-done"); h.edges.push({ id: "e-release-deploy", from: "release", to: "deploy", approval: true }, { id: "e-deploy-done", from: "deploy", to: "done" }); return h; };
const cases = [
  ["review-gate, then release", () => host(), "review-gate", { after: "plan", then: "release" }],
  ["review-gate, own stop", () => host(), "review-gate", { after: "plan" }],
  ["review-gate behind a gate of the graph's", withGate, "review-gate", { after: "prep", then: "release" }],
  ["review-gate before an approved deploy", withDeploy, "review-gate", { after: "plan", then: "release" }],
  ["human-gated-irreversible", () => host(), "human-gated-irreversible", { after: "release", then: "done" }],
  ["gauntlet-decomposed", () => host(), "gauntlet-decomposed", { after: "plan", then: "release" }],
  ["spec-then-loop", () => host(), "spec-then-loop", { after: "plan", then: "release" }],
  ["merge-queue", () => host(), "merge-queue", { after: "release", then: "done" }],
  ["grind-loop behind a gate", withGate, "grind-loop", { after: "prep", then: "release" }],
  ["debate-then-build", () => host(), "debate-then-build", { after: "plan", then: "release" }],
  ["retrospective-rewrite behind a gate", withGate, "retrospective-rewrite", { after: "prep", then: "release" }],
  ["taste-polish", () => host(), "taste-polish", { after: "plan", then: "release" }],
];
const N = Number(process.argv[3] ?? 4000);
const found = new Map();
let ran = 0, skipped = 0, threw = 0, crashed = [];
for (let trial = 0; trial < N; trial += 1) {
  const [label, mkHost, name, opts] = cases[trial % cases.length];
  const t1 = pattern(name);
  const vals = name === "review-gate" ? values : examples(t1);
  let before;
  try { before = placeSubgrooph(mkHost(), t1, { as: "s", values: vals, ...opts }).doc; } catch (e) { console.log("place fails", label, e.message); continue; }
  if (validate(before).some((i) => i.severity === "error")) { if (trial < cases.length) console.log("note: placed graph has errors:", label, validate(before).filter((i) => i.severity === "error").map((i) => i.code)); }
  const t2 = structuredClone(t1); t2.version = 2;
  const muts = [];
  const count = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i += 1) { const k = pick(kinds); let said; try { said = M[k](t2); } catch { said = undefined; } if (said) muts.push(said); }
  if (!muts.length) { skipped += 1; continue; }
  // the newer version must itself be a sound template: placed afresh in the same graph, it brings no error
  let sound = true;
  try { const freshly = placeSubgrooph(mkHost(), t2, { as: "s", values: vals, ...opts }).doc; const had = new Set(validate(mkHost()).filter((i) => i.severity === "error").map((i) => i.code)); if (!parseGraph(JSON.parse(canonicalize(freshly))).doc || validate(freshly).some((i) => i.severity === "error" && !had.has(i.code))) sound = false; } catch { sound = false; }
  let r;
  const t0 = Date.now();
  try { r = refreshSubgrooph(before, "s", t2); } catch (e) { if (e instanceof TemplateError) { threw += 1; continue; } crashed.push(`${label} | ${muts.join(" ; ")} | ${e.constructor.name}: ${e.message}`); continue; }
  if (Date.now() - t0 > 2000) crashed.push(`SLOW ${Date.now() - t0}ms ${label} | ${muts.join(" ; ")}`);
  ran += 1;
  const applied = r.changes.filter((c) => !r.held.some((h) => h.name === c.name));
  const brakes = oracle(before, r.doc);
  for (const h of r.held) { if (h.waits !== undefined) continue; const coll = h.object === "node" ? "nodes" : h.object === "edge" ? "edges" : h.object === "loop" ? "loops" : "policies"; const b = (before[coll] ?? []).find((o) => o.id === h.id), a = (r.doc[coll] ?? []).find((o) => o.id === h.id); if (h.kind === "remove" && !a) brakes.push(`held-but-gone:${h.name}`); if (h.kind === "change" && (!a || JSON.stringify(a[h.field]) !== JSON.stringify(b[h.field]))) brakes.push(`held-but-changed:${h.name}`); if (h.kind === "change" && h.object === "node" && a && a.kind !== b.kind) brakes.push(`held-field-on-a-node-of-another-kind:${h.field}`); if (h.kind === "add" && a) brakes.push(`held-but-added:${h.name}`); }
  const broke = structural(before, r.doc);
  for (const v of [...brakes.map((b) => ["BRAKE", b]), ...broke.filter(() => sound).map((b) => ["BROKEN(sound template)", b]), ...broke.filter(() => !sound && applied.length < r.changes.length).map((b) => ["BROKEN(partial, unsound template)", b])]) {
    const sig = `${v[0]} ${v[1].split(":")[0]} | held ${r.held.length ? (applied.length ? "some" : "all") : "none"}`;
    const ex = { label, muts, sound, what: v[1], held: r.held.map((h) => h.name + (h.waits ? "(waits)" : "")), applied: applied.map((c) => c.name) };
    const prev = found.get(sig);
    if (!prev || prev.n === undefined || ex.muts.length < prev.ex.muts.length) found.set(sig, { n: (prev?.n ?? 0) + 1, ex }); else prev.n += 1;
  }
}
console.log(`seed ${process.argv[2] ?? 1}: ${ran} refreshed, ${threw} refused with a TemplateError, ${skipped} skipped; crashes/slow: ${crashed.length}`);
for (const c of crashed.slice(0, 10)) console.log("  CRASH", c);
for (const [sig, { n, ex }] of [...found].sort()) console.log(`\n${sig}  (x${n})\n  ${ex.label} | sound template: ${ex.sound}\n  newer version: ${ex.muts.join(" ; ")}\n  -> ${ex.what}\n  applied: ${ex.applied.join(", ") || "-"}\n  held: ${ex.held.join(", ") || "-"}`);
