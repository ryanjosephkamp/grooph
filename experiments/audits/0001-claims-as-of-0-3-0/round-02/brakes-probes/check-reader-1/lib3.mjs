// Third reader's helpers: a pool of starting graphs and an oracle of its own for "the check's pass matters less".
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
export * from "../adopt-reader-2/plib.mjs";
import { R, core, errorsOf, clone } from "../adopt-reader-1/lib.mjs";

const empty = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Hold a fragment.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] });
export function pool() {
  const out = [];
  for (const dir of ["patterns", "fixtures/valid"]) for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
    const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8"));
    if (!parsed.doc) continue;
    let d = parsed.doc;
    try {
      if (d.template) {
        const values = Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example ?? "x"]));
        if (d.template.kind === "fragment") d = core.insertFragment(empty(), d, { values }).doc;
        else { const o = core.instantiate(d, { name: d.name, values }); d = o.doc ?? o; }
      }
      d = core.parseGraphText(core.canonicalize(d)).doc;
    } catch (e) { continue; }
    if (!d || errorsOf(d).length) continue;
    if (!d.nodes.some((n) => n.kind === "check")) continue;
    out.push({ file: `${dir}/${f}`, doc: d });
  }
  return out;
}

export const whenOf = (e) => (typeof e.when === "object" ? e.when.verdict : (e.when ?? "always"));
const critics = (d) => new Set(d.nodes.filter((n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role)).map((n) => n.id));
/** Ways a run can go while the check `c` never passes. persons: whether a way a person opens counts as open. */
export function neverPass(d, c, persons) {
  const kind = new Map(d.nodes.map((n) => [n.id, n.kind]));
  const back = new Set(d.loops.flatMap((l) => l.back));
  const ways = [];
  for (const e of d.edges) {
    if (e.from === c && whenOf(e) === "pass") continue;
    if (!persons && (e.approval === true || kind.get(e.from) === "human-gate")) continue;
    ways.push([e.from, e.to]);
  }
  const cr = critics(d);
  for (const l of d.loops) for (const s of l.stops) {
    if (s.then === undefined) continue;
    if (s.kind === "bar-passed") { const cs = l.members.filter((m) => cr.has(m)); const judges = cs.length ? cs : l.members.filter((m) => kind.get(m) === "check"); if (judges.includes(c)) continue; }
    if (!persons && s.kind === "human") continue;
    for (const m of l.members) ways.push([m, s.then]);
  }
  const starts = d.nodes.filter((n) => !d.edges.some((e) => e.to === n.id && !back.has(e.id))).map((n) => n.id);
  const seen = new Set(starts); const q = [...starts];
  while (q.length) { const id = q.pop(); for (const [f, t] of ways) if (f === id && !seen.has(t)) { seen.add(t); q.push(t); } }
  return seen;
}
const success = (n) => n.kind === "stop" && (n.outcome ?? "success") === "success";
/** What a run reaches, or ends at in success, with the check never passing, that it did not before. */
export function loosened(before, after, c, persons) {
  const was = neverPass(before, c, true); // before: generous (anything a person could open counts as reached)
  const now = neverPass(after, c, persons);
  const known = new Set(before.nodes.map((n) => n.id));
  const opened = [...now].filter((id) => known.has(id) && !was.has(id));
  const endedWas = before.nodes.some((n) => success(n) && was.has(n.id));
  const endsNow = after.nodes.filter((n) => success(n) && now.has(n.id)).map((n) => n.id);
  const out = [];
  if (opened.length) out.push(`reaches ${opened.join(",")} with ${c} never passing`);
  if (!endedWas && endsNow.length) out.push(`ends in success at ${endsNow.join(",")} with ${c} never passing`);
  return out;
}
export function tryIt(source, change, allow = []) {
  const working = clone(source);
  if (change(working) === false) return undefined;
  const parsed = core.parseGraphText(JSON.stringify(working));
  if (!parsed.doc) return { ok: false, why: "schema" };
  const adopted = core.adoptWorkingCopy(source, parsed.doc, { run: "probe" });
  if (!adopted.ok) return { ok: false, why: "invalid: " + adopted.issues.map((i) => i.code).join(",") };
  if (errorsOf(adopted.doc).length) return { ok: false, why: "invalid after: " + errorsOf(adopted.doc).map((i) => i.code).join(",") };
  const check = core.checkAdoption(source, adopted.doc, { allow });
  return { ok: true, doc: adopted.doc, check, refused: check.refused.map((c) => `${c.name}: ${c.loosens}`), names: check.refused.map((c) => c.name), changes: check.changes.map((c) => c.name), tight: check.changes.filter((c) => c.tightens).map((c) => `${c.name}: ${c.tightens}`) };
}
