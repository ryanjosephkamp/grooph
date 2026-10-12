// Reader's script: reads (never writes, no git) every kept session folder of both checks and prints what pin2's inTheSessionsFolder says of each, with whether that is what its arm should give.
//   node kept2.mjs <pin2> <runs' checkout> [<profile home>]
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const [pin, runs, home = join(homedir(), "grooph-compare")] = process.argv.slice(2);
const runner = await import(join(pin, "scripts/lib/watching-second-look-paid.mjs"));
let n = 0, alarms = 0, misses = 0; const top = { with: 0, without: [] }; const below = []; const byArm = {};
const look = (label, arm, resultPath, repo) => {
  let r; try { r = JSON.parse(readFileSync(resultPath, "utf8")); } catch { return; }
  const cwd = join(home, "kept", String(r.session_id), "work", repo);
  if (!existsSync(cwd)) { console.log(`${label}: NO KEPT FOLDER`); return; }
  n += 1;
  const t0 = Date.now(); const f = runner.inTheSessionsFolder(cwd); const ms = Date.now() - t0;
  const installed = arm !== "plain" && arm !== "outside";
  const want = installed ? [".claude/settings.json", ".grooph"] : [];
  const ok = JSON.stringify([...f.of_an_install].sort()) === JSON.stringify(want) && f.not_known.length === 0;
  if (!ok && !installed) alarms += 1; if (!ok && installed) misses += 1;
  if (f.the_harnesss.includes(".claude/.cc-writes")) { top.with += 1; byArm[arm] = (byArm[arm] ?? 0) + 1; } else top.without.push(label);
  if (f.the_harnesss.some((p) => p !== ".claude/.cc-writes")) below.push(`${label}(${f.the_harnesss.length - (f.the_harnesss.includes(".claude/.cc-writes") ? 1 : 0)})`);
  console.log(`${ok ? "as its arm should" : "NOT AS EXPECTED "} | ${label} | install ${JSON.stringify(f.of_an_install)} not_known ${JSON.stringify(f.not_known)} harness's ${f.the_harnesss.length} | ${ms}ms | ${r.harness?.version ?? ""}`);
};
const firstRoot = join(pin, "experiments/watching");
for (const block of ["sonnet", "opus", "haiku"]) for (const task of ["four", "one"]) { const t = join(firstRoot, block, task); if (!existsSync(t)) continue; for (const run of readdirSync(t).sort()) if (lstatSync(join(t, run)).isDirectory()) look(`first/${block}/${task}/${run}`, run.split("-")[0], join(t, run, "result.json"), task === "one" ? "printkit" : "packages"); }
const second = join(runs, "experiments/watching/second-look");
for (const block of ["opus", "sonnet"]) for (const task of existsSync(join(second, block)) ? readdirSync(join(second, block)).sort() : []) for (const run of readdirSync(join(second, block, task)).sort()) look(`second/${block}/${task}/${run}`, run.split("-")[0], join(second, block, task, run, "result.json"), "packages");
console.log(`${n} kept folders; false alarms in plain/outside: ${alarms}; installs not seen as installs: ${misses}`);
console.log(`at the top: ${top.with} (${JSON.stringify(byArm)}); without: ${top.without.join(", ")}`);
console.log(`below the top: ${below.length}: ${below.join(", ")}`);
