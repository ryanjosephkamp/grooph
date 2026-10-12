// Reader's script: reads (never writes) every kept session folder of the first check and the second look and prints what .claude holds and what inTheSessionsFolder says of it.
//   node kept-folders.mjs <pinned copy root> <runs' checkout root> [<profile home>]
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const [pin, runs, home = join(homedir(), "grooph-compare")] = process.argv.slice(2);
const runner = await import(join(pin, "scripts/lib/watching-second-look-paid.mjs"));
const walk = (dir, from = "") => { let out = []; for (const n of readdirSync(dir).sort()) { const st = lstatSync(join(dir, n)); out.push(`${from}${n}${st.isDirectory() ? "/" : st.isSymbolicLink() ? "@" : ` (${st.size}b)`}`); if (st.isDirectory()) out = out.concat(walk(join(dir, n), `${from}${n}/`)); } return out; };
const rows = [];
const look = (label, resultPath, repo) => {
  let r; try { r = JSON.parse(readFileSync(resultPath, "utf8")); } catch { return; }
  const cwd = join(home, "kept", String(r.session_id), "work", repo);
  if (!existsSync(cwd)) { rows.push([label, r.session_id?.slice(0, 8), "NO KEPT FOLDER", "", r.harness?.version ?? ""]); return; }
  const claude = join(cwd, ".claude");
  const holds = existsSync(claude) ? walk(claude).join(" ") || "(empty)" : "(no .claude)";
  const says = runner.inTheSessionsFolder(cwd);
  rows.push([label, r.session_id.slice(0, 8), holds, JSON.stringify(says), JSON.stringify(r.harness ?? null).slice(0, 60), existsSync(join(cwd, ".grooph")) ? ".grooph" : ""]);
};
const firstRoot = join(pin, "experiments/watching");
for (const block of ["sonnet", "opus", "haiku"]) for (const task of existsSync(join(firstRoot, block)) ? readdirSync(join(firstRoot, block)).sort() : []) { const t = join(firstRoot, block, task); if (!lstatSync(t).isDirectory()) continue; for (const run of readdirSync(t).sort()) look(`first/${block}/${task}/${run}`, join(t, run, "result.json"), task === "one" ? "printkit" : "packages"); }
const second = join(runs, "experiments/watching/second-look");
for (const block of ["opus", "sonnet"]) for (const task of existsSync(join(second, block)) ? readdirSync(join(second, block)).sort() : []) for (const run of readdirSync(join(second, block, task)).sort()) look(`second/${block}/${task}/${run}`, join(second, block, task, run, "result.json"), "packages");
for (const row of rows) console.log(row.join(" | "));
console.log(`${rows.length} rows; with .cc-writes empty: ${rows.filter((r) => /"the_harnesss":\["/.test(r[3])).length}; with not_known: ${rows.filter((r) => /"not_known":\["/.test(r[3])).length}; no .claude: ${rows.filter((r) => r[2] === "(no .claude)").length}; no kept: ${rows.filter((r) => r[2] === "NO KEPT FOLDER").length}`);
