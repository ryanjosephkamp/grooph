// C3. A way the "not started" path can be reached with no wall failing: by a person doing what the runner tells them.
// (For commit a775ef7c and after, where the launcher's marker is kept with grooph's own folder for the run, under
// <the profile's home>/home.)
//
// A paid run of the outside arm is under way (here: the stand-in harness, which waits six seconds and then reports a
// cost of $0.50). In a second terminal someone asks for a dry run of an outside run, to see what comes next. The
// runner refuses it and says that <home>/home "is grooph's own folder from an earlier run of the outside arm ... Move
// it aside before another is made". It is the folder of the run in progress. This script does as it was told, lets
// the session end, and looks at what the runner recorded.
//
//   sh with-fake-home.sh c3-told-to-move-it-aside.mjs
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REHEARSED, here, inHand, lib, order, place, say } from "./lib.mjs";

const { dryRun, room, readLedger, stateOf, STARTED } = await import(join(lib, "watching-second-look-paid.mjs"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const p = place({ hang_ms: 6000, cost: 0.5, uses: [{ tool: "Bash", input: { command: "npm test" }, result: "ok" }] });
inHand(p.recordRoot, order().slice(0, 4));
const given = join(p.top, "given.json");
writeFileSync(given, JSON.stringify({ home: p.home, claude: p.harness, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, go: p.common.go, grace: 300, cli: p.common.cli, block: "opus" }));
const child = spawn(process.execPath, [join(here, "c2-child.mjs"), given], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let out = "";
child.stdout.on("data", (chunk) => (out += chunk));
const ended = new Promise((done) => child.on("exit", done));
const marker = join(p.home, "home", STARTED);
const began = Date.now();
while (!existsSync(marker) && Date.now() - began < 60_000 && child.exitCode === null) await sleep(20);
if (!existsSync(marker)) {
  console.log(`this checkout keeps the launcher's marker somewhere else than ${marker} (commit fa4ea32a kept it beside the session's folder): nothing to try here`);
  child.kill("SIGKILL");
  rmSync(p.top, { recursive: true, force: true });
  process.exit(0);
}
// The second terminal: a dry run of the block's other outside run of this round.
let told;
try {
  told = dryRun({ run: order()[5], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: () => ({ claude: "/the/harness", refused: [] }), cli: p.common.cli, rehearsal: () => REHEARSED });
  told = `it went through: ${told.split("\n")[0]}`;
} catch (error) {
  told = error.message.replaceAll(p.top, "<top>");
}
// Doing as told.
renameSync(join(p.home, "home"), join(p.home, "home-moved-aside-as-told"));
await ended;
let said = null;
try {
  said = JSON.parse(out.trim().split("\n").at(-1));
} catch {}
const has = room(readLedger(p.ledgerPath), 12);
const dir = join(p.recordRoot, "opus", "four");
const output = existsSync(join(dir, "outside-1-not-started", "claude-output.json")) ? JSON.parse(readFileSync(join(dir, "outside-1-not-started", "claude-output.json"), "utf8")) : null;
say(said?.notStarted === true && has.spent === 0 ? "SHOWN" : "HELD", `a paid outside run in progress; a dry run in a second terminal says: "${told.slice(0, 250)}"`, [
  `the folder was moved aside as told, and the session then ended by itself: the runner recorded notStarted=${said?.notStarted}, ended_by "${said?.ended_by}"`,
  `its reason: ${String(said?.not_started ?? said?.why).slice(0, 170)}`,
  `the harness's own output, kept in the same folder: ${output ? `total_cost_usd ${output.total_cost_usd}, num_turns ${output.num_turns}` : "not kept"}`,
  `the ledger: ${JSON.parse(readFileSync(p.ledgerPath, "utf8")).invocations.map((entry) => `${entry.run} ${entry.status} cost ${entry.cost_usd}`).join(" | ")}; counted of the cap: $${has.spent.toFixed(2)}`,
  `the run reads "${stateOf(order()[4], p.recordRoot).state}" (records: ${readdirSync(dir).join(", ")}), so the same command starts it again`,
].join("\n"));
rmSync(p.top, { recursive: true, force: true });
