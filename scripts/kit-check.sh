#!/usr/bin/env bash
# The two files a person adds to a chat app (docs/chat.md), built and then used the way the app would use them:
# grooph-chat.zip is unzipped into an empty folder and its one script makes, checks, shares and draws a graph with
# nothing installed beside it; grooph.mcpb is unzipped, its manifest is read, and the server it names is started
# from the file system's root exactly as the manifest says, and asked for its tools and a graph.
# Needs `pnpm -r build`. Run from anywhere; CI runs it after the build. `--keep <dir>` also copies both files there.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
KEEP=""
# --keep is resolved now, from where the script was called: every later step runs somewhere else.
if [[ "${1:-}" == "--keep" ]]; then mkdir -p "${2:?--keep needs a folder}" && KEEP="$(cd "$2" && pwd -P)"; fi
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/grooph-kit-check.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

node "$REPO/packages/cli/scripts/chat-kit.mjs"
KIT="$REPO/packages/cli/dist/kit"
VERSION="$(node -p "require('$REPO/packages/cli/package.json').version")"
export HOME="$SCRATCH/home" && mkdir -p "$HOME"
export GROOPH_REGISTRY=http://127.0.0.1:9/unreachable/index.json

# ─── the skill ────────────────────────────────────────────────────────────
mkdir -p "$SCRATCH/skills" "$SCRATCH/work"
(cd "$SCRATCH/skills" && unzip -q "$KIT/grooph-chat.zip")
[[ "$(ls "$SCRATCH/skills")" == "grooph-chat" ]] || fail "the zip must hold one folder, named as the skill is"
SKILL="$SCRATCH/skills/grooph-chat"
[[ "$(sed -n 's/^name: //p' "$SKILL/SKILL.md")" == "grooph-chat" ]] || fail "the skill's name is not its folder's"
for f in SKILL.md scripts/grooph.mjs patterns/index.json plans/solo-project.grooph.json reference/agents.md; do [[ -s "$SKILL/$f" ]] || fail "the skill has no $f"; done
find "$SKILL" -name node_modules | grep . >/dev/null && fail "the skill carries node_modules"

cd "$SCRATCH/work"
G() { node "$SKILL/scripts/grooph.mjs" "$@"; }
[[ "$(G --version)" == "$VERSION" ]] || fail "the skill's script did not print $VERSION"
G template list | grep >/dev/null "^  grind-loop " || fail "the skill's script did not find its templates"
G template list | grep >/dev/null "^20 templates, and 4 plans apart from them\. " || fail "the skill's script did not find its four plan templates"
G template use solo-project --name "A zine" --set project="A zine about tide pools." --set where="its own web address" --out zine.grooph.json >/dev/null
G plan zine.grooph.json >/dev/null && [[ -s a-zine-plan/PLAN.md ]] || fail "the skill's script wrote no plan from a plan template"
G template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass" --set test-command="pnpm test checkout" --out flaky.grooph.json
G validate --for-export flaky.grooph.json
G explain flaky.grooph.json | grep >/dev/null "at most 5 rounds" || fail "explain did not say what the graph's brakes are"
G share flaky.grooph.json | grep >/dev/null '^https://ryanjosephkamp.github.io/grooph/#/open?d=' || fail "share printed no link"
G image flaky.grooph.json --out flaky.svg
head -c 5 flaky.svg | grep >/dev/null "<svg" || fail "image wrote no SVG"
# Every command the skill's instructions rely on is named in them and is one the script has.
for command in template new apply validate explain share image plan export; do
  grep >/dev/null -E "(^|[ \`])$command " "$SKILL/SKILL.md" || fail "the skill's instructions no longer name the command $command"
  G help "$command" >/dev/null || fail "the skill names the command $command, which the script does not have"
done

