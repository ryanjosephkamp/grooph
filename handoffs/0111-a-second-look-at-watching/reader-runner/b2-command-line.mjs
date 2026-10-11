// B2. The command line of the runner, with odd combinations of flags. NEVER with --spend: every line here is one the
// script must end before it starts anything, and with no --spend the paid path is refused at the door. The ledger in
// the checkout holds no decision on scoring and no line, so nothing here can start a session whatever else it does.
// HOME is the reader's temp folder (with-fake-home.sh), so a dry run builds its folder under a temp profile home and
// no `claude` is on the path.
//
// For each: the exit code and the first line said. Then the checkout's ledger and records, which must be as they were.
//
//   sh with-fake-home.sh b2-command-line.mjs
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { lib, root, say } from "./lib.mjs";

const SCRIPT = join(lib, "watching-second-look-paid.mjs");
const LEDGER = join(root, "experiments", "watching", "second-look", "ledger.json");
const sum = () => createHash("sha256").update(readFileSync(LEDGER)).digest("hex").slice(0, 12);
const folders = () => readdirSync(join(root, "experiments", "watching", "second-look")).sort().join(" ");
const before = [sum(), folders()];
const run = (...args) => {
  if (args.includes("--spend")) throw new Error("the reader never passes --spend");
  const out = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: process.env, timeout: 300_000 });
  return { status: out.status, first: `${out.stderr}${out.stdout}`.trim().split("\n")[0]?.slice(0, 190) ?? "", all: `${out.stdout}${out.stderr}` };
};
const cases = [
  // [what is expected, the arguments]
  ["refused", ["--all", "--block", "opus"]],
  ["refused", ["--next", "--block", "opus"]],
  ["refused", ["--next", "--block", "opus", "--go", "the driver's words, long enough"]],
  ["refused", ["--rerun", "opus/four/plain-1"]],
  ["refused", ["--all"]],
  ["refused", []],
  ["refused", ["--go"]],
  ["refused", ["--go", "--all", "--block", "opus"]],
  ["refused", ["--block"]],
  ["refused", ["--block", "--all"]],
  ["refused", ["--block=opus", "--all"]],
  ["refused", ["--all", "--block", "opus", "--through-round", "0"]],
  ["refused", ["--all", "--block", "opus", "--through-round", "1.5"]],
  ["refused", ["--all", "--block", "opus", "--through-round"]],
  ["refused", ["--status", "--block", "opus"]],
  ["refused", ["--status", "--dry-run"]],
  ["refused", ["--score", "opus/four/plain-1", "--block", "opus"]],
  ["refused", ["--settle", "1", "--cost", "0", "--note", "a note that is long enough", "--all"]],
  ["refused", ["--settle", "1", "--cost", "0", "--note", "a note that is long enough"]],
  ["refused", ["--settle", "1", "--note", "a note that is long enough"]],
  ["refused", ["--score", "opus/four/plain-1"]],
  ["refused", ["--run", "opus/four/plain-1"]],
  ["refused", ["--dry-run", "--run", "opus/four/plain-9"]],
  ["refused", ["--dry-run", "--run", "opus/four/plain-1", "--block", "opus"]],
  ["refused", ["--another-checkout"]],
  ["refused", ["--another-checkout", "--status"]],
  ["refused", ["", "--all"]],
  ["said", ["--status"]],
  ["said", ["--dry-run"]],
  ["said", ["--dry-run", "--block", "sonnet"]],
  ["said", ["--dry-run", "--run", "sonnet/six/outside-2"]],
  // A flag given twice with two values: which one is taken, and is the other said?
  ["said", ["--dry-run", "--block", "opus", "--block", "sonnet"]],
  ["said", ["--dry-run", "--block", "sonnet", "--block", "opus"]],
  ["said", ["--dry-run", "--all", "--block", "opus", "--through-round", "1", "--through-round", "3", "--without-outside"]],
];
for (const [expect, args] of cases) {
  const out = run(...args);
  const refused = out.status !== 0;
  const started = /recorded in|ended by the session|ledger line \d/.test(out.all);
  let more = "";
  if (args.filter((arg) => arg === "--block").length === 2) more = `  [two --block: it took ${/^(opus|sonnet)\//.exec(out.first)?.[1] ?? "?"}, and said nothing of the other]`;
  if (args.filter((arg) => arg === "--through-round").length === 2) more = `  [two --through-round: ${(out.all.match(/^opus\/\w+\/\w+-\d$/gm) ?? []).length} runs shown, rounds ${[...new Set((out.all.match(/^opus\/\w+\/\w+-(\d)$/gm) ?? []).map((name) => name.at(-1)))].join(",")}]`;
  say(started ? "SHOWN" : expect === "refused" && !refused ? "ODD" : more ? "SEEN" : "HELD", `${JSON.stringify(args.join(" "))} -> exit ${out.status}: ${out.first}${more}`);
}
const after = [sum(), folders()];
say(JSON.stringify(before) === JSON.stringify(after) ? "HELD" : "SHOWN", `the checkout's ledger (${after[0]}) and the folder of records (${after[1]}) are ${JSON.stringify(before) === JSON.stringify(after) ? "as they were" : "CHANGED"}`);
say(existsSync(join(process.env.HOME, "grooph-compare", "work")) && readdirSync(join(process.env.HOME, "grooph-compare", "work")).length === 0 ? "HELD" : "SEEN", `the temp profile's work folder after the dry runs: ${existsSync(join(process.env.HOME, "grooph-compare", "work")) ? JSON.stringify(readdirSync(join(process.env.HOME, "grooph-compare", "work"))) : "never made"}; its home folder: ${existsSync(join(process.env.HOME, "grooph-compare")) ? JSON.stringify(readdirSync(join(process.env.HOME, "grooph-compare"))) : "never made"}`);
