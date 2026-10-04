#!/usr/bin/env node
/**
 * The version in one place (handoff 0081): grooph's version is written in eight files, and this is the one command
 * that reads them all and the one command that writes them all.
 *
 *   node scripts/version.mjs            say the version and where it is written
 *   node scripts/version.mjs --check    exit 1 when the eight places disagree, or one cannot be found (CI)
 *   node scripts/version.mjs <x.y.z>    write that version in all eight
 *
 * Writing changes those eight files and nothing else: no commit, no tag, no publish. A release is the owner's
 * (decision 0023). A place is found by the exact line around it, so a file that was reshaped stops the script
 * before anything is written; fix the pattern below in the same change.
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const manifest = /^  "version": "([^"]*)",?$/dgm;

/** Where the version is written. Each pattern matches once in its file and captures the version alone. */
export const PLACES = [
  { file: "package.json", pattern: manifest },
  { file: "packages/core/package.json", pattern: manifest },
  { file: "packages/cli/package.json", pattern: manifest },
  { file: "apps/web/package.json", pattern: manifest },
  // What `grooph --version` prints.
  { file: "packages/cli/src/index.ts", pattern: /^export const VERSION = "([^"]*)";$/dgm },
  // What the app writes into an offline page it saves.
  { file: "apps/web/src/doc/keep.ts", pattern: /^export const APP_VERSION = "([^"]*)";$/dgm },
  // The browser test that holds the app's saved page to the CLI's, byte for byte.
  { file: "apps/web/e2e/keep.spec.ts", pattern: /offlinePage\(reviewLoop\(\), \{ version: "([^"]*)" \}\)/dg },
  // The install script's test asks the linked CLI for its version.
  { file: "scripts/test-install-local.sh", pattern: /--version\)" == "([^"]*)" \]\]/dg },
];

const VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Read every place under `dir`. Each result has the file, its text, and either the version with where it sits in
 * the text or the reason it could not be read.
 */
export function readPlaces(dir = root) {
  return PLACES.map(({ file, pattern }) => {
    const path = join(dir, file);
    if (!existsSync(path)) return { file, problem: "the file is missing" };
    const text = readFileSync(path, "utf8");
    const hits = [...text.matchAll(pattern)];
    if (hits.length !== 1) return { file, problem: `the version line was found ${hits.length} times, not once (${pattern.source})` };
    const [start, end] = hits[0].indices[1];
    return { file, text, version: hits[0][1], start, end };
  });
}

function main() {
  const arg = process.argv[2];
  const places = readPlaces();
  const width = Math.max(...PLACES.map((place) => place.file.length));
  const table = () => places.map((place) => `  ${place.file.padEnd(width)}  ${place.version ?? `? ${place.problem}`}`).join("\n");

  // A place that cannot be read is never guessed at: nothing is checked as fine and nothing is written.
  const unread = places.filter((place) => place.problem !== undefined);
  if (unread.length > 0) {
    console.error(`version: ${unread.length} of ${places.length} places could not be read\n${table()}`);
    process.exit(1);
  }

  const versions = [...new Set(places.map((place) => place.version))];

  if (arg === undefined || arg === "--check") {
    if (versions.length > 1) {
      console.error(`version: the ${places.length} places disagree\n${table()}\n\nwrite one version in all of them with \`node scripts/version.mjs <x.y.z>\``);
      process.exit(1);
    }
    if (!VERSION.test(versions[0])) {
      console.error(`version: "${versions[0]}" is not a version of the form x.y.z\n${table()}`);
      process.exit(1);
    }
    console.log(arg === "--check" ? `the version is ${versions[0]} in all ${places.length} places` : `${versions[0]}\n${table()}`);
    return;
  }

  if (!VERSION.test(arg)) {
    console.error(`version: "${arg}" is not a version of the form x.y.z\n\n  node scripts/version.mjs            say the version and where it is written\n  node scripts/version.mjs --check    exit 1 when the places disagree\n  node scripts/version.mjs <x.y.z>    write that version in all ${places.length}`);
    process.exit(2);
  }

  let changed = 0;
  for (const place of places) {
    if (place.version === arg) continue;
    writeFileSync(join(root, place.file), place.text.slice(0, place.start) + arg + place.text.slice(place.end));
    console.log(`  ${place.file.padEnd(width)}  ${place.version} → ${arg}`);
    changed += 1;
  }
  console.log(changed === 0 ? `the version is already ${arg} in all ${places.length} places` : `wrote ${arg} in ${changed} of ${places.length} places`);
  if (changed > 0) console.log("next: pnpm -r build && pnpm -r test; the commit, the tag and the publish are a release, and a release is the owner's");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
