/**
 * The two arms of study three's question 5, "roles or information", derived for each of study two's three tasks
 * (handoffs/briefs/study-three-on-paper.md). In both comparisons the reviewer held evidence the builder had not seen,
 * so a design ended above the task alone on the held-out suites, and nobody can say whether the roles or the
 * information did it (audit 0001, finding F12). These two prompts take the two apart. Nobody writes either by hand.
 *
 *   arm E, information without roles   arm D's kept prompt, byte for byte, with one section added at its end that
 *                                      names the held-out material a reviewer was given in study two, to the one session
 *   arm F, roles without information   arm B's derivation (the package flattened to prose by the protocol's rule) from
 *                                      a package compiled with slots that name no held-out material: slots.F.json
 *
 * This script starts no model session. It builds a package in a temporary folder to derive arm F, and removes it.
 *
 *   node scripts/lib/compare-arms-ef.mjs            derive, and print what was derived
 *   node scripts/lib/compare-arms-ef.mjs --write    and keep prompt-E.md and prompt-F.md under experiments/comparisons/roles-or-information/<task>/
 *   node scripts/lib/compare-arms-ef.mjs --check    the kept prompts are the ones the rule derives today
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { DESIGN_WORDS, derive, readPackage } from "./compare-prompt.mjs";
import { buildScratch } from "./prove-pattern.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
export const HOME = join(comparisons, "roles-or-information");
export const TASKS = ["review-gate-2", "heterogeneous-critic", "taste-polish"];
const HELD_OUT_TOKEN = "<held-out>";
const tick = (name) => `\`${HELD_OUT_TOKEN}/${name}\``;
const list = (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** The held-out files a reviewer was given in study two: the project's held-out folder, less what was the scorer's alone. */
export function reviewersFiles(task) {
  const expect = JSON.parse(readFileSync(join(comparisons, task, "expect.json"), "utf8"));
  const scorerOnly = new Set(expect.held_out_scorer_only ?? []);
  return readdirSync(join(comparisons, task, "held-out")).filter((name) => !scorerOnly.has(name)).sort();
}

/**
 * The one section arm E adds to arm D's prompt. The same words for every task: a suite is run and made to pass, any
 * other file is read and agreed with. It names no role and no step of a design, and it does not say where the folder
 * is: the token becomes a real path when a run is built, and from the clean profile that path is inside the project.
 */
export function heldOutSection(files) {
  const suites = files.filter((name) => /\.test\.mjs$/.test(name));
  const others = files.filter((name) => !suites.includes(name));
  const lines = [];
  if (suites.length > 0) {
    lines.push(`${list(suites.map(tick))} ${suites.length === 1 ? "is a test suite" : "are test suites"}. ${suites.length === 1 ? "It settles" : "They settle"} what the task and the acceptance material leave open. Run ${suites.length === 1 ? "it" : "each"} from this project folder with ${list(suites.map((name) => `\`node --test ${HELD_OUT_TOKEN}/${name}\``))}, and make every case hold. Do not change ${suites.length === 1 ? "it" : "them"}.`);
  }
  if (others.length > 0) {
    lines.push(`${list(others.map(tick))} ${others.length === 1 ? "says" : "say"} what the result is measured against. Read ${others.length === 1 ? "it" : "them"} before you start, and make the result agree with ${others.length === 1 ? "it" : "them"}. Do not change ${others.length === 1 ? "it" : "them"}.`);
  }
  return `# Held-out material\n\n${lines.join("\n\n")}\n`;
}

/** Arm E's prompt: arm D's as kept, then the section. */
export function deriveE(task) {
  const d = readFileSync(join(comparisons, task, "prompt-D.md"), "utf8");
  const section = heldOutSection(reviewersFiles(task));
  return { prompt: `${d.replace(/\n*$/, "\n")}\n${section}`, section, from: `experiments/comparisons/${task}/prompt-D.md` };
}

/** Arm F's slots beside study two's: which slots differ, and whether any value of F's still names the held-out folder. */
export function slotsOfF(task) {
  const two = JSON.parse(readFileSync(join(comparisons, task, "slots.json"), "utf8"));
  const f = JSON.parse(readFileSync(join(HOME, task, "slots.F.json"), "utf8"));
  const changed = Object.keys(two.values).filter((key) => two.values[key] !== f.values[key]);
  return { two, f, changed, namesHeldOut: Object.entries(f.values).filter(([, value]) => /held-out/i.test(String(value))).map(([key]) => key) };
}

