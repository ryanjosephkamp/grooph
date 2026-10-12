// Reader's script: reads (never writes) every kept session folder and lists every .claude, .grooph and .codex at ANY depth with what it holds; the runner's check looks at the top only.
//   node nested.mjs <pinned copy root> <runs' checkout root> [<profile home>]
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const [pin, runs, home = join(homedir(), "grooph-compare")] = process.argv.slice(2);
const find = (dir, from = "") => { let out = []; for (const n of readdirSync(dir).sort()) { if (n === "node_modules" || n === ".git") continue; const st = lstatSync(join(dir, n)); if (!st.isDirectory()) continue; if ([".claude", ".grooph", ".codex"].includes(n)) { const inside = (d, f = "") => readdirSync(d).sort().flatMap((m) => (lstatSync(join(d, m)).isDirectory() ? [`${f}${m}/`, ...inside(join(d, m), `${f}${m}/`)] : [`${f}${m}`])); out.push(`${from}${n}[${n === ".grooph" ? "…" : inside(join(dir, n)).join(",")}]@${st.birthtime.toISOString().slice(11, 19)}`); } else out = out.concat(find(join(dir, n), `${from}${n}/`)); } return out; };
const look = (label, resultPath, repo) => { let r; try { r = JSON.parse(readFileSync(resultPath, "utf8")); } catch { return; } const cwd = join(home, "kept", String(r.session_id), "work", repo); console.log(`${label} | subagents ${r.measures?.subagents?.count ?? r.measures?.subagents?.started ?? "?"} | ${existsSync(cwd) ? find(cwd).join("  ") || "(none)" : "NO KEPT FOLDER"}`); };
const firstRoot = join(pin, "experiments/watching");
for (const block of ["sonnet", "opus", "haiku"]) for (const task of ["four", "one"]) { const t = join(firstRoot, block, task); if (!existsSync(t)) continue; for (const run of readdirSync(t).sort()) look(`first/${block}/${task}/${run}`, join(t, run, "result.json"), task === "one" ? "printkit" : "packages"); }
const second = join(runs, "experiments/watching/second-look");
for (const block of ["opus", "sonnet"]) for (const task of existsSync(join(second, block)) ? readdirSync(join(second, block)).sort() : []) for (const run of readdirSync(join(second, block, task)).sort()) look(`second/${block}/${task}/${run}`, join(second, block, task, run, "result.json"), "packages");
