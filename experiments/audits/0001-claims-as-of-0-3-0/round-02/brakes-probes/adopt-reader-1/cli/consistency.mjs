/**
 * The command against core, in process, on fuzzed working copies: exit 0 with --write iff core's `refused` is empty;
 * a file is written iff exit 0; the dry run writes nothing; nothing throws. node R/probe/cli/consistency.mjs [seed=7] [trials=400]
 * Also: --into the source file (what the last line says), and one false refusal shown in full.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { R, SCRATCH, core, clone, errorsOf, load, N, L } from "../lib.mjs";
const { run } = await import(join(R, "packages/cli/dist/src/index.js"));
const seed = Number(process.argv[2] ?? 7), trials = Number(process.argv[3] ?? 400);
let s = seed >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const pool = [];
for (const dir of ["fixtures/valid", "patterns"]) for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
  const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8")); if (!parsed.doc) continue; let d = parsed.doc;
  if (d.template) { try { const out = core.instantiate(d, { name: d.name, values: Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example])) }); d = out.doc ?? out; } catch { continue; } }
  if (errorsOf(d).length === 0) pool.push(d);
}
// crude mutations, any mix: the point is variety, not a known answer
const MUT = [
  (d) => { const l = pick(d.loops); if (l) for (const x of l.stops) { if (x.kind === "max-iterations") x.n += rnd() < 0.5 ? 7 : -1; if (x.kind === "budget") x.limit = Math.max(0, x.limit + (rnd() < 0.5 ? 9 : -2)); } },
  (d) => { const e = pick(d.edges); if (e) e.approval = !e.approval; },
  (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent")); if (n) n.brief += " x"; },
  (d) => { const g = pick(d.nodes.filter((n) => n.kind === "human-gate" && n.options)); if (g) g.options.pop(); },
  (d) => { const l = pick(d.loops); if (l?.bar) l.bar.acceptance += " And more."; },
  (d) => { const n = pick(d.nodes.filter((n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role))); if (n) n.role = "tester"; },
  (d) => { d.policies = (d.policies ?? []).slice(1); },
  (d) => { d.adaptation = pick(["fixed", "propose", "adaptive"]); },
  (d) => { const a = pick(d.nodes), b = pick(d.nodes); if (a && b && a !== b) d.edges.push({ id: `e-x-${Math.floor(rnd() * 1e6)}`, from: a.id, to: b.id }); },
  (d) => { const l = pick(d.loops); if (l) l.stops.unshift({ kind: "budget", measure: "minutes", limit: 0, then: pick(l.members) }); },
];
const io = () => { const o = { stdout: [], stderr: [] }; return { ...o, out: (t) => void o.stdout.push(t), err: (t) => void o.stderr.push(t) }; };
const root = join(SCRATCH, "adopt-reader-1/cli/consistency"); rmSync(root, { recursive: true, force: true });
let ran = 0, invalid = 0, mismatch = 0, thrown = 0, dryWrote = 0, wroteOnRefusal = 0, refusedCount = 0;
for (let t = 0; t < trials; t++) {
  const source = clone(pick(pool)); const working = clone(source);
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) pick(MUT)(working);
  const parsed = core.parseGraphText(JSON.stringify(working)); if (!parsed.doc) continue;
  const adopted = core.adoptWorkingCopy(source, parsed.doc, { run: "r1" });
  const dir = join(root, String(t)); const gd = join(dir, ".grooph", source.id); const rd = join(gd, "runs", "r1"); mkdirSync(rd, { recursive: true });
  writeFileSync(join(gd, "graph.grooph.json"), core.canonicalize(source)); writeFileSync(join(rd, "graph.grooph.json"), core.canonicalize(parsed.doc));
  const target = join(dir, ".grooph", "graphs", `${source.id}.grooph.json`);
  try {
    const dry = await run(["adopt", rd], io(), () => "", { openUrl: async () => {} });
    if (existsSync(target)) dryWrote++;
    const wet = await run(["adopt", rd, "--write"], io(), () => "", { openUrl: async () => {} });
    if (!adopted.ok) { invalid++; if (wet === 0 || existsSync(target)) mismatch++; continue; }
    ran++;
    const refused = core.checkAdoption(source, adopted.doc, {}).refused.length > 0;
    if (refused) refusedCount++;
    if ((wet === 0) === refused) mismatch++;
    if (refused && existsSync(target)) wroteOnRefusal++;
    if (!refused && (!existsSync(target) || readFileSync(target, "utf8") !== core.canonicalize(adopted.doc))) mismatch++;
  } catch (e) { thrown++; console.log("THREW", String(e.stack).split("\n").slice(0, 3).join(" | ")); }
}
console.log(`seed ${seed}: ${ran} valid working copies through the command (${refusedCount} refused, ${ran - refusedCount} written), ${invalid} invalid ones; exit code or file disagrees with core: ${mismatch}; written on a refusal: ${wroteOnRefusal}; dry run wrote: ${dryWrote}; thrown: ${thrown}`);

// --into the source file: what the command says
{
  const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
  const dir = join(root, "into-source"); const gd = join(dir, ".grooph", base.id); const rd = join(gd, "runs", "r1"); mkdirSync(rd, { recursive: true });
  const w = clone(base); N(w, "plan").brief += " Keep it short.";
  writeFileSync(join(gd, "graph.grooph.json"), core.canonicalize(base)); writeFileSync(join(rd, "graph.grooph.json"), core.canonicalize(w));
  const o = io(); const code = await run(["adopt", rd, "--write", "--into", join(gd, "graph.grooph.json")], o, () => "", { openUrl: async () => {} });
  console.log(`\n--into <the source file>: exit ${code}; source is now version ${core.parseGraphText(readFileSync(join(gd, "graph.grooph.json"), "utf8")).doc.version}\n  ${o.stdout.filter((l) => /wrote|unchanged/.test(l)).join("\n  ").replaceAll(dir, "<project>")}`);
}
// a false refusal, in full: a back edge of two loops given another id
{
  for (const d of pool) {
    const shared = d.edges.find((e) => d.loops.filter((l) => l.back.includes(e.id)).length >= 1 && d.loops.length >= 2 && d.loops.some((l) => !l.back.includes(e.id) && l.members.includes(e.from) && l.members.includes(e.to)));
    if (!shared) continue;
    const w = clone(d); const e = w.edges.find((x) => x.id === shared.id); e.id = `${shared.id}-b`; for (const l of w.loops) l.back = l.back.map((b) => (b === shared.id ? e.id : b));
    const a = core.adoptWorkingCopy(d, core.parseGraphText(JSON.stringify(w)).doc, {}); if (!a.ok) continue;
    const c = core.checkAdoption(d, a.doc, {});
    if (c.refused.length) { console.log(`\nfalse refusal on ${d.id}: the back edge "${shared.id}" given another id and nothing else\n  ${c.refused.map((x) => `${x.name}: ${x.loosens}`).join("\n  ")}`); break; }
  }
}
