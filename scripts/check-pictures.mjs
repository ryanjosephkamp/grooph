#!/usr/bin/env node
/**
 * The size rule for pictures (handoff 0081): a picture under handoffs/, docs/ or apps/web/public/ weighs at most
 * 150 KB, and a GIF the README shows at most 1.5 MB. A clone carries every picture ever committed, so a set of
 * screenshots belongs on a published page and not in git (handoffs/README.md, "Rules for both sides").
 *
 * The pictures that were over the limit when the rule was made are listed in scripts/pictures-baseline.json with
 * the size they had. They are left alone: none may grow, and no picture joins them through this script.
 *
 *   node scripts/check-pictures.mjs           say what is there: how many, how heavy, which are over
 *   node scripts/check-pictures.mjs --check   exit 1 on a picture over its limit or a baseline that is stale (CI)
 *   node scripts/check-pictures.mjs --prune   drop baseline entries that are gone or now fit, lower those that shrank
 *
 * `--prune` only ever tightens. Letting one more picture through is a line added to the baseline by hand, in a
 * pull request that says why.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const ROOTS = ["handoffs", "docs", "apps/web/public"];
export const PICTURE = /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|ico|heic|svg|mp4|webm|mov)$/i;
export const LIMIT = 150 * 1024;
export const README_GIF_LIMIT = 1536 * 1024;
export const BASELINE = "scripts/pictures-baseline.json";

const kb = (bytes) => `${Math.ceil(bytes / 1024)} KB`;

/** What a picture may weigh: 1.5 MB for a GIF the README names by its path, 150 KB for everything else. */
export const limitFor = (path, readme) => (/\.gif$/i.test(path) && readme.includes(path) ? README_GIF_LIMIT : LIMIT);

/**
 * Hold the pictures against the rule and the baseline.
 *
 * `pictures` is `[{ path, bytes }]`, `baseline` is `{ path: bytes }`. Returns the lines to print for what breaks the
 * rule (`over`), for what makes the baseline stale (`stale`), and the baseline `--prune` would write (`pruned`).
 */
export function judge(pictures, baseline, readme = "") {
  const over = [];
  const stale = [];
  const pruned = {};
  const seen = new Map(pictures.map((picture) => [picture.path, picture.bytes]));

  for (const { path, bytes } of pictures) {
    const limit = limitFor(path, readme);
    if (bytes <= limit) continue;
    const allowed = baseline[path];
    if (allowed === undefined) over.push(`${path} is ${kb(bytes)}, over the ${kb(limit)} limit`);
    else if (bytes > allowed) over.push(`${path} is ${kb(bytes)}: it was ${kb(allowed)} when the rule was made and may not grow`);
    else pruned[path] = bytes;
  }

  for (const [path, allowed] of Object.entries(baseline)) {
    const bytes = seen.get(path);
    if (bytes === undefined) stale.push(`${path} is in the baseline and no longer in the tree`);
    else if (bytes <= limitFor(path, readme)) stale.push(`${path} is in the baseline and now fits (${kb(bytes)})`);
    else if (bytes < allowed) stale.push(`${path} is in the baseline at ${kb(allowed)} and is now ${kb(bytes)}`);
  }

  return { over, stale, pruned };
}

/** Every picture git tracks or would track under the three folders, with its size on disk. */
export function findPictures(cwd = root) {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...ROOTS], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(listed.split("\0"))]
    .filter((path) => PICTURE.test(path) && existsSync(join(cwd, path)))
    .sort()
    .map((path) => ({ path, bytes: statSync(join(cwd, path)).size }));
}

const baselineText = (pictures) =>
  `${JSON.stringify(
    {
      note: "Pictures that were over the size rule when it was made (handoff 0081), with their size in bytes. scripts/check-pictures.mjs leaves them alone and lets none grow. Do not add to this list to get a picture past the check: make it a JPEG under 150 KB, or put the set on a published page.",
      pictures: Object.fromEntries(Object.entries(pictures).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    },
    null,
    2,
  )}\n`;

function main() {
  const fail = (message) => {
    console.error(`check-pictures: ${message}`);
    process.exit(1);
  };

  const pictures = findPictures();
  // A check that finds nothing to weigh has not checked anything.
  if (pictures.length === 0) fail(`no picture found under ${ROOTS.join(", ")}; is this a git checkout of grooph?`);

  const baselinePath = join(root, BASELINE);
  if (!existsSync(baselinePath)) fail(`${BASELINE} is missing`);
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).pictures;
  if (baseline === null || typeof baseline !== "object") fail(`${BASELINE} has no "pictures" object`);

  const readme = readFileSync(join(root, "README.md"), "utf8");
  const { over, stale, pruned } = judge(pictures, baseline, readme);
  const total = pictures.reduce((sum, picture) => sum + picture.bytes, 0);
  const summary = `${pictures.length} pictures, ${(total / 1024 / 1024).toFixed(1)} MB; ${Object.keys(pruned).length} from before the rule are over ${kb(LIMIT)} and left alone`;

  if (process.argv.includes("--prune")) {
    if (over.length > 0) console.error(over.join("\n"));
    writeFileSync(baselinePath, baselineText(pruned));
    console.log(`wrote ${BASELINE} (${Object.keys(pruned).length} pictures, ${stale.length} entries tightened)`);
    process.exit(over.length > 0 ? 1 : 0);
  }

  if (over.length > 0) {
    console.error(over.join("\n"));
    console.error(
      `\nA picture in git is at most ${kb(LIMIT)} (a GIF the README shows, ${kb(README_GIF_LIMIT)}): save it as a JPEG, or put a set of before-and-after shots on a published page and give its address (handoffs/README.md).`,
    );
  }
  if (stale.length > 0) {
    console.error(stale.join("\n"));
    console.error(`\nstale: ${BASELINE}; run \`node scripts/check-pictures.mjs --prune\` and commit the result`);
  }
  if (over.length + stale.length > 0) {
    if (process.argv.includes("--check")) process.exit(1);
    return;
  }
  console.log(`pictures are inside the size rule: ${summary}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
