// Reader of the protocol (slice 0111): what the harness's own sandbox instructions say a command may read and write (the page: "cannot read outside its own folder at all"). Reads one first-check transcript in the clean profile (read only) and prints only the lines of the sandbox_instructions attachment that hold the read/write lists, with the home folder as ~: settings, nothing a session read, wrote or said. node handoffs/0111-a-second-look-at-watching/reader-protocol/06-what-a-command-may-read.mjs [run]
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const run = process.argv[2] ?? "sonnet/one/watched-1";
const r = JSON.parse(readFileSync(join(repo, "experiments/watching", run, "result.json"), "utf8"));
const file = r.transcript.replace(/^~/, homedir());
if (!existsSync(file)) { console.log("transcript not on this machine"); process.exit(0); }
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let rec; try { rec = JSON.parse(line); } catch { continue; }
  if (rec?.type !== "attachment" || rec.attachment?.type !== "sandbox_instructions") continue;
  const text = typeof rec.attachment.content === "string" ? rec.attachment.content : JSON.stringify(rec.attachment.content);
  for (const part of text.split(/\\n|\n/)) if (/denyOnly|allowOnly|denyWithinAllow|allowedHosts|deniedHosts/.test(part)) console.log(part.replaceAll(homedir(), "~").replace(/[\w.+-]+@[\w.-]+/g, "<address>").slice(0, 3000));
}
