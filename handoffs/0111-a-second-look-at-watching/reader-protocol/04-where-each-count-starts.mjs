// Reader of the protocol (slice 0111): what each package's unseen suite passes with no work done (the page: csvline 38 of 73, the other five none). Runs only the repository's own suites against a copy of each task folder in a scratch folder given as the first argument (default: the system's temp folder); no session. node handoffs/0111-a-second-look-at-watching/reader-protocol/04-where-each-count-starts.mjs [scratch]
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { TASKS } = await import(join(repo, "scripts/lib/watching-second-look-paid.mjs"));
const { scoreHeldOut } = await import(join(repo, "scripts/lib/compare-score.mjs"));
const comparisons = join(repo, "experiments", "comparisons");
let cases = 0, passed = 0;
for (const pkg of TASKS.six.packages) {
  const tree = mkdtempSync(join(process.argv[2] ?? tmpdir(), "reader-suite-"));
  try {
    cpSync(join(comparisons, pkg.project, "task"), tree, { recursive: true });
    const held = scoreHeldOut(tree, join(comparisons, pkg.project, "held-out"));
    cases += held.cases; passed += held.passed;
    console.log(pkg.name.padEnd(12), pkg.project.padEnd(22), "ran", held.ran, "cases", held.cases, "passed", held.passed, "runner says", pkg.cases);
  } finally { rmSync(tree, { recursive: true, force: true }); }
}
console.log("six in all:", passed, "of", cases, "| four:", "see the first four lines");
