// What a refresh does outside the subgrooph, over random newer versions, on a graph with things of its own in and around the box.
import { host, values, tpl, placeSubgrooph, refreshSubgrooph, agent, TemplateError, canonicalize } from "./h2.mjs";
import { readFileSync } from "node:fs";
// reuse the mutation pool of fuzz.mjs by evaluating its source up to the cases
const src = readFileSync(new URL("./fuzz.mjs", import.meta.url), "utf8");
const pool = src.slice(src.indexOf("// ── mutations of a template ──"), src.indexOf("// ── the graphs to refresh ──"));
let seed = Number(process.argv[2] ?? 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;
const { M, kinds } = new Function("rnd", "pick", "chance", "agent", `${pool}; return { M, kinds };`)(rnd, pick, chance, agent);

const rich = () => {
  const d = placeSubgrooph(host(), tpl(), { as: "s", values, after: "plan", then: "release" }).doc;
  d.nodes.push(agent("security", "critic", "SECURITY.md"), { id: "recheck", kind: "check", name: "Recheck", check: { kind: "command", run: "pnpm test", pass: "exit 0" } }, agent("audit", "researcher", "AUDIT.md"));
  d.edges.push({ id: "e-s-builder-security", from: "s-builder", to: "security", evidence: ["diff"] }, { id: "e-security-s-merge-gate", from: "security", to: "s-merge-gate", when: "pass" },
    { id: "e-release-recheck", from: "release", to: "recheck" }, { id: "e-recheck-s-builder", from: "recheck", to: "s-builder", when: "fail" }, { id: "e-s-critic-audit", from: "s-critic", to: "audit", when: { verdict: "invalid-evidence" } });
  d.loops.push({ id: "redo", name: "Redo", members: ["s-builder", "s-critic", "s-merge-gate", "release", "recheck"], back: ["e-recheck-s-builder"], stops: [{ kind: "max-iterations", n: 2 }, { kind: "budget", measure: "dispatches", limit: 30 }] });
  d.policies.push({ id: "p-cap", kind: "concurrency-cap", scope: "graph", params: { max: 2 } });
  d.groups.find((g) => g.id === "s").members.push("security");
  d.groups.push({ id: "delivery", name: "Delivery", members: ["s", "release"] });
  d.layout = { plan: { x: 0, y: 0 }, "s-builder": { x: 1, y: 1 } };
  return d;
};
const mineId = (id) => id === "s" || id.startsWith("s-");
const found = new Map();
let ran = 0;
for (let trial = 0; trial < Number(process.argv[3] ?? 3000); trial += 1) {
  const before = rich();
  const t2 = tpl(); t2.version = 2;
  const muts = [];
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i += 1) { let said; try { said = M[pick(kinds)](t2); } catch { said = undefined; } if (said) muts.push(said); }
  if (!muts.length) continue;
  let r;
  try { r = refreshSubgrooph(before, "s", t2); } catch (e) { if (!(e instanceof TemplateError)) found.set(`CRASH ${e.constructor.name}`, { n: 1, ex: { muts, what: e.message } }); else { const k = `TemplateError: ${e.message.replace(/"[^"]*"/g, '"…"').slice(0, 90)}`; const p = found.get(k); if (p) p.n += 1; else found.set(k, { n: 1, ex: { muts, what: e.message } }); } continue; }
  ran += 1;
  const A = r.doc, notes = r.notes.join("\n");
  const out = [];
  const exitTo = new Set(before.edges.filter((e) => mineId(e.from) && e.to === "release").map((e) => e.id));
  const cmp = (key, isHost, noted) => {
    const a = new Map((A[key] ?? []).map((o) => [o.id, o]));
    for (const o of before[key] ?? []) { if (!isHost(o)) continue; const now = a.get(o.id); if (JSON.stringify(now) === JSON.stringify(o)) continue; if (noted(o, now)) continue; out.push(`${key.slice(0, -1)} of the graph's own ${now ? "changed" : "removed"}, no note: ${o.id}${now ? ` ${JSON.stringify(o)} => ${JSON.stringify(now)}` : ""}`); }
  };
  cmp("nodes", (n) => !mineId(n.id), () => false);
  cmp("edges", (e) => !(mineId(e.from) && mineId(e.to)) && !exitTo.has(e.id) && !e.id.startsWith("s-"), (e) => notes.includes(`edge "${e.id}"`));
  cmp("loops", (l) => !mineId(l.id), (l) => notes.includes(`loop "${l.id}"`));
  cmp("policies", (p) => !mineId(p.id), () => false);
  cmp("groups", (g) => g.id !== "s", (g, now) => now && JSON.stringify({ ...now, members: [] }) === JSON.stringify({ ...g, members: [] }) && now.members.every((m) => g.members.includes(m)));
  for (const key of ["grooph", "id", "name", "version", "goal", "target", "description", "layout", "notes", "constraints", "adaptation", "lineage"]) if (JSON.stringify(before[key]) !== JSON.stringify(A[key])) out.push(`top-level ${key} changed`);
  // dangling names left behind in the graph's own objects, with no note
  const ids = new Set(A.nodes.map((n) => n.id));
  for (const key of Object.keys(A.layout ?? {})) if (!ids.has(key)) out.push(`layout keeps a node that is gone`);
  for (const sig of out) { const k = sig.replace(/: .*/, "").replace(/s-[a-z0-9-]+/g, "s-…"); const p = found.get(k); if (!p || muts.length < p.ex.muts.length) found.set(k, { n: (p?.n ?? 0) + 1, ex: { muts, what: sig, notes: r.notes } }); else p.n += 1; }
}
console.log(`${ran} refreshed`);
for (const [k, { n, ex }] of [...found].sort()) console.log(`\n${k} (x${n})\n  newer version: ${ex.muts.join(" ; ")}\n  -> ${String(ex.what).slice(0, 400)}${ex.notes?.length ? `\n  notes: ${JSON.stringify(ex.notes)}` : ""}`);
