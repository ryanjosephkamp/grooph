// A3. What happens to the owner's own places if the tool takes no notice of the three variables it is handed.
// The stand-in tool here ("ignores-places") reads no GROOPH_HOME and no CLAUDE_CONFIG_DIR: it installs under
// $HOME/.grooph and $HOME/.claude, as a tool does that falls back on the home. OWNER is a temp folder standing in for
// the owner's home; it is what HOME is in these scripts.
//
//   1. the rehearsal alone (which --status, every dry run of an outside run and every paid outside run make first)
//   2. a whole outside run whose rehearsal passed (stubbed), so that the launcher is what installs
//   3. the same when the owner already has a recorder of his own at the user's level
//
//   sh with-fake-home.sh a3-tool-ignores-places.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER, byName, filesUnder, inHand, lib, order, place, quietPlan, say, standInTool } from "./lib.mjs";

const { rehearse, runOne, theOwnersOwn, theOwnersOwnAsFound } = await import(join(lib, "watching-second-look-paid.mjs"));
const clean = () => {
  for (const own of theOwnersOwn()) rmSync(own, { recursive: true, force: true });
};
const owners = () => filesUnder(OWNER).filter((path) => /^\.(claude|codex|grooph)\//.test(path));
console.log(`the owner's home here: ${OWNER}\n`);

// 1. The rehearsal.
{
  clean();
  const p = place();
  const rehearsed = rehearse({ cli: standInTool(p.top, "ignores-places"), home: p.home });
  const left = owners();
  say(left.length > 0 ? "SHOWN" : "HELD", `the rehearsal, with a tool that ignores the places it is handed: ${left.length > 0 ? `THE OWNER'S OWN PLACES NOW HOLD ${left.join(", ")}` : "the owner's places are as they were"}`, `the rehearsal answered ok=${rehearsed.ok}: ${String(rehearsed.why).replaceAll(p.top, "<top>").slice(0, 230)}\nhis settings.json now has hooks at: ${left.includes(".claude/settings.json") ? Object.keys(JSON.parse(readFileSync(join(OWNER, ".claude", "settings.json"), "utf8")).hooks ?? {}).join(", ") : "-"}\nwhat the rehearsal says of his places: nothing (it does not look at them, before or after)`);
  rmSync(p.top, { recursive: true, force: true });
}

// 2. A whole run: the rehearsal passed, and the launcher installs with the same tool.
const whole = async (label, prepare) => {
  clean();
  prepare();
  const p = place(quietPlan("outside"));
  inHand(p.recordRoot, order().slice(0, 4));
  const before = JSON.stringify(owners());
  const beforeList = existsSync(join(OWNER, ".grooph", "watched.json")) ? readFileSync(join(OWNER, ".grooph", "watched.json"), "utf8") : null;
  const done = await runOne({ ...p.opus, cli: standInTool(p.top, "ignores-places") });
  const after = owners();
  const afterList = existsSync(join(OWNER, ".grooph", "watched.json")) ? readFileSync(join(OWNER, ".grooph", "watched.json"), "utf8") : null;
  const own = done.result.given?.recorder_outside_the_project?.the_owners_own;
  const changed = JSON.stringify(after) !== before || beforeList !== afterList;
  say(changed ? "SHOWN" : "HELD", `${label}: ${changed ? "THE OWNER'S OWN PLACES WERE WRITTEN" : "the owner's places are as they were"}`, [
    `run ${done.run.name}; not started: ${done.notStarted === true}; ended by ${done.result.ended_by}; the stand-in harness was ${existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json")) ? "STARTED (a real one would have been paid for)" : "not started"}`,
    `his places now hold: ${after.join(", ") || "nothing"}`,
    `his list of watched folders: before ${beforeList === null ? "none" : `${JSON.parse(beforeList).folders.length} folder(s)`}, after ${afterList === null ? "none" : `${JSON.parse(afterList).folders.length} folder(s)`}`,
    `the record's own check of his places: ${own ? `as_they_were=${own.as_they_were} (before ${JSON.stringify(own.before)}, after ${JSON.stringify(own.after)})` : "not made (the record has none)"}`,
    `problems in the record: ${(done.result.problems ?? []).map((problem) => problem.replaceAll(p.top, "<top>").slice(0, 150)).join(" | ") || "none"}`,
  ].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
};
await whole("2. a whole outside run, the rehearsal having passed, the owner's home clean", () => {});
await whole("3. the same, the owner already having a recorder of his own at the user's level", () => {
  // His own install, as the same tool leaves it, with one folder of his own listed.
  mkdirSync(join(OWNER, ".grooph", "hooks"), { recursive: true });
  mkdirSync(join(OWNER, ".claude"), { recursive: true });
  const hook = join(OWNER, ".grooph", "hooks", "grooph-event.mjs");
  writeFileSync(hook, readFileSync(join(lib, "..", "..", "packages", "cli", "hooks", "grooph-event.mjs")));
  const entry = { hooks: [{ type: "command", command: `node "${hook}" claude-code --user`, async: true, timeout: 10 }] };
  writeFileSync(join(OWNER, ".claude", "settings.json"), `${JSON.stringify({ hooks: { SessionStart: [entry], SubagentStart: [entry], SubagentStop: [entry] } }, null, 2)}\n`);
  writeFileSync(join(OWNER, ".grooph", "watched.json"), JSON.stringify({ folders: [{ path: "/his/own/project", events: "project" }] }));
});
console.log(`\nwhat theOwnersOwnAsFound() compares: ${JSON.stringify(theOwnersOwnAsFound())} (two facts: a count of entries, and whether a hook's file is there)`);
clean();
