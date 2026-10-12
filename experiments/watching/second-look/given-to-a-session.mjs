#!/usr/bin/env node
/**
 * What the second look's runner hands a session, for each of its thirty-six runs, with a stand-in for every path:
 * the prompt, the packages its folder is made of, what is closed to it, the command and the environment the harness
 * is started with, the settings the profile holds when it starts, and, in the `outside` arm, the launcher's whole text.
 *
 *   node experiments/watching/second-look/given-to-a-session.mjs [<the root of a checkout>]
 *
 * prints it for that checkout's runner (this one's, with no root named), as the JSON kept beside this script in
 * given-to-a-session.json: the checksum of the runner that made it, one checksum for each run, one run in full, and
 * a checksum of every module the runner's script loads. It starts nothing, builds nothing and writes nothing.
 *
 *   node experiments/watching/second-look/given-to-a-session.mjs --check [<the root of a checkout>]
 *
 * sets that checkout beside the kept file and says, in two lines, whether its runner hands a session what the kept
 * file says in every run, and whether every module the runner's script loads is byte for byte what it was. It exits
 * 1 if either is not so. The runner's own checksum is of six files; this is how the rest is looked at, in the
 * checkout the runs are made from, before a block goes on.
 *
 * WHY IT IS KEPT. The runner was corrected once while the look was being run (README.md, the note of 2026-10-12): a
 * check it makes after a session had taken a folder of the harness's own for grooph's. The runs made before the
 * correction and after it are runs of one look only if a session was handed the same thing by both runners. The file
 * beside this one was made by the runner as it was before the correction, and a test holds the runner as it is now to
 * it, run by run.
 *
 * WHAT IT IS NOT. It is put together from the pieces a runner starts a session with, and is not a recording of a
 * session being started: that the runner really starts one with these pieces is held by the test of the three arms,
 * which sets what a stand-in for the harness was started with beside what this says, arm by arm. The hook and the
 * built tool are not in it either, nor what an install leaves: the runner compares their checksums itself, run by run.
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sha = (text) => createHash("sha256").update(text).digest("hex");

/** One checksum of every file under a folder, by its path from it and its bytes, in order. */
function treeSha(dir) {
  const hash = createHash("sha256");
  const walk = (at, from) => {
    for (const name of readdirSync(at).sort()) {
      const full = join(at, name);
      if (lstatSync(full).isDirectory()) walk(full, `${from}${name}/`);
      else hash.update(`${from}${name}\0`).update(readFileSync(full)).update("\0");
    }
  };
  walk(dir, "");
  return hash.digest("hex");
}

/** The runner's own script: what the correction changed, and what the runner's checksum names. */
const RUNNERS_SCRIPT = "scripts/lib/watching-second-look-paid.mjs";

/**
 * Every module the runner's script loads, found by following its imports of files beside it, and theirs: each by its
 * path from the checkout's root, with a checksum of its bytes. The runner's own script is left out. The runner's
 * checksum covers four of these (with the script itself and the profile's settings); the others are covered by
 * nothing the runner compares, so all are kept here as they were when the first five runs were made.
 */
