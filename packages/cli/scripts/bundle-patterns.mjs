#!/usr/bin/env node
/**
 * Bundle the built-in pattern library into dist/patterns/ at build time
 * (docs/templates.md §3), so the CLI resolves built-in templates from its own
 * files wherever it is installed. Run by `pnpm build` after tsc.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(pkg, "..", "..", "patterns");
const to = join(pkg, "dist", "patterns");

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((name) => name.endsWith(".grooph.json") || name === "index.json");
for (const file of files) copyFileSync(join(from, file), join(to, file));
// The pre-drawn glyphs too (slice 0015), so `template list --json` can point at one per built-in template.
const glyphs = existsSync(join(from, "glyphs")) ? readdirSync(join(from, "glyphs")).filter((name) => name.endsWith(".svg")) : [];
if (glyphs.length > 0) mkdirSync(join(to, "glyphs"), { recursive: true });
for (const file of glyphs) copyFileSync(join(from, "glyphs", file), join(to, "glyphs", file));
console.log(`bundled ${files.length} pattern files and ${glyphs.length} glyphs into dist/patterns/`);

// The plan templates (plans/), beside the library and apart from it: no index, no glyphs, and no count of the
// built-in templates includes them. `grooph template list` shows them under a heading of their own.
const plansFrom = join(pkg, "..", "..", "plans");
const plansTo = join(pkg, "dist", "plans");
rmSync(plansTo, { recursive: true, force: true });
const plans = existsSync(plansFrom) ? readdirSync(plansFrom).filter((name) => name.endsWith(".grooph.json")) : [];
if (plans.length > 0) mkdirSync(plansTo, { recursive: true });
for (const file of plans) copyFileSync(join(plansFrom, file), join(plansTo, file));
console.log(`bundled ${plans.length} plan templates into dist/plans/`);
