// B3. "Both blocks are run from one built checkout, at one commit" (madeFromAnother, --another-checkout).
// What the rule compares is the commit's name and the checksum of the hook's source file. Shown here on records put in
// place by hand, each saying which checkout made it, with the checkout "now" given to the function.
//
//   1. the first block's records are committed (they live in the repository, and CI holds the results page to them):
//      the commit's name changes and nothing of the tool does
//   2. the same commit and hook, with files changed and not committed (the runner, the measures, the built tool)
//   3. a record that names no commit
//
//   sh with-fake-home.sh b3-one-checkout.mjs
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inHand, lib, order, say } from "./lib.mjs";

const { madeFromAnother, checkout } = await import(join(lib, "watching-second-look-paid.mjs"));
const top = realpathSync(mkdtempSync(join(tmpdir(), "b3-")));
const made = (commit, hook, more = {}) => ({ ended_by: "the session", given: { the_runners_checkout: { commit, hook_sha256: hook, files_changed_since_it: 0, grooph_version: "0.4.1", ...more } } });
const [A, B, H] = ["a".repeat(40), "b".repeat(40), "f".repeat(64)];
inHand(top, order().slice(0, 18), made(A, H));

const committed = madeFromAnother({ commit: B, hook_sha256: H }, top);
say(committed ? "SHOWN" : "HELD", `1. the opus block made at commit a…; its records then committed, so the checkout is at commit b… with the same hook and the same tool: ${committed ? `the next run is REFUSED as from ${committed.what.join(" and ")}, and needs --another-checkout` : "the next run is let through"}`, "every run of the second block then carries --another-checkout, and a real change of the tool between the blocks is let through by the same word");
const dirty = madeFromAnother({ commit: A, hook_sha256: H, files_changed_since_it: 41, grooph_version: "9.9.9" }, top);
say(dirty === null ? "SHOWN" : "HELD", `2. the same commit and hook's file, 41 files changed and not committed, another version of the tool: ${dirty === null ? "let through, with no word (files_changed_since_it and grooph_version are kept in the record and not compared)" : "refused"}`);
inHand(top, [order()[0]], made(null, H));
const unnamed = madeFromAnother({ commit: B, hook_sha256: "0".repeat(64) }, top);
say("SEEN", `3. a record that names no commit (git could not be asked) is passed over: the first run named as another is ${unnamed?.run}`);
console.log(`      this checkout, as checkout() reads it now: ${JSON.stringify(checkout())}`);
rmSync(top, { recursive: true, force: true });
