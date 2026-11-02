#!/usr/bin/env node
/**
 * grooph on a page (browser/index.ts), built for a browser into dist/browser/: `grooph.js`, an ES module, and
 * `grooph.global.js`, a script that sets one `grooph` global, with `grooph.d.ts` beside them. The npm package carries
 * the folder (scripts/npm-package.mjs). Run by `pnpm -r build`, after core is built.
 */

import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { bundleBrowser, pkg } from "./bundle.mjs";

const out = join(pkg, "dist", "browser");
mkdirSync(out, { recursive: true });
await bundleBrowser(out);
copyFileSync(join(pkg, "browser", "grooph.d.ts"), join(out, "grooph.d.ts"));
console.log("built dist/browser/grooph.js and grooph.global.js");
