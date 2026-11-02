#!/usr/bin/env node
/**
 * The app's Sketch view is mermaidify's drawing page: its drawing surface, its reader, and its tools, templates, and
 * drawing file. Those files are copied into apps/web/src/ui/sketch/mermaidify/ exactly as one mermaidify release has
 * them, never edited here, and SOURCE.json there records the release, its commit, and each file's SHA-256.
 *
 *   node scripts/mermaidify.mjs --check                      exit 1 when a copied file differs from SOURCE.json, or the
 *                                                            folder holds a file the release does not (apps/web's tests
 *                                                            run the same check, so CI does)
 *   node scripts/mermaidify.mjs --check --from <checkout>    and when SOURCE.json differs from that release's files
 *   node scripts/mermaidify.mjs --from <checkout> --ref <tag>   copy the files from that release and rewrite SOURCE.json
 *
 * Without a checkout, a copied file edited together with its line in SOURCE.json passes; `--from` is what holds
 * SOURCE.json itself to the release. A checkout is only read, through `git show`, so its working tree and branch stay
 * as they are. A change the app needs in these files is made in mermaidify and arrives here with its next release.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEST = join(root, "apps/web/src/ui/sketch/mermaidify");

/** What is copied, by its path in mermaidify; it lands at the same path under DEST, without `src/`. */
export const FILES = [
  "src/reader/arrows.ts",
  "src/reader/geometry.ts",
  "src/reader/index.ts",
  "src/reader/mermaid.ts",
  "src/reader/recognize.ts",
  "src/reader/shapes.ts",
  "src/reader/snap.ts",
  "src/app/cut.ts",
  "src/app/drawing.ts",
  "src/app/pad.ts",
  "src/app/select.ts",
  "src/app/templates.ts",
  "src/app/tidy.ts",
  "src/example.ts",
  "LICENSE",
];

export const local = (file) => file.replace(/^src\//, "");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Each copied file whose bytes are not the ones SOURCE.json records, or that is missing. */
export function drifted(source = JSON.parse(readFileSync(join(DEST, "SOURCE.json"), "utf8"))) {
  const wrong = [];
  for (const file of FILES) {
    const at = local(file);
    let bytes;
    try {
      bytes = readFileSync(join(DEST, at));
    } catch {
      wrong.push(`${at}: missing`);
      continue;
    }
    if (source.files[at] !== sha256(bytes)) wrong.push(`${at}: not the release's bytes`);
  }
  for (const at of Object.keys(source.files)) if (!FILES.some((file) => local(file) === at)) wrong.push(`${at}: recorded, but not copied`);
  // A file put in beside the release's would be built into the app with them, and checked by nothing.
  const known = new Set([...FILES.map(local), "SOURCE.json"]);
  // A file whose name starts with a dot (a Finder .DS_Store) is the computer's own, never the release's, and git ignores it.
  const walk = (dir) => readdirSync(dir).filter((name) => !name.startsWith(".")).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [relative(DEST, join(dir, name)).split(sep).join("/")]));
  for (const at of walk(DEST)) if (!known.has(at)) wrong.push(`${at}: not part of the release; delete it`);
  return wrong;
}

/** Git's answer, or a one-line reason and exit 1: a tag or a file the checkout does not have is said, not thrown. */
const git = (checkout, ...args) => {
  try {
    return execFileSync("git", ["-C", checkout, ...args], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const lines = String(err.stderr ?? err.message).trim().split("\n");
    const said = lines.find((line) => line.startsWith("fatal:")) ?? lines[0];
    console.error(`mermaidify: git ${args.join(" ")} in ${checkout} failed: ${said}`);
    process.exit(1);
  }
};

function main(argv) {
  const at = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const from = at("--from");
  if (argv.includes("--check")) {
    const source = JSON.parse(readFileSync(join(DEST, "SOURCE.json"), "utf8"));
    const wrong = drifted(source);
    if (from) {
      for (const file of FILES) {
        const theirs = sha256(git(from, "show", `${source.commit}:${file}`));
        if (theirs !== source.files[local(file)]) wrong.push(`${local(file)}: SOURCE.json does not match mermaidify ${source.release} at ${source.commit}`);
      }
      const tagged = git(from, "rev-parse", `${source.tag}^{commit}`).toString().trim();
      if (tagged !== source.commit) wrong.push(`SOURCE.json says ${source.tag} is ${source.commit}, and that checkout says ${tagged}`);
    }
    if (wrong.length > 0) {
      console.error(`mermaidify's copied files are not the release's (${source.tag}):\n  ${wrong.join("\n  ")}\nCopy a changed or missing file again with node scripts/mermaidify.mjs --from <checkout> --ref <tag>, and delete one that is not part of the release.`);
      process.exit(1);
    }
    console.log(`mermaidify ${source.release} (${source.tag}, ${source.commit.slice(0, 12)}): ${FILES.length} files, as released${from ? ", checked against the checkout" : ""}.`);
    return;
  }
  const ref = at("--ref");
  if (!from || !ref) {
    console.error("Usage: node scripts/mermaidify.mjs --check [--from <checkout>] | --from <checkout> --ref <tag>");
    process.exit(2);
  }
  const commit = git(from, "rev-parse", `${ref}^{commit}`).toString().trim();
  const release = JSON.parse(git(from, "show", `${commit}:package.json`).toString()).version;
  const files = {};
  for (const file of FILES) {
    const bytes = git(from, "show", `${commit}:${file}`);
    mkdirSync(dirname(join(DEST, local(file))), { recursive: true });
    writeFileSync(join(DEST, local(file)), bytes);
    files[local(file)] = sha256(bytes);
  }
  const source = { from: "https://github.com/ryanjosephkamp/mermaidify", release, tag: ref, commit, files };
  writeFileSync(join(DEST, "SOURCE.json"), `${JSON.stringify(source, null, 2)}\n`);
  console.log(`Copied ${FILES.length} files from mermaidify ${release} (${ref}, ${commit.slice(0, 12)}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
