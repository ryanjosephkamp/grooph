#!/usr/bin/env node
/**
 * Assemble the package that goes to npm as `grooph`, in dist/npm/:
 *
 *   package.json            name grooph, the version of this workspace package, no dependencies
 *   dist/bundle/grooph.js   the CLI and core as one file (scripts/bundle.mjs): the `grooph` command
 *   dist/patterns/          the built-in templates
 *   dist/app/               the built web app `grooph watch` serves, without its source maps
 *   hooks/                  the event hook and the script that sends events to a branch
 *   README.md, LICENSE
 *
 * The workspace package stays `@grooph/cli` and private: the workspace's root is itself named
 * `grooph` and depends on this package by that name, and a published package cannot depend on
 * `workspace:*`. So what is published is made here, from what `pnpm -r build` built, and
 * `npm pack` and `npm publish` are run on dist/npm.
 *
 *   node packages/cli/scripts/npm-package.mjs          # after pnpm -r build
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { bundleCli, pkg, repo } from "./bundle.mjs";

const out = join(pkg, "dist", "npm");
const app = join(repo, "apps", "web", "dist");
const fail = (message) => {
  console.error(`npm-package: ${message}`);
  process.exit(1);
};

if (!existsSync(join(pkg, "dist", "patterns", "index.json"))) fail("the CLI is not built: run pnpm -r build first");
if (!existsSync(join(app, "index.html"))) fail("the web app is not built (apps/web/dist): run pnpm -r build first");

const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await bundleCli(join(out, "dist", "bundle", "grooph.js"));
cpSync(join(pkg, "dist", "patterns"), join(out, "dist", "patterns"), { recursive: true });
cpSync(join(pkg, "hooks"), join(out, "hooks"), { recursive: true });
// The app as `vite build` leaves it, less the source maps (three megabytes nobody watching a run reads) and less what
// the site adds beside it after a build: the rendered documents, the published templates, the gallery. A local run of
// the browser tests leaves those in apps/web/dist, and none of them is the app.
const SITE_ONLY = new Set(["docs", "patterns", "community"]);
cpSync(app, join(out, "dist", "app"), { recursive: true, filter: (source) => !source.endsWith(".map") && !SITE_ONLY.has(relative(app, source).split(sep)[0]) });
// A mark that this folder is grooph's app, put there by this script: `grooph watch` serves the packaged copy only when it finds it.
writeFileSync(join(out, "dist", "app", "grooph-app.json"), `${JSON.stringify({ app: "grooph", version: manifest.version })}\n`);
cpSync(join(pkg, "README.md"), join(out, "README.md"));
cpSync(join(repo, "LICENSE"), join(out, "LICENSE"));

writeFileSync(
  join(out, "package.json"),
  `${JSON.stringify(
    {
      name: "grooph",
      version: manifest.version,
      description: "Author, check and compile multi-agent loop graphs for a coding harness: templates, a validator with stable rule codes, a compiler to a prompt package, and an MCP server. It never runs agents.",
      license: manifest.license,
      type: "module",
      bin: { grooph: "dist/bundle/grooph.js" },
      files: ["dist", "hooks"],
      engines: { node: ">=22" },
      optionalDependencies: manifest.optionalDependencies,
      repository: { type: "git", url: "git+https://github.com/ryanjosephkamp/grooph.git", directory: "packages/cli" },
      homepage: "https://ryanjosephkamp.github.io/grooph/",
      bugs: "https://github.com/ryanjosephkamp/grooph/issues",
      keywords: ["multi-agent", "agents", "loop-graph", "workflow", "prompt-package", "claude-code", "codex", "mcp", "mcp-server"],
    },
    null,
    2,
  )}\n`,
);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push([relative(out, full), statSync(full).size]);
  }
};
walk(out);
const total = files.reduce((n, [, size]) => n + size, 0);
const part = (prefix) => files.filter(([path]) => path.startsWith(prefix)).reduce((n, [, size]) => n + size, 0);
const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString("en")} KB`;
console.log(`grooph@${manifest.version} assembled in ${relative(repo, out)}: ${files.length} files, ${kb(total)} unpacked`);
console.log(`  the command  ${kb(part("dist/bundle/"))}`);
console.log(`  templates    ${kb(part("dist/patterns/"))}`);
console.log(`  the app      ${kb(part("dist/app/"))}`);
console.log(`  hooks        ${kb(part("hooks/"))}`);
console.log(`next: (cd ${relative(repo, out)} && npm pack --dry-run) lists what would be published; scripts/pack-check.sh installs the tarball in a fresh folder and runs it`);
