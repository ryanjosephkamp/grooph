// Reader of the protocol (slice 0111): is the wall on .grooph shown to a session? Reads first-check transcripts in the clean profile (read only) and prints, for what the harness put in front of the model (attachments, and the first user line), only yes/no for a few fixed words and lengths: nothing a session read, wrote or said. node handoffs/0111-a-second-look-at-watching/reader-protocol/05-is-the-wall-shown.mjs [run ...]
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const runs = process.argv.slice(2).length ? process.argv.slice(2) : ["sonnet/one/plain-1", "sonnet/one/watched-1", "opus/four/watched-1", "haiku/four/invited-1"];
const WORDS = [".grooph", "denyWithinAllow", "denyWrite", "denyOnly", "grooph-compare/profile/projects", "grooph-compare/kept", "grooph-event", "settings.json", "hook"];
for (const run of runs) {
  const r = JSON.parse(readFileSync(join(repo, "experiments/watching", run, "result.json"), "utf8"));
  const file = r.transcript.replace(/^~/, homedir());
  if (!existsSync(file)) { console.log(run, "transcript not on this machine"); continue; }
  console.log(`\n${run} (closed to the session: ${JSON.stringify(r.given.closed_to_the_session)}; hook installed: ${r.given.hook_installed.length} files)`);
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    if (rec?.type !== "attachment" || !rec.attachment) continue;
    const text = JSON.stringify(rec.attachment);
    const has = WORDS.filter((w) => text.includes(w));
    if (has.length || rec.attachment.type === "sandbox_instructions") console.log(`  attachment ${rec.attachment.type}: ${text.length} characters, keys ${Object.keys(rec.attachment).join(",")}; holds: ${has.join(" | ") || "none of the words"}`);
  }
}
