/**
 * "A brake that binds" (experiments/brakes/budget/): one graph compiled twice, with a dispatch budget of two and of
 * six, on a task whose check never passes. The design is audit 0001's (experiments/audits/0001-claims-as-of-0-3-0/
 * designs/a-brake-that-binds.md); the pre-registration is experiments/brakes/budget/README.md.
 *
 * This script does the part that spends nothing. It starts no model session, and it has no mode that does: the paid
 * runs wait for the owner's yes and for a headless session to be shown to start from the clean profile.
 *
 *   node scripts/lib/brake-run.mjs --dry-run            compile both packages, show what differs between them, derive the two prose prompts
 *   node scripts/lib/brake-run.mjs --dry-run --write    and keep the two prose prompts beside the graph
 *   node scripts/lib/brake-run.mjs --check              the kept prose prompts are the ones the rule derives today
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { derive, readPackage } from "./compare-prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const experiment = join(root, "experiments", "brakes", "budget");
const grooph = join(root, "packages", "cli", "bin", "grooph.js");

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

function cli(args) {
  const run = spawnSync(process.execPath, [grooph, ...args], { encoding: "utf8" });
  if (run.status !== 0) fail(`grooph ${args.join(" ")} exited ${run.status}\n${run.stdout}${run.stderr}`);
  return run.stdout;
}

const files = (dir, base = dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name), base) : [relative(base, join(dir, name))])).sort();

/** The two packages, compiled from one document and one op, each into a folder of its own under `work`. */
export function compileBoth(work, expect) {
  const out = {};
  for (const [name, budget] of Object.entries(expect.budgets)) {
    const doc = join(work, `${name}.grooph.json`);
    cpSync(join(experiment, "brake.grooph.json"), doc);
    if (budget !== expect.budgets.small) cli(["apply", doc, "--ops", join(experiment, "large.ops.json"), "--write", "--for-export"]);
    const limit = JSON.parse(readFileSync(doc, "utf8")).loops[0].stops.find((stop) => stop.kind === "budget").limit;
    if (limit !== budget) fail(`${name}: the document's budget is ${limit}, and the pre-registration says ${budget}`);
    cli(["validate", "--for-export", doc]);
    const into = join(work, name);
    cli(["export", doc, "--target", "claude-code", "--into", into, "--models", expect.tier_map_said_as]);
    out[name] = into;
  }
  return out;
}

/** Every line that differs between two trees of the same files, as [file, line number, one, other]. */
export function differingLines(one, other) {
  const names = files(one);
  if (JSON.stringify(names) !== JSON.stringify(files(other))) fail("the two packages do not hold the same files");
  const out = [];
  for (const name of names) {
    const a = readFileSync(join(one, name), "utf8").split("\n");
    const b = readFileSync(join(other, name), "utf8").split("\n");
    if (a.length !== b.length) fail(`${name}: the two packages' copies differ in length`);
    a.forEach((line, i) => {
      if (line !== b[i]) out.push([name, i + 1, line, b[i]]);
    });
  }
  return out;
}

/** A line with every statement of the budget, and of the rounds it covers, taken out: two lines that differ only there are then the same. */
export const withoutBudget = (line) =>
  line
    .replaceAll(/(budget(?::| of)? |at most |"limit": )\d+/g, "$1N")
    .replaceAll(/covers \d+ full rounds?/g, "covers R full rounds");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  if (!flags.includes("--dry-run") && !flags.includes("--check")) {
    console.error("usage: brake-run.mjs --dry-run [--write] | --check\nThis script starts no model session. The paid runs are not built: they wait for the owner's yes.");
    process.exit(64);
  }
  if (!existsSync(grooph) || !existsSync(join(root, "packages", "cli", "dist"))) fail("build the tool first: pnpm -r build");
  const expect = JSON.parse(readFileSync(join(experiment, "expect.json"), "utf8"));
  const work = mkdtempSync(join(tmpdir(), "brake-"));
  try {
    const built = compileBoth(work, expect);
    const { small, large } = expect.budgets;
    const lines = differingLines(built.small, built.large);
    const stray = lines.filter(([, , a, b]) => withoutBudget(a) !== withoutBudget(b));
    const prose = Object.fromEntries(Object.entries(built).map(([name, dir]) => [name, derive(readPackage(dir))]));
    const proseText = (name) => (typeof prose[name] === "string" ? prose[name] : prose[name].prompt);
    const proseLines = proseText("small").split("\n").map((line, i) => [line, proseText("large").split("\n")[i]]).filter(([a, b]) => a !== b);
    const proseStray = proseLines.filter(([a, b]) => withoutBudget(a) !== withoutBudget(b ?? ""));
    const kept = (name) => join(experiment, `prompt-prose-${expect.budgets[name]}.md`);

    if (flags.includes("--check")) {
      for (const name of ["small", "large"]) {
        if (!existsSync(kept(name)) || readFileSync(kept(name), "utf8") !== proseText(name)) fail(`${relative(root, kept(name))} is not what the rule derives from today's package. Run brake-run.mjs --dry-run --write.`);
      }
      if (stray.length + proseStray.length > 0) fail("the two packages, or the two prose prompts, differ in more than the budget");
      console.log(`brake: both packages compile; they differ in ${lines.length} lines, all of them the budget; the kept prose prompts are current`);
      process.exit(0);
    }

    console.log(`one graph, two budgets: ${small} and ${large} dispatches (a round costs ${expect.a_round_costs}: ${expect.a_round_is.join(", ")})`);
    console.log(`models: lead ${expect.lead.model} at effort ${expect.lead.effort}; tiers ${expect.tier_map_said_as}`);
    console.log(`\nthe two packages hold the same ${files(built.small).length} files and differ in ${lines.length} lines:`);
    for (const [name, n, a, b] of lines) console.log(`\n  ${name}:${n}\n    ${small}: ${a.trim().slice(0, 150)}\n    ${large}: ${b.trim().slice(0, 150)}`);
    console.log(stray.length === 0 ? "\nevery one of them is the budget, or the number of rounds it covers" : `\n${stray.length} of them differ in something else:\n${stray.map(([name, n]) => `  ${name}:${n}`).join("\n")}`);
    console.log(`\nthe same design as prose, derived by the comparison protocol's rule: ${proseText("small").length} and ${proseText("large").length} characters; they differ in ${proseLines.length} lines${proseStray.length === 0 ? ", all of them the budget" : `, ${proseStray.length} of them not the budget`}`);
    for (const [a, b] of proseLines) console.log(`    ${small}: ${a.trim().slice(0, 150)}\n    ${large}: ${String(b).trim().slice(0, 150)}`);
    if (flags.includes("--write")) {
      for (const name of ["small", "large"]) writeFileSync(kept(name), proseText(name), "utf8");
      console.log(`\nwrote ${relative(root, kept("small"))} and ${relative(root, kept("large"))}`);
    }
    console.log(`\npre-registered, as a pair:\n  small: ${expect.outcome.small}\n  large: ${expect.outcome.large}`);
    console.log("\nno model session was started. The paid runs are not built.");
    if (stray.length + proseStray.length > 0) process.exit(1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
