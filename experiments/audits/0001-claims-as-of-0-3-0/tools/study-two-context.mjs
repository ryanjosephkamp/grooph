// Audit 0001, round two, S5: what study two's sessions were told of where they were, read a second time.
// For each of the 24 runs it finds the harness's own transcripts by the scratch folder the run's record names
// (kept on the machine that ran the study, under ~/.claude/projects, not in the repository) and counts:
// the transcripts, the lines that hold the tool's name or its skill's, the builder dispatches whose prompt
// names the reviewer's held-out folder by its path or only says "held-out", the tool calls pointed at that
// folder's path, by which session made them, and a builder's calls that say the word and name no path (each
// of those was then read by hand: see the note beside this script's output). Prints counts and the names of tools and roles, no transcript text. It does not test
// whether any skill was listed to a session: it looks only for the tool's own. Calls no model, writes nothing.
//
//   cd <repository root> && node <this file>
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
const mangle = (path) => path.replace(/[^A-Za-z0-9]/g, "-");
function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, out);
    else if (entry.endsWith(".jsonl")) out.push(path);
  }
  return out;
}
const total = { runs: 0, found: 0, transcripts: 0, named: 0, skills: 0 };
const byArm = {}; const totalReach = {}; const toldAll = {};
for (const project of ["review-gate-2", "heterogeneous-critic", "taste-polish"]) {
  for (const arm of ["A", "B", "C", "D"]) for (const n of [1, 2]) {
    const dir = join("experiments/comparisons", project, `${arm}-${n}`);
    if (!existsSync(join(dir, "result.json"))) continue;
    total.runs++;
    const record = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    const scratch = record.scratch ?? record.conditions?.scratch;
    const heldOut = record.conditions?.held_out?.dir;
    const folders = existsSync(base) ? readdirSync(base).filter((d) => d === mangle(scratch) || d === mangle(`/private${scratch}`) || d.startsWith(mangle(`/private${scratch}`) + "-") ) : [];
    if (folders.length === 0) { console.log(`${project}/${arm}-${n}: no transcripts found for ${scratch ? "its scratch folder" : "a record with no scratch folder"}`); continue; }
    total.found++;
    const paths = folders.flatMap((d) => files(join(base, d)));
    // Which session a transcript is: the lead's, or a subagent's, named by the first word the lead gave its dispatch
    // (the harness keeps it beside the transcript in agent-<id>.meta.json) and sorted into the one who builds and the one who judges.
    const roleOf = (path) => {
      if (!/agent-/.test(path)) return "lead";
      const meta = path.replace(/\.jsonl$/, ".meta.json");
      const m = existsSync(meta) ? JSON.parse(readFileSync(meta, "utf8")) : {};
      // The first word the lead gave the dispatch ("Builder round 1: ..."), or the agent's own name in a package run.
      const first = String(m.description ?? "").split(/[\s:]/)[0];
      const label = /^(builder|owner|critic|reviewer|judge|red)/i.test(first) ? first : `${m.agentType ?? ""}`;
      return /builder|owner/i.test(label) ? "builder" : /critic|review|judge|red/i.test(label) ? "critic" : `unsorted(${first || m.agentType || "?"})`;
    };
    const held = heldOut ? [heldOut, heldOut.replace(/^\/private/, "")] : [];
    // The folder by its path, whole or relative: the harness folder beside the scratch project has a name of its own.
    const harness = heldOut ? heldOut.split("/").slice(-2, -1)[0] : undefined;
    const names = (text) => held.some((h) => text.includes(h)) || (harness !== undefined && text.includes(harness));
    const says = (text) => names(text) || /held-out/.test(text);
    let named = 0, skills = 0; const reach = []; const loose = []; const told = { builder: 0, critic: 0, other: 0 }; const path_ = { builder: 0, critic: 0, other: 0 }; const dispatched = { builder: 0, critic: 0, other: 0 }; const roles = {};
    for (const path of paths) {
      const role = roleOf(path); roles[role] = (roles[role] ?? 0) + 1;
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (!line) continue;
        if (/grooph/i.test(line)) named++;
        if (/grooph-design|"skill_listing"/.test(line)) skills++;
        let entry; try { entry = JSON.parse(line); } catch { continue; }
        for (const part of Array.isArray(entry?.message?.content) ? entry.message.content : []) {
          if (part?.type !== "tool_use") continue;
          const input = part.input ?? {};
          if (part.name === "Agent" || part.name === "Task") {
            // What a dispatch told its subagent: whether the prompt names the held-out folder, by who was dispatched.
            const first = String(input.description ?? "").split(/[\s:]/)[0];
            const who = /^(builder|owner|critic|reviewer|judge|red)/i.test(first) ? first : String(input.subagent_type ?? "");
            const kind = /builder|owner/i.test(who) ? "builder" : /critic|review|judge|red/i.test(who) ? "critic" : "other";
            dispatched[kind]++;
            const prompt = String(input.prompt ?? "");
            if (names(prompt)) path_[kind]++; else if (says(prompt)) told[kind]++;
            continue;
          }
          // A reach: the folder's path where a tool is pointed (a file, a command, a pattern). A command that only
          // writes the words "held-out" into a file (a builder's account of what it fixed) names no path and is no reach.
          const pointed = ["file_path", "path", "command", "pattern", "notebook_path", "glob"].map((k) => String(input[k] ?? "")).join("\n");
          if (names(pointed)) reach.push(`${role}:${part.name}`);
          else if (role !== "critic" && role !== "lead" && says(pointed)) loose.push(`${role}:${part.name}`);
        }
      }
    }
    const tally = {}; for (const r of reach) tally[r] = (tally[r] ?? 0) + 1;
    const recorded = record.process?.tool_named_in_transcripts;
    const count = (list) => { const t = {}; for (const r of list) t[r] = (t[r] ?? 0) + 1; return Object.entries(t).map(([k, v]) => `${k} x${v}`).join(", ") || "none"; };
    console.log(`${project}/${arm}-${n}: ${paths.length} transcripts (the record says ${recorded?.transcripts ?? "?"}: ${Object.entries(roles).map(([k, v]) => `${v} ${k}`).join(", ")}); lines with the tool's name ${named}, with its skill ${skills}; of ${dispatched.builder} builder dispatches, ${path_.builder} prompts name the held-out folder's path and ${told.builder} more say "held-out"; tools pointed at the folder's path: ${count(reach)}; a builder's command or path that says "held-out" and names no path: ${count(loose)}`);
    for (const [k, v] of Object.entries(tally)) { const who = k.split(":")[0]; ((totalReach[arm] ??= {})[who] = ((totalReach[arm] ?? {})[who] ?? 0) + v); }
    const t = (toldAll[arm] ??= { dispatched: 0, path: 0, word: 0, loose: 0 }); t.dispatched += dispatched.builder; t.path += path_.builder; t.word += told.builder; t.loose += loose.length;
    total.transcripts += paths.length;
    const a = (byArm[arm] ??= { transcripts: 0, named: 0, skills: 0 });
    a.transcripts += paths.length; a.named += named; a.skills += skills;
  }
}
console.log(`\n${total.found} of ${total.runs} runs found on this machine; ${total.transcripts} transcripts`);
for (const [arm, a] of Object.entries(byArm)) console.log(`arm ${arm}: ${a.transcripts} transcripts, ${a.named} lines with the tool's name, ${a.skills} with its skill; tools pointed at the held-out folder's path by ${Object.entries(totalReach[arm] ?? {}).map(([k, v]) => `${k} x${v}`).join(", ") || "nobody"}; builder dispatches ${toldAll[arm]?.dispatched ?? 0}, of which ${toldAll[arm]?.path ?? 0} name its path and ${toldAll[arm]?.word ?? 0} say the word; a builder's command that says the word and names no path ${toldAll[arm]?.loose ?? 0}`);
const bcd = ["B", "C", "D"].reduce((s, k) => ({ t: s.t + (byArm[k]?.transcripts ?? 0), n: s.n + (byArm[k]?.named ?? 0) }), { t: 0, n: 0 });
console.log(`arms B, C and D together: ${bcd.t} transcripts, ${bcd.n} lines with the tool's name`);