export function modulesOf(root) {
  const seen = new Map();
  const queue = [RUNNERS_SCRIPT];
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    let text = null;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {}
    seen.set(path, text === null ? "not there" : sha(text));
    for (const [, to] of (text ?? "").matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g)) queue.push(normalize(join(dirname(path), to)));
  }
  seen.delete(RUNNERS_SCRIPT);
  return Object.fromEntries([...seen].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The stand-ins: no path of a machine is in what is compared. */
export const STAND_INS = { home: "/the/profiles/home", folder: "/the/profiles/home/work/a-session/packages", temp: "/the/users/temp", harness: "/the/harness", node: "/the/node", cli: "/the/tool", session: "<the session's id>", user: "someone", userHome: "/Users/someone" };

/**
 * What a runner hands a session in each run. `runner` is the second look's runner as a module, `first` the first
 * check's, `profile` the comparison profile's, and `root` the checkout they are in (for the packages a folder is made
 * of). `places` puts real paths where the stand-ins are, for a test that sets this beside a session really started.
 */
export function givenBy({ runner, first, profile, root, places = STAND_INS }) {
  const { home: HOME, folder: FOLDER } = places;
  const folders = Object.fromEntries(Object.entries(runner.TASKS).map(([task, made]) => [task, { repository: made.repository, packages: made.packages.map((pkg) => ({ folder: pkg.folder, project: pkg.project, its_files_sha256: treeSha(join(root, "experiments", "comparisons", pkg.project, "task")) })) }]));
  const runs = {};
  for (const run of runner.order()) {
    const prompt = runner.promptFor(run);
    const closed = run.arm === "watched" ? first.CLOSED_IN_A_WATCHED_ARM.map((path) => `${FOLDER}/${path}`) : [];
    const launcher = run.arm === "outside" ? runner.launcherText({ harness: places.harness, node: places.node, cli: places.cli, groophHome: runner.groophHomeIn(HOME), configDir: profile.layout(HOME).profile, folder: FOLDER, dir: `${HOME}/home` }) : null;
    // The command and the environment the profile's own runner would start: the harness, or in the outside arm the launcher in its place.
    const command = profile.commandFor({ home: HOME, claude: launcher === null ? places.harness : `${HOME}/home/launch-outside.sh`, cwd: FOLDER, prompt, ...runner.LEAD[run.block], sessionId: places.session, maxBudgetUsd: runner.WATCHDOG[run.block][run.task].usd, closed, unpinned: first.LEFT_TO_THE_HARNESS, ...(places.user ? { user: places.user, userHome: places.userHome } : {}) });
    runs[run.name] = {
      round: run.round,
      prompt_sha256: sha(prompt),
      prompt_characters: prompt.length,
      the_folder_is_made_of: folders[run.task],
      closed_to_the_session: closed,
      stops_at_minutes: runner.WATCHDOG[run.block][run.task].minutes,
      started_with: command.argv.map((arg) => (arg === prompt ? "<the prompt>" : arg)),
      environment: command.env,
      // The profile's settings as the lab's runner writes them just before it starts a session. In the outside arm the
      // launcher then has the tool add the recorder's entries: that is the tool's doing, and its checksum's to hold.
      the_profiles_settings: profile.settingsFor({ home: HOME, ...(places.temp ? { temp: places.temp } : {}), closed }),
      launcher,
    };
  }
  return runs;
}

const ABOUT =
  "What the second look's runner hands a session in each of its thirty-six runs, as checksums, with one run in full: made by `node experiments/watching/second-look/given-to-a-session.mjs <the root of a checkout>` and never by hand. `made_by_the_runner` is the checksum of the runner that made it. The runner was corrected once while the look was being run (README.md, the note of 2026-10-12), and a test holds the runner as it is now to this file run by run, so that runs made before the correction and after it were handed the same thing. Every path is a stand-in. It is put together from the pieces a runner starts a session with; a test of the three arms sets it beside a session really started. The hook, the built tool and what an install leaves are not here: the runner compares their checksums itself. `the_modules_the_runners_script_loads` is every module that script loads, found by following its imports, each with a checksum of its bytes as it was when this file was made (the script itself is left out): the runner's own checksum covers four of them, and `--check` sets a checkout beside all of them.";

/** The file's shape: the runner that made it, one checksum for each run, one run of the outside arm in full, to be read, and the modules the runner's script loads. */
export function asKept(runs, runnerSha256, modules = {}) {
  return { about: ABOUT, made_by_the_runner: runnerSha256, runs: Object.fromEntries(Object.entries(runs).map(([name, run]) => [name, sha(JSON.stringify(run))])), one_in_full: { "opus/six/outside-1": runs["opus/six/outside-1"] }, the_modules_the_runners_script_loads: modules };
}

/** A checkout's file, as `asKept` makes it, set beside the kept one: the runs whose checksum differs, and the modules that differ, are not there, or are new. */
export function setBeside(made, kept) {
  const differing = (a = {}, b = {}) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((name) => a[name] !== b[name]).sort();
  return { runs: Object.keys(kept.runs ?? {}).length, runs_that_differ: differing(made.runs, kept.runs), modules: Object.keys(kept.the_modules_the_runners_script_loads ?? {}).length, modules_that_differ: differing(made.the_modules_the_runners_script_loads, kept.the_modules_the_runners_script_loads) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const root = resolve(args.find((arg) => arg !== "--check") ?? join(here, "..", "..", ".."));
  const load = (path) => import(pathToFileURL(join(root, "scripts", "lib", path)).href);
  const [runner, first, profile] = [await load("watching-second-look-paid.mjs"), await load("watching-check-paid.mjs"), await load("compare-profile.mjs")];
  const made = asKept(givenBy({ runner, first, profile, root }), runner.checkout().runner_sha256, modulesOf(root));
  if (!args.includes("--check")) process.stdout.write(`${JSON.stringify(made, null, 2)}\n`);
  else {
    const kept = JSON.parse(readFileSync(join(here, "given-to-a-session.json"), "utf8"));
    const beside = setBeside(made, kept);
    const short = (sum) => String(sum).slice(0, 8);
    console.log(beside.runs_that_differ.length === 0 ? `given to a session: the runner ${short(made.made_by_the_runner)} hands a session what the runner ${short(kept.made_by_the_runner)} did, in each of the ${beside.runs} runs` : `given to a session: NOT THE SAME in ${beside.runs_that_differ.length} of ${beside.runs} runs (${beside.runs_that_differ.slice(0, 6).join(", ")}${beside.runs_that_differ.length > 6 ? ", ..." : ""}): the runner ${short(made.made_by_the_runner)} does not hand a session what the runner ${short(kept.made_by_the_runner)} did`);
    console.log(beside.modules_that_differ.length === 0 ? `the modules the runner's script loads: each of the ${beside.modules} is byte for byte what it was when the runner ${short(kept.made_by_the_runner)} made its runs` : `the modules the runner's script loads: NOT WHAT THEY WERE: ${beside.modules_that_differ.join(", ")}`);
    process.exit(beside.runs_that_differ.length === 0 && beside.modules_that_differ.length === 0 ? 0 : 1);
  }
}