# ─── the desktop extension ────────────────────────────────────────────────
EXT="$SCRATCH/ext" && mkdir -p "$EXT" && (cd "$EXT" && unzip -q "$KIT/grooph.mcpb")
node - "$EXT" "$VERSION" <<'JS' || fail "the extension's manifest or its server is not as it should be"
const { existsSync, readFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const [ext, version] = process.argv.slice(2);
const m = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
const need = (ok, what) => { if (!ok) throw new Error(what); };
// The bundle format's version 0.3 (github.com/modelcontextprotocol/mcpb, MANIFEST.md): the required fields, and no key it does not have.
need(m.manifest_version === "0.3", "manifest_version is not 0.3");
for (const key of ["name", "version", "description", "author", "server"]) need(m[key] !== undefined, `the manifest has no ${key}`);
need(typeof m.author.name === "string" && m.version === version, "author.name or version is wrong");
const known = new Set(["$schema", "manifest_version", "name", "display_name", "version", "description", "long_description", "author", "repository", "homepage", "documentation", "support", "icon", "icons", "screenshots", "localization", "server", "tools", "tools_generated", "prompts", "prompts_generated", "keywords", "license", "privacy_policies", "compatibility", "user_config", "_meta"]);
for (const key of Object.keys(m)) need(known.has(key), `the manifest has a key the format does not: ${key}`);
need(m.server.type === "node" && existsSync(join(ext, m.server.entry_point)), "server.entry_point is not in the bundle");
need(existsSync(join(ext, m.icon)), "the icon is not in the bundle");
// Start it as the app would: the manifest's command and arguments, ${__dirname} filled in, from the file system's root.
const args = m.server.mcp_config.args.map((a) => a.replace("${__dirname}", ext));
const send = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "kit-check", version: "0" } } },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "grooph_use_template", arguments: { id: "grind-loop", name: "From the extension", values: { task: "t", "test-command": "c" } } } },
  { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "grooph_share", arguments: { graph: "from-the-extension" } } },
  { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "grooph_new", arguments: { name: "Never written", out: "never-written.grooph.json" } } },
  { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "grooph_templates", arguments: {} } },
];
const run = spawnSync(m.server.mcp_config.command, args, { cwd: "/", input: send.map((s) => JSON.stringify(s)).join("\n") + "\n", encoding: "utf8" });
need(run.status === 0 && run.stderr === "", `the server exited ${run.status}: ${run.stderr}`);
const [init, list, use, share, written, library] = run.stdout.trim().split("\n").map((l) => JSON.parse(l));
need(init.result.serverInfo.version === version, "the server reports another version");
const names = list.result.tools.map((t) => t.name);
need(JSON.stringify(names) === JSON.stringify(m.tools.map((t) => t.name)), "the manifest's tools are not the server's");
need(names.length === 11 && !names.includes("grooph_plan"), "the extension offers tools a chat should not have");
need(use.result.structuredContent.graph.id === "from-the-extension", "grooph_use_template returned no graph");
need(/^https:\/\/ryanjosephkamp\.github\.io\/grooph\/#\/open\?d=/.test(share.result.structuredContent.link), "grooph_share, given the graph's id, returned no link");
need(written.result.isError === true && /writes no file/.test(written.result.content[0].text), "the extension's server was willing to write a file");
const plans = library.result.structuredContent.plans.map((t) => t.id).sort();
need(JSON.stringify(plans) === JSON.stringify(["literature-review", "research-study", "solo-project", "team-handoffs"]), `the extension's server lists these plans: ${plans.join(", ")}`);
need(library.result.structuredContent.templates.length === 20, "the extension's server no longer lists twenty templates apart from the plans");
JS

if [[ -n "$KEEP" ]]; then mkdir -p "$KEEP" && cp "$KIT/grooph-chat.zip" "$KIT/grooph.mcpb" "$KEEP/"; fi
echo "kit check: ok (grooph-chat.zip $(( $(wc -c < "$KIT/grooph-chat.zip") / 1024 )) KB, grooph.mcpb $(( $(wc -c < "$KIT/grooph.mcpb") / 1024 )) KB; the skill's script and the extension's server run with nothing installed beside them)"
