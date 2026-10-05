/**
 * The CLI as one file: core and every command inlined, nothing to install beside it.
 * The npm package, the chat skill and the desktop extension all carry this file
 * (packages/cli/src/paths.ts says where each keeps the patterns, hooks and app around it).
 *
 * The only import left outside is the PNG renderer, an optional dependency with a
 * binary per platform: without it `grooph image --out x.png` says so and the SVG still works.
 */

import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";

export const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repo = join(pkg, "..", "..");

/** Bundle the built CLI (`pnpm -r build` first) into `outFile`, executable, starting with a shebang. */
export async function bundleCli(outFile) {
  const entry = join(pkg, "dist", "src", "main.js");
  if (!existsSync(entry)) throw new Error("the CLI is not built: run pnpm -r build first");
  mkdirSync(dirname(outFile), { recursive: true });
  const bundle = await rolldown({ input: entry, platform: "node", external: [/^node:/, "@resvg/resvg-js"], logLevel: "warn" });
  try {
    // Comments are for a reader of the source, which the repository has; the one file a person installs carries none.
    await bundle.write({ file: outFile, format: "esm", banner: "#!/usr/bin/env node", codeSplitting: false, sourcemap: false, comments: false });
  } finally {
    await bundle.close();
  }
  chmodSync(outFile, 0o755);
  return outFile;
}
