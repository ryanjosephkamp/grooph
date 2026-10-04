#!/usr/bin/env node
/**
 * Build the two files a person adds to a chat app (docs/chat.md), in dist/kit/:
 *
 *   grooph-chat.zip   the skill for claude.ai: plugins/grooph-chat/SKILL.md, the CLI as one
 *                     script (scripts/grooph.mjs), the templates beside it (patterns/), and the
 *                     page for agents as its reference
 *   grooph.mcpb       the desktop extension for Claude's desktop app: the same script as a local
 *                     MCP server started with `mcp --chat`, and the templates
 *
 * Neither is committed and neither is published by this script: they are built from the
 * sources each time, so they cannot fall behind the CLI. Publishing them is the owner's.
 *
 *   node packages/cli/scripts/chat-kit.mjs          # after pnpm -r build
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { bundleCli, pkg, repo } from "./bundle.mjs";
import { zip } from "./zip.mjs";

const out = join(pkg, "dist", "kit");
const skillDir = join(repo, "plugins", "grooph-chat");
const fail = (message) => {
  console.error(`chat-kit: ${message}`);
  process.exit(1);
};

if (!existsSync(join(pkg, "dist", "patterns", "index.json"))) fail("the CLI is not built: run pnpm -r build first");
const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const script = readFileSync(await bundleCli(join(out, "grooph.mjs")));
rmSync(join(out, "grooph.mjs"));
const patterns = readdirSync(join(pkg, "dist", "patterns"))
  .filter((name) => name.endsWith(".grooph.json") || name === "index.json")
  .sort()
  .map((name) => ({ name: `patterns/${name}`, data: readFileSync(join(pkg, "dist", "patterns", name)) }));
const license = { name: "LICENSE.txt", data: readFileSync(join(repo, "LICENSE")) };

// ─── the skill ────────────────────────────────────────────────────────────

const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? fail("plugins/grooph-chat/SKILL.md has no frontmatter");
const field = (key) => new RegExp(`^${key}: (.+)$`, "m").exec(front)?.[1]?.trim();
const name = field("name") ?? fail("SKILL.md has no name");
const description = field("description") ?? fail("SKILL.md has no description");
// Anthropic's two pages disagree on the description's limit (1,024 characters and 200): the smaller one is kept.
if (!/^[a-z0-9-]{1,64}$/.test(name) || /anthropic|claude/.test(name)) fail(`the skill's name must be lowercase letters, digits and hyphens, at most 64, and not a reserved word: ${name}`);
if (description.length > 200) fail(`the skill's description is ${description.length} characters; keep it within 200`);

const inFolder = (entries) => entries.map((entry) => ({ ...entry, name: `${name}/${entry.name}` }));
const skillZip = zip(
  inFolder([
    { name: "SKILL.md", data: Buffer.from(skill) },
    { name: "scripts/grooph.mjs", data: script, mode: 0o755 },
    ...patterns,
    { name: "reference/agents.md", data: readFileSync(join(repo, "docs", "agents.md")) },
    license,
  ]),
);
writeFileSync(join(out, `${name}.zip`), skillZip);

// ─── the desktop extension ────────────────────────────────────────────────

// The tools as the server itself lists them in a chat, so the manifest cannot name one it does not have.
const { handle } = await import(join(pkg, "dist", "src", "mcp.js"));
const ctx = { project: out, writes: false, chat: true, version: manifest.version, harness: "chat", session: "kit", now: () => new Date(0) };
const listed = (await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)).result.tools;
const desktop = {
  manifest_version: "0.3",
  name: "grooph",
  display_name: "grooph",
  version: manifest.version,
  description: "Make, check, draw and share loop graphs for coding agents, from a chat. It never runs agents and writes no file.",
  long_description:
    "grooph is an authoring and checking surface for multi-agent loop graphs: one small document that says who does what, where the loops are and what stops them. This extension runs grooph's MCP server on your computer with its authoring tools only: Claude picks a template, fills it, changes it, checks it against grooph's rules, draws it and hands you a link that opens it in the grooph app on any device. Nothing is uploaded: the link carries the graph after its #, which a browser sends to no server. No model is called, no file is written, and nothing is started.",
  author: { name: "ryanjosephkamp", url: "https://github.com/ryanjosephkamp" },
  homepage: "https://ryanjosephkamp.github.io/grooph/",
  documentation: "https://ryanjosephkamp.github.io/grooph/docs/chat/",
  repository: { type: "git", url: "https://github.com/ryanjosephkamp/grooph" },
  license: manifest.license,
  icon: "icon.png",
  keywords: ["multi-agent", "loop-graph", "workflow", "agents", "grooph"],
  server: {
    type: "node",
    entry_point: "server/grooph.mjs",
    mcp_config: { command: "node", args: ["${__dirname}/server/grooph.mjs", "mcp", "--chat"] },
  },
  tools: listed.map((tool) => ({ name: tool.name, description: tool.title })),
  compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: ">=18.17.0" } },
};
const bundle = zip([
  { name: "manifest.json", data: Buffer.from(`${JSON.stringify(desktop, null, 2)}\n`) },
  { name: "server/grooph.mjs", data: script, mode: 0o755 },
  ...patterns,
  { name: "icon.png", data: readFileSync(join(repo, "apps", "web", "public", "icon-512.png")) },
  license,
]);
writeFileSync(join(out, "grooph.mcpb"), bundle);

const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString("en")} KB`;
console.log(`chat kit for grooph ${manifest.version}, in ${relative(repo, out)}:`);
console.log(`  ${name}.zip   ${kb(skillZip.length)}   the skill to upload in claude.ai (Customize > Skills)`);
console.log(`  grooph.mcpb       ${kb(bundle.length)}   the extension for Claude's desktop app (double-click it); ${listed.length} tools`);
console.log("next: docs/chat.md says how each is added and what to ask");
