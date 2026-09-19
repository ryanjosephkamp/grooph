#!/usr/bin/env node
/**
 * Bundle the built-in pattern library into dist/patterns/ at build time
 * (docs/templates.md §3), so the CLI resolves built-in templates from its own
 * files wherever it is installed. Run by `pnpm build` after tsc.
 */

import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(pkg, "..", "..", "patterns");
const to = join(pkg, "dist", "patterns");

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((name) => name.endsWith(".grooph.json") || name === "index.json");
for (const file of files) copyFileSync(join(from, file), join(to, file));
console.log(`bundled ${files.length} pattern files into dist/patterns/`);
