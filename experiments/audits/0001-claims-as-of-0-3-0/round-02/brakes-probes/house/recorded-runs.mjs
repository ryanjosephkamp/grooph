// Every run folder in the repository (a source graph beside runs/<id>/graph.grooph.json): what adoption's check says.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const core = await import(`${root}/packages/core/dist/src/index.js`);
const runs = [];
const skip = new Set(["node_modules", ".git", "dist", "test-results", ".claude"]);
const sourceOf = (dir) => [join(dir, "graph.grooph.json"), join(dir, "package", "graph.grooph.json")].find((p) => existsSync(p));
const walk = (dir) => { for (const name of readdirSync(dir)) { if (skip.has(name)) continue; const p = join(dir, name); if (!statSync(p).isDirectory()) continue; if (name === "runs") { for (const id of readdirSync(p)) if (existsSync(join(p, id, "graph.grooph.json"))) runs.push([join(p, id), sourceOf(dir)]); } else walk(p); } };
walk(root);
let ok = 0, refusedByValidator = 0, loosened = 0, tightened = 0, changed = 0, unreadable = 0;
let noSource = 0;
for (const [run, sourcePath] of runs.sort()) {
  if (!sourcePath) { noSource += 1; console.log(`  no source beside it: ${relative(root, run)}`); continue; }
  const read = (p) => { try { return core.parseGraphText(readFileSync(p, "utf8")).doc; } catch { return undefined; } };
  const source = read(sourcePath), working = read(join(run, "graph.grooph.json"));
  if (!source || !working) { unreadable += 1; continue; }
  const adopted = core.adoptWorkingCopy(source, working, { run: "r" });
  if (!adopted.ok) { refusedByValidator += 1; console.log(`  refused by the validator: ${relative(root, run)}`); continue; }
  const check = core.checkAdoption(source, adopted.doc);
  ok += 1;
  if (check.changes.length > 0) changed += 1;
  if (check.changes.some((c) => c.tightens)) { tightened += 1; console.log(`  tightens: ${relative(root, run)}: ${check.changes.filter((c) => c.tightens).map((c) => `${c.name} (undoing it: ${c.tightens})`).join("; ")}`.slice(0, 400)); }
  if (check.notices.length > 0) console.log(`  NOTE: ${relative(root, run)}: ${check.notices.join(" | ")}`.slice(0, 300)); if (check.refused.length > 0) { loosened += 1; console.log(`  LOOSENS: ${relative(root, run)}: ${check.refused.map((c) => `${c.name}: ${c.loosens}`).join(" | ")}`.slice(0, 600)); }
}
console.log(`${runs.length} run folders; ${noSource} with no source beside them; ${unreadable} unreadable; ${refusedByValidator} refused by the validator; of the other ${ok}: ${changed} changed their working copy, ${tightened} tightened a brake, ${loosened} would be refused for loosening one`);
