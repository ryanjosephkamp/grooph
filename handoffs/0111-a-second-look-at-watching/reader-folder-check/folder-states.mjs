// Reader's script: makes folder states in a temp folder and prints what the corrected runner's inTheSessionsFolder says of each; writes only under the temp folder.
//   node folder-states.mjs <a checkout with the corrected runner>
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const r = await import(join(process.argv[2], "scripts/lib/watching-second-look-paid.mjs"));
const t = mkdtempSync(join(tmpdir(), "reader-folder-"));
const state = (name, make) => { const d = join(t, name.replace(/\W+/g, "-")); mkdirSync(d); make(d); const f = r.inTheSessionsFolder(d); console.log(`${f.of_an_install.length + f.not_known.length === 0 ? "PASSES AS NOTHING" : "stops           "} | ${name} | ${JSON.stringify(f)}`); };
const dir = (...p) => mkdirSync(join(...p), { recursive: true });
state("as the harness leaves it: .cc-writes at the top and in each package folder", (d) => { dir(d, ".claude/.cc-writes"); dir(d, "csvline/.claude/.cc-writes"); });
state("a settings file in a package folder's .claude", (d) => { dir(d, ".claude/.cc-writes"); dir(d, "csvline/.claude"); writeFileSync(join(d, "csvline/.claude/settings.json"), "{}"); });
state("grooph's folder with a hook's file in a package folder", (d) => { dir(d, "csvline/.grooph/events"); writeFileSync(join(d, "csvline/.grooph/events/s.jsonl"), "{}\n"); });
state("something in a package folder's .cc-writes", (d) => { dir(d, "csvline/.claude/.cc-writes"); writeFileSync(join(d, "csvline/.claude/.cc-writes/x"), "x"); });
state("codex's hooks in the project (.codex/hooks.json)", (d) => { dir(d, ".codex"); writeFileSync(join(d, ".codex/hooks.json"), "{}"); });
state("an empty .claude", (d) => dir(d, ".claude"));
state(".claude/settings.json only", (d) => { dir(d, ".claude"); writeFileSync(join(d, ".claude/settings.json"), "{}"); });
state(".claude a link to a folder that holds settings.json", (d) => { dir(d, "elsewhere"); writeFileSync(join(d, "elsewhere/settings.json"), "{}"); symlinkSync(join(d, "elsewhere"), join(d, ".claude")); });
state(".cc-writes holding only .DS_Store", (d) => { dir(d, ".claude/.cc-writes"); writeFileSync(join(d, ".claude/.cc-writes/.DS_Store"), ""); });
state(".cc-writes holding an empty folder", (d) => dir(d, ".claude/.cc-writes/sub"));
state(".claude/settings.json.tmp left by a write that was cut short", (d) => { dir(d, ".claude"); writeFileSync(join(d, ".claude/settings.json.tmp"), "{}"); });
state(".claude/Settings.JSON (another casing)", (d) => { dir(d, ".claude"); writeFileSync(join(d, ".claude/Settings.JSON"), "{}"); });
state(".claude/.DS_Store beside .cc-writes (a person opened the folder in Finder mid-run)", (d) => { dir(d, ".claude/.cc-writes"); writeFileSync(join(d, ".claude/.DS_Store"), ""); });
rmSync(t, { recursive: true });
