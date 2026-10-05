// Audit 0001, claims C12, C15 and C17: what named grooph to the sessions of study one's prompt arms.
// Reads the harness's own transcripts of those sessions, which are kept on the machine that ran the study
// (~/.claude/projects/*grooph-compare-*), not in the repository. Counts lines; prints no transcript text.
// Calls no model, writes nothing. On another machine it finds no folders and says so.
//
//   node <this file>
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
const folders = existsSync(base) ? readdirSync(base).filter((d) => /grooph-compare-.+-[ABC]-\w+$/.test(d)).sort() : [];
if (folders.length === 0) { console.log(`no transcripts of study one under ${base}: this is not the machine that ran it`); process.exit(0); }

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, out);
    else if (entry.endsWith(".jsonl")) out.push(path);
  }
  return out;
}

const SKILL = "grooph-design";
const REMOVED = "remove the package: this arm runs on the derived prompt alone";
const PACKAGE = "task and the grooph package for";
const USER = "Git user: grooph prove";

function scan(paths) {
  const seen = { skill: 0, removed: 0, pkg: 0, gitUser: 0, ranGrooph: 0, usedSkill: 0 };
  for (const path of paths) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.includes(SKILL)) seen.skill++;
      if (line.includes(REMOVED)) seen.removed++;
      if (line.includes(PACKAGE)) seen.pkg++;
      if (line.includes(USER)) seen.gitUser++;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      for (const part of Array.isArray(entry?.message?.content) ? entry.message.content : []) {
        if (part?.type !== "tool_use") continue;
        if (part.name === "Bash" && /(^|[\s;&|(])grooph(\s|$)/.test(String(part.input?.command ?? ""))) seen.ranGrooph++;
        if (part.name === "Skill") seen.usedSkill++;
      }
    }
  }
  return seen;
}

const rows = folders.map((folder) => {
  const [, project, arm] = folder.match(/grooph-compare-(.+)-([ABC])-\w+$/);
  const all = files(join(base, folder));
  const isSub = (p) => p.split("/").pop().startsWith("agent-");
  return { project, arm, lead: scan(all.filter((p) => !isSub(p))), subs: scan(all.filter(isSub)) };
});
const count = (list, test) => list.filter(test).length;
for (const [name, list] of [["Prompt arms (B and C)", rows.filter((r) => r.arm !== "A")], ["Graph arm (A)", rows.filter((r) => r.arm === "A")]]) {
  console.log(`${name}: ${list.length} runs.`);
  console.log(`  lead session shown the skill's name (${SKILL}): ${count(list, (r) => r.lead.skill > 0)}`);
  console.log(`  lead session shown the commit "${REMOVED}": ${count(list, (r) => r.lead.removed > 0)}`);
  console.log(`  lead session shown the commit "${PACKAGE} …": ${count(list, (r) => r.lead.pkg > 0)}`);
  console.log(`  lead session shown "${USER}": ${count(list, (r) => r.lead.gitUser > 0)}`);
  console.log(`  runs whose subagents were shown the skill's name: ${count(list, (r) => r.subs.skill > 0)}; either commit: ${count(list, (r) => r.subs.removed + r.subs.pkg > 0)}`);
  console.log(`  runs in which any session ran the grooph command: ${count(list, (r) => r.lead.ranGrooph + r.subs.ranGrooph > 0)}; used the Skill tool: ${count(list, (r) => r.lead.usedSkill + r.subs.usedSkill > 0)}`);
}
