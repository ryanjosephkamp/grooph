#!/usr/bin/env node
/**
 * Assemble the package that goes to npm as `grooph`, in dist/npm/:
 *
 *   package.json            name grooph, the version of this workspace package, no dependencies and one
 *                           optional one (@resvg/resvg-js, for PNG; it has no install script)
 *   dist/bundle/grooph.js   the CLI and core as one file (scripts/bundle.mjs): the `grooph` command
 *   dist/patterns/          the built-in templates
 *   dist/plans/             the plan templates, listed apart from them
 *   THIRD-PARTY-NOTICES.md  every other package whose code is in dist/app or dist/bundle, with its license's text
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
import { dirname, join, relative, resolve, sep } from "node:path";

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

/** Every module the one-file command is made of, as the bundler lists them. */
let commandModules = [];
await bundleCli(join(out, "dist", "bundle", "grooph.js"), (ids) => (commandModules = ids));
cpSync(join(pkg, "dist", "patterns"), join(out, "dist", "patterns"), { recursive: true });
if (!existsSync(join(pkg, "dist", "plans"))) fail("the CLI is not built with its plan templates: run pnpm -r build first");
cpSync(join(pkg, "dist", "plans"), join(out, "dist", "plans"), { recursive: true });
cpSync(join(pkg, "hooks"), join(out, "hooks"), { recursive: true });
// The app as `vite build` leaves it, less the source maps (three megabytes nobody watching a run reads) and less what
// the site adds beside it after a build: the rendered documents, the published templates, the gallery. A local run of
// the browser tests leaves those in apps/web/dist, and none of them is the app.
const SITE_ONLY = new Set(["docs", "patterns", "community"]);
cpSync(app, join(out, "dist", "app"), { recursive: true, filter: (source) => !source.endsWith(".map") && !SITE_ONLY.has(relative(app, source).split(sep)[0]) });
// A script or a style sheet ends with a line that names its source map. The maps are not here, so the line would only
// make a browser ask `grooph watch` for a file it does not have.
const assets = join(out, "dist", "app", "assets");
for (const name of existsSync(assets) ? readdirSync(assets) : []) {
  if (!/\.(?:js|css)$/.test(name)) continue;
  const file = join(assets, name);
  const text = readFileSync(file, "utf8");
  const bare = text.replace(/\n?\/\/# sourceMappingURL=\S+\.map\s*$/, "\n").replace(/\n?\/\*# sourceMappingURL=\S+\.map \*\/\s*$/, "\n");
  if (bare !== text) writeFileSync(file, bare);
}
// A mark that this folder is grooph's app, put there by this script: `grooph watch` serves the packaged copy only when it finds it.
writeFileSync(join(out, "dist", "app", "grooph-app.json"), `${JSON.stringify({ app: "grooph", version: manifest.version })}\n`);
cpSync(join(pkg, "README.md"), join(out, "README.md"));
cpSync(join(repo, "LICENSE"), join(out, "LICENSE"));

// ─── third-party notices ──────────────────────────────────────────────────
// The app and the command are built files with other people's code inside them, and those people's licenses ask
// that the notice travel with every copy. Which packages are inside is not guessed from a list of dependencies:
// it is read from what the builds themselves say went in. For the app, its own source maps name every module of
// every script (the maps stay out of the package; they are read here, where the app was built). For the command,
// the bundler hands over its module list. A module under node_modules belongs to the package whose folder it is in.
const NOTICES = "THIRD-PARTY-NOTICES.md";
const packageDirOf = (file) => {
  const at = file.lastIndexOf(`${sep}node_modules${sep}`);
  if (at === -1) return undefined;
  const [first, second] = file.slice(at + `${sep}node_modules${sep}`.length).split(sep);
  return join(file.slice(0, at), "node_modules", first.startsWith("@") ? join(first, second) : first);
};
const maps = [];
const findMaps = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!(dir === app && SITE_ONLY.has(name))) findMaps(full);
    } else if (name.endsWith(".js.map")) maps.push(full);
  }
};
findMaps(app);
const scripts = readdirSync(assets).filter((name) => name.endsWith(".js"));
// A script with no map beside it would be code nobody listed: the notices would then be a guess.
for (const name of scripts) if (!existsSync(join(app, "assets", `${name}.map`))) fail(`the app's ${name} has no source map, so the packages inside it cannot be listed: build the app with source maps`);
const appModules = maps.flatMap((file) => {
  const map = JSON.parse(readFileSync(file, "utf8"));
  return map.sources.map((source) => resolve(dirname(file), map.sourceRoot ?? "", source));
});
const noticed = (modules, where) => {
  const dirs = [...new Set(modules.map(packageDirOf).filter((dir) => dir !== undefined))];
  return dirs
    .map((dir) => {
      if (!existsSync(join(dir, "package.json"))) fail(`${where} holds code from ${dir}, which has no package.json to say what it is`);
      const { name, version, license, homepage, repository } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const file = readdirSync(dir).find((entry) => /^licen[sc]e(\.(md|txt))?$/i.test(entry));
      if (typeof name !== "string" || typeof version !== "string" || typeof license !== "string" || file === undefined) fail(`${where} holds code from ${dir}, and its name, version, license or license file could not be read`);
      const url = typeof homepage === "string" ? homepage : typeof repository === "string" ? repository : repository?.url;
      return { name, version, license, url, text: readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n").trim() };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : 1));
};
const inApp = noticed(appModules, "the app");
const inCommand = noticed(commandModules, "the command");
// A check that the reading is whole: every package the app itself depends on, other than grooph's own, is in it.
const appManifest = JSON.parse(readFileSync(join(repo, "apps", "web", "package.json"), "utf8"));
for (const [dependency, range] of Object.entries(appManifest.dependencies ?? {})) {
  if (!String(range).startsWith("workspace:") && !inApp.some((entry) => entry.name === dependency)) fail(`the app depends on ${dependency}, and no module of it was found in the app's source maps: the notices would be incomplete`);
}
// A fence longer than any run of backticks in the text, so a license's own text cannot end it.
const fenced = (text) => {
  const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((run) => run[0].length + 1)));
  return `${fence}text\n${text}\n${fence}`;
};
const section = (entries) => entries.flatMap((entry) => [`### ${entry.name} ${entry.version}`, "", `License: ${entry.license}${entry.url ? ` · ${entry.url.replace(/^git\+/, "").replace(/\.git$/, "")}` : ""}`, "", fenced(entry.text), ""]);
// An optional dependency is installed by npm from its own package and is not in this one. Its license is said from
// its own package.json where it is installed here, and left to that package where it is not.
const optional = Object.entries(manifest.optionalDependencies ?? {}).map(([name, range]) => {
  const own = join(pkg, "node_modules", name, "package.json");
  const license = existsSync(own) ? JSON.parse(readFileSync(own, "utf8")).license : undefined;
  return [name, range, typeof license === "string" ? license : undefined];
});
writeFileSync(
  join(out, NOTICES),
  [
    "# Third-party notices",
    "",
    `grooph ${manifest.version} is under the MIT license (\`LICENSE\`). Two of its files are built files that hold other people's code, and this page carries those people's notices, as their licenses ask. It is written by the build from what the builds themselves say went into each file, not from a list kept by hand.`,
    "",
    `## In the app (\`dist/app/\`), which \`grooph watch\` serves`,
    "",
    `${inApp.length} packages, each with the license text its own package carries:`,
    "",
    ...section(inApp),
    "The app's fonts, Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, are under the SIL Open Font License 1.1. Their license texts are beside them, in `dist/app/assets/fonts/`.",
    "",
    "## In the command (`dist/bundle/grooph.js`)",
    "",
    ...(inCommand.length === 0 ? ["grooph's own code and no other package's."] : [`${inCommand.length} packages:`, "", ...section(inCommand)]),
    "",
    ...(optional.length > 0
      ? ["## Installed beside it, and not in this package", "", ...optional.map(([name, range, license]) => `- \`${name}\` (${range}), an optional dependency npm installs from its own package, under that package's own license${license ? ` (${license})` : ""}. grooph copies none of its code.`), ""]
      : []),
  ].join("\n"),
);

writeFileSync(
  join(out, "package.json"),
  `${JSON.stringify(
    {
      name: "grooph",
      version: manifest.version,
      description: "Author, check and compile multi-agent loop graphs for a coding harness: templates, a validator with stable rule codes, a compiler to a prompt package, and an MCP server. It never runs agents.",
      license: manifest.license,
      author: "Ryan Joseph Kamp",
      type: "module",
      bin: { grooph: "dist/bundle/grooph.js" },
      files: ["dist", "hooks", NOTICES],
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
console.log(`  plans        ${kb(part("dist/plans/"))}`);
console.log(`  the app      ${kb(part("dist/app/"))}`);
console.log(`  hooks        ${kb(part("hooks/"))}`);
console.log(`next: (cd ${relative(repo, out)} && npm pack --dry-run) lists what would be published; scripts/pack-check.sh installs the tarball in a fresh folder and runs it`);
