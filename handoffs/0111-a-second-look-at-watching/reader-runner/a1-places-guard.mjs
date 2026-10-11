// A1. placesFor and its guard: every way of naming one of the owner's own places that I could think of.
// OWNER is a temp folder standing in for the owner's home (os.homedir() answers it here). Where the guard lets a
// place through, slice 0108's real tool is then run through installOutside() to show where the install lands.
//
//   sh with-fake-home.sh a1-places-guard.mjs
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLI_0108, OWNER, filesUnder, lib, say } from "./lib.mjs";

const { placesFor, installOutside, theOwnersOwn } = await import(join(lib, "watching-second-look-paid.mjs"));
const top = realpathSync(mkdtempSync(join(tmpdir(), "a1-")));
for (const own of theOwnersOwn()) mkdirSync(own, { recursive: true });
writeFileSync(join(OWNER, ".claude", "settings.json"), '{"theOwners":"own settings"}\n');
const ownersTree = () => filesUnder(OWNER).filter((path) => /^\.(claude|codex|grooph)\//.test(path));
const before = JSON.stringify(ownersTree());

const refused = (what, groophHome, configDir, userHome) => {
  try {
    const places = placesFor({ groophHome, configDir, ...(userHome === undefined ? {} : { userHome }) });
    return { refused: false, places };
  } catch (error) {
    return { refused: true, why: error.message.slice(0, 110) };
  }
};
const attempt = (what, groophHome, configDir, { expectRefused, userHome, install = false } = {}) => {
  const out = refused(what, groophHome, configDir, userHome);
  if (out.refused) return say(expectRefused ? "HELD" : "ODD", `${what}: refused`, out.why);
  let landed = "";
  if (install) {
    for (const dir of ["cwd", "a-project"]) mkdirSync(join(top, dir), { recursive: true });
    let failed = "";
    try {
      installOutside({ cli: CLI_0108, groophHome, configDir, folder: join(top, "a-project"), cwd: join(top, "cwd") });
    } catch (error) {
      failed = `(the tool said: ${error.message.replaceAll(top, "<top>").slice(0, 200)})\n      `;
    }
    const after = ownersTree();
    landed = failed + (JSON.stringify(after) === before ? "the owner's places are as they were" : `THE OWNER'S PLACES NOW HOLD: ${after.join(", ")}\n      his settings.json now has hooks: ${Object.keys(JSON.parse(readFileSync(join(OWNER, ".claude", "settings.json"), "utf8")).hooks ?? {}).join(", ") || "none"}`);
  }
  say(expectRefused ? "SHOWN" : "HELD", `${what}: ${expectRefused ? "NOT refused" : "let through, rightly"} -> GROOPH_HOME=${out.places.GROOPH_HOME} CLAUDE_CONFIG_DIR=${out.places.CLAUDE_CONFIG_DIR}`, landed);
};

console.log(`the owner's home here: ${OWNER}\n`);
// The plain cases the test file has.
attempt("his own .grooph", join(OWNER, ".grooph"), join(top, "profile"), { expectRefused: true });
attempt("a folder inside his own .claude", join(top, "g"), join(OWNER, ".claude", "inside"), { expectRefused: true });
// Spellings of the same place.
attempt("a trailing slash", `${join(OWNER, ".grooph")}/`, `${join(OWNER, ".claude")}//`, { expectRefused: true });
attempt("dots in the path", join(OWNER, "x", "..", ".grooph"), join(OWNER, ".", ".claude"), { expectRefused: true });
process.chdir(OWNER);
attempt("a relative path, from his home as the working folder", ".grooph", ".claude", { expectRefused: true });
process.chdir(top);
// "~" is not a home to node: it is a folder of that name in the working folder.
attempt('"~/.grooph" as it stands (no shell has read it)', "~/.grooph", "~/.claude", { expectRefused: false });
// A link to his home: the same folders under another name.
symlinkSync(OWNER, join(top, "link-to-his-home"));
attempt("through a symbolic link to his home", join(top, "link-to-his-home", ".grooph"), join(top, "link-to-his-home", ".claude"), { expectRefused: true, install: true });
// The same folders in other letters: the Mac's disk does not tell capitals from small letters.
const sameFile = existsSync(join(OWNER, ".CLAUDE", "settings.json"));
console.log(`\n(this disk ${sameFile ? "does NOT tell" : "tells"} .CLAUDE from .claude)`);
attempt("in capitals (.GROOPH, .CLAUDE)", join(OWNER, ".GROOPH"), join(OWNER, ".CLAUDE"), { expectRefused: sameFile, install: false });
// What the guard is worth when the home it is given is not a whole path.
attempt('his own places, the home given as "" (HOME set and empty: os.homedir() answers "")', join(OWNER, ".grooph"), join(OWNER, ".claude"), { expectRefused: true, userHome: "" });
attempt('his own places, the home given as "~"', join(OWNER, ".grooph"), join(OWNER, ".claude"), { expectRefused: true, userHome: "~" });
// The Mac's other name for every home: /System/Volumes/Data/Users/<name> is /Users/<name>, the same folders (a firmlink,
// which realpath does not resolve). Shown with a home of that shape; nothing is installed for this one.
attempt("the Mac's second name for a home (/System/Volumes/Data/Users/x for /Users/x)", "/System/Volumes/Data/Users/x/.grooph", "/System/Volumes/Data/Users/x/.claude", { expectRefused: true, userHome: "/Users/x" });
