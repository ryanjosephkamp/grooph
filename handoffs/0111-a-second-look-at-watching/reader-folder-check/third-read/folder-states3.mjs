// Reader's script: makes folder states in a temp folder and prints what pin2's inTheSessionsFolder says of each; writes only under the temp folder.
//   node folder-states2.mjs <pin2>
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const r = await import(join(process.argv[2], "scripts/lib/watching-second-look-paid.mjs"));
const t = mkdtempSync(join(tmpdir(), "reader3-folder-"));
let i = 0;
const state = (name, make, after = () => {}) => { const d = join(t, `s${i += 1}`); mkdirSync(d); make(d); const f = r.inTheSessionsFolder(d); after(d); console.log(`${f.of_an_install.length + f.not_known.length === 0 ? "PASSES AS NOTHING" : "stops            "} | ${name} | ${JSON.stringify(f).slice(0, 230)}`); };
const dir = (...p) => mkdirSync(join(...p), { recursive: true });
const file = (d, p) => { dir(d, p, ".."); writeFileSync(join(d, p), "{}"); };
state("as the harness leaves it, top and packages", (d) => { dir(d, ".claude/.cc-writes"); dir(d, "csvline/.claude/.cc-writes"); });
state("csvline/.claude/settings.json", (d) => file(d, "csvline/.claude/settings.json"));
state("csvline/.grooph/events/s.jsonl", (d) => file(d, "csvline/.grooph/events/s.jsonl"));
state("csvline/.claude/.cc-writes/x", (d) => file(d, "csvline/.claude/.cc-writes/x"));
state(".codex/hooks.json", (d) => file(d, ".codex/hooks.json"));
state(".codex/config.toml only", (d) => file(d, ".codex/config.toml"));
state(".codex a LINK to a folder holding hooks.json", (d) => { file(d, "elsewhere/hooks.json"); symlinkSync(join(d, "elsewhere"), join(d, ".codex")); });
state(".Claude/settings.json (capital C; one folder with .claude on this disk)", (d) => file(d, ".Claude/settings.json"));
state(".GROOPH/events/s.jsonl (capitals)", (d) => file(d, ".GROOPH/events/s.jsonl"));
state(".Codex/hooks.json (capital C)", (d) => file(d, ".Codex/hooks.json"));
state("node_modules/.grooph and csvline/node_modules/x/.claude/settings.json", (d) => { file(d, "node_modules/.grooph/x"); file(d, "csvline/node_modules/x/.claude/settings.json"); });
state("a folder named .git below the top holding .grooph", (d) => file(d, "csvline/.git/.grooph/x"));
state("a link to a folder that holds .grooph", (d) => { file(d, "real/.grooph/x"); rmSync(join(d, "real/.grooph"), { recursive: true }); dir(t, "outside-it/.grooph"); symlinkSync(join(t, "outside-it"), join(d, "linked")); });
state("a package folder that cannot be read", (d) => { dir(d, "csvline/src"); chmodSync(join(d, "csvline"), 0o000); }, (d) => chmodSync(join(d, "csvline"), 0o755));
state(".claude/worktrees/agent-1/… (a subagent given a worktree)", (d) => { dir(d, ".claude/.cc-writes"); file(d, ".claude/worktrees/agent-1/csvline/package.json"); });
state(".claude/.cc-writes empty, .claude/.DS_Store", (d) => { dir(d, ".claude/.cc-writes"); file(d, ".claude/.DS_Store"); });
state("an empty .claude in a package", (d) => dir(d, "csvline/.claude"));
state(".grooph that is a file", (d) => file(d, "textwrap/.grooph"));
state("grooph-event.mjs and watched.json loose in a package (no .grooph)", (d) => { file(d, "csvline/hooks/grooph-event.mjs"); file(d, "watched.json"); });
rmSync(t, { recursive: true });
// More states, added for the third read (f637251d): other casings inside the folders, and a .codex that is no folder.
{
  const t2 = mkdtempSync(join(tmpdir(), "reader3-folder-more-"));
  let j = 0;
  const state2 = (name, make) => { const d = join(t2, `s${j += 1}`); mkdirSync(d); make(d); const f = r.inTheSessionsFolder(d); console.log(`${f.of_an_install.length + f.not_known.length === 0 ? "PASSES AS NOTHING" : "stops            "} | ${name} | ${JSON.stringify(f).slice(0, 230)}`); };
  const dir2 = (...p) => mkdirSync(join(...p), { recursive: true });
  const file2 = (d, p) => { dir2(d, p, ".."); writeFileSync(join(d, p), "{}"); };
  state2(".claude/SETTINGS.LOCAL.JSON", (d) => file2(d, ".claude/SETTINGS.LOCAL.JSON"));
  state2(".CODEX/Hooks.JSON", (d) => file2(d, ".CODEX/Hooks.JSON"));
  state2(".codex that is a file", (d) => file2(d, ".codex"));
  state2(".Claude/.CC-Writes empty (the harness's, another casing)", (d) => dir2(d, ".Claude/.CC-Writes"));
  state2(".Claude/.CC-Writes with a file", (d) => file2(d, ".Claude/.CC-Writes/x"));
  state2("Node_Modules/.grooph (not looked in, whatever its case)", (d) => file2(d, "Node_Modules/.grooph/x"));
  state2(".codex/hooks.json that is a folder", (d) => dir2(d, ".codex/hooks.json"));
  state2(".codex/hooks/ and .codex/config.toml (no hooks.json)", (d) => { file2(d, ".codex/hooks/x.sh"); file2(d, ".codex/config.toml"); });
  state2(".claude/settings.json that is a link to nowhere", (d) => { dir2(d, ".claude"); symlinkSync("/nowhere/at/all", join(d, ".claude/settings.json")); });
  state2(".grooph that is a link to nowhere", (d) => symlinkSync("/nowhere/at/all", join(d, ".grooph")));
  rmSync(t2, { recursive: true });
}