/** Arm F's prompt: the protocol's derivation from a package compiled with F's slots and no held-out folder. */
export function deriveF(task, tierMapText) {
  const expect = JSON.parse(readFileSync(join(comparisons, task, "expect.json"), "utf8"));
  const { f } = slotsOfF(task);
  const work = mkdtempSync(join(tmpdir(), "arms-"));
  const before = process.env.GROOPH_MODELS;
  process.env.GROOPH_MODELS = tierMapText ?? Object.entries(expect.tier_map).map(([tier, model]) => `${tier}=${model}`).join(",");
  try {
    const built = buildScratch(expect.template ?? task, { dir: join(comparisons, task), heldOut: null, slots: f, fragment: false, expect }, join(work, "project-"), { name: "dev", email: "dev@localhost", message: "initial commit" });
    const derived = derive(readPackage(built.scratch));
    const prompt = derived.prompt.replaceAll(built.scratch, ".");
    return { prompt, report: derived.report, template: expect.template ?? task, models: process.env.GROOPH_MODELS };
  } finally {
    if (before === undefined) delete process.env.GROOPH_MODELS;
    else process.env.GROOPH_MODELS = before;
    rmSync(work, { recursive: true, force: true });
  }
}

/** What must be true of the pair before either is used: E is D and the section, F names no held-out material and changed only the slot that did. */
export function problems(task, e, f) {
  const out = [];
  const d = readFileSync(join(comparisons, task, "prompt-D.md"), "utf8");
  if (!e.prompt.startsWith(d.replace(/\n*$/, "\n"))) out.push("arm E does not begin with arm D's prompt, byte for byte");
  const words = [...new Set((e.section.match(DESIGN_WORDS) ?? []).map((w) => w.toLowerCase()))];
  if (words.length > 0) out.push(`arm E's added section carries a word of the design: ${words.join(", ")}`);
  for (const name of reviewersFiles(task)) if (!e.section.includes(`${HELD_OUT_TOKEN}/${name}`)) out.push(`arm E does not name ${name}`);
  const slots = slotsOfF(task);
  if (slots.namesHeldOut.length > 0) out.push(`arm F's slot ${slots.namesHeldOut.join(", ")} still names the held-out folder`);
  const named = Object.keys(slots.two.values).filter((key) => String(slots.two.values[key]).includes(HELD_OUT_TOKEN));
  if (JSON.stringify(slots.changed) !== JSON.stringify(named)) out.push(`arm F's slots differ from study two's in ${slots.changed.join(", ") || "nothing"}; only ${named.join(", ")} named the held-out folder`);
  if (slots.f.name !== slots.two.name) out.push("arm F's graph has another name than study two's");
  if (f && /held-out|held out/i.test(f.prompt)) out.push("arm F's prompt names held-out material");
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  if (!existsSync(join(root, "packages", "cli", "dist"))) {
    console.error("build the tool first: pnpm -r build");
    process.exit(1);
  }
  let bad = 0;
  for (const task of TASKS) {
    const e = deriveE(task);
    const f = deriveF(task);
    const found = problems(task, e, f);
    const kept = { E: join(HOME, task, "prompt-E.md"), F: join(HOME, task, "prompt-F.md") };
    if (flags.includes("--check")) {
      for (const [arm, text] of [["E", e.prompt], ["F", f.prompt]]) {
        if (!existsSync(kept[arm]) || readFileSync(kept[arm], "utf8") !== text) found.push(`${relative(root, kept[arm])} is not what the rule derives today; run compare-arms-ef.mjs --write`);
      }
    } else {
      console.log(`${task}\n  arm E: ${e.prompt.length} characters; arm D's prompt and one section naming ${reviewersFiles(task).join(", ")}`);
      console.log(`  arm F: ${f.prompt.length} characters; the ${f.template} package with ${slotsOfF(task).changed.join(", ")} filled without held-out material, flattened by the protocol's rule (${f.models})`);
      if (flags.includes("--write")) {
        mkdirSync(join(HOME, task), { recursive: true });
        writeFileSync(kept.E, e.prompt, "utf8");
        writeFileSync(kept.F, f.prompt, "utf8");
        console.log(`  wrote ${relative(root, kept.E)} and ${relative(root, kept.F)}`);
      }
    }
    for (const problem of found) console.error(`  ${task}: ${problem}`);
    bad += found.length;
  }
  if (flags.includes("--check") && bad === 0) console.log("arms E and F: the kept prompts are the ones the rule derives today, for all three tasks");
  if (!flags.includes("--check")) console.log("no model session was started");
  process.exit(bad === 0 ? 0 : 1);
}
