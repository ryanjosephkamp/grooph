#!/usr/bin/env bash
# What goes to npm as `grooph`, checked the way a stranger meets it: the package is assembled
# (packages/cli/scripts/npm-package.mjs), packed with `npm pack`, installed from the tarball into a
# fresh temporary folder that is not a clone, and run there. Fails if any step fails.
# Needs `pnpm -r build`, and the network for the one optional dependency (the PNG renderer).
# Run from anywhere; CI runs it after the build. `--keep <dir>` also copies the tarball there.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
KEEP=""
[[ "${1:-}" == "--keep" ]] && KEEP="${2:?--keep needs a folder}"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/grooph-pack-check.XXXXXX")"
WATCH_PID=""
cleanup() { [[ -n "$WATCH_PID" ]] && kill "$WATCH_PID" 2>/dev/null || true; rm -rf "$SCRATCH"; }
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

node "$REPO/packages/cli/scripts/npm-package.mjs"
STAGED="$REPO/packages/cli/dist/npm"
VERSION="$(node -p "require('$STAGED/package.json').version")"

# What would be published: the name, no dependency a registry could not resolve, and nothing but the package's own files.
node -e '
  const m = require(process.argv[1] + "/package.json");
  if (m.name !== "grooph") throw new Error("the package is named " + m.name);
  if (m.private) throw new Error("the package is marked private");
  if (m.dependencies) throw new Error("the package has dependencies: " + Object.keys(m.dependencies));
  if (JSON.stringify(m).includes("workspace:")) throw new Error("the package names a workspace dependency");
' "$STAGED" || fail "the staged package.json is not publishable"

(cd "$STAGED" && npm pack --silent --pack-destination "$SCRATCH" >/dev/null)
TARBALL="$SCRATCH/grooph-$VERSION.tgz"
[[ -s "$TARBALL" ]] || fail "npm pack made no tarball"
SIZE_KB=$(( $(wc -c < "$TARBALL") / 1024 ))
FILES=$(tar -tzf "$TARBALL" | wc -l | tr -d ' ')
tar -tzf "$TARBALL" | grep >/dev/null '\.map$' && fail "the tarball carries source maps"
tar -tzf "$TARBALL" | grep -E >/dev/null '^package/(dist/src|dist/test|src|test|node_modules)/' && fail "the tarball carries files that are not the package's"
(( SIZE_KB < 1024 )) || fail "the tarball is ${SIZE_KB} KB; it was about 640 KB when this check was written, so something large got in"

# A machine with no clone: a fresh folder, a home of its own, and the tarball.
export HOME="$SCRATCH/home" && mkdir -p "$HOME"
PROJECT="$SCRATCH/project" && mkdir -p "$PROJECT" && cd "$PROJECT"
npm init -y >/dev/null
npm install --no-audit --no-fund --loglevel=error "$TARBALL"

[[ "$(npx grooph --version)" == "$VERSION" ]] || fail "npx grooph --version did not print $VERSION"

# The built-in templates answer with the network's registry out of reach.
export GROOPH_REGISTRY=http://127.0.0.1:9/unreachable/index.json
npx grooph template list | grep >/dev/null "^  grind-loop " || fail "the built-in templates are not in the package"

# The quickstart's path.
npx grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
npx grooph validate --for-export flaky.grooph.json
npx grooph share flaky.grooph.json | grep >/dev/null '^https://ryanjosephkamp.github.io/grooph/#/open?d=' || fail "share printed no link"
npx grooph image flaky.grooph.json --out flaky.svg
npx grooph image flaky.grooph.json --out flaky.png
[[ "$(head -c 4 flaky.png | xxd -p)" == "89504e47" ]] || fail "image wrote no PNG (the optional renderer did not install or did not load)"
npx grooph export flaky.grooph.json --target claude-code --into . >/dev/null
[[ -f .grooph/fix-the-flaky-test/LEAD.md ]] || fail "export wrote no package"

# The event hook is installed from the package's own copy.
npx grooph hooks install --dir . >/dev/null
[[ -f .grooph/hooks/grooph-event.mjs ]] || fail "hooks install did not place the hook"

# The MCP server: the handshake, every tool listed, a graph made with a tool call; and in a chat, the authoring tools only.
mcp() { printf '%s\n' "${@:2}" | npx grooph mcp $1; }
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"pack-check","version":"0"}}}'
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
USE='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"grooph_use_template","arguments":{"id":"grind-loop","name":"From a tool","values":{"task":"t","test-command":"c"}}}}'
mcp "--dir ." "$INIT" "$LIST" "$USE" > mcp.out
node -e '
  const [init, list, use] = require("fs").readFileSync("mcp.out", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  if (init.result.serverInfo.version !== process.argv[1]) throw new Error("the server reports version " + init.result.serverInfo.version);
  if (list.result.tools.length !== 13) throw new Error("the server lists " + list.result.tools.length + " tools, not 13");
  if (use.result.isError || use.result.structuredContent.graph.id !== "from-a-tool") throw new Error("grooph_use_template did not return the graph");
' "$VERSION" || fail "the MCP server in the package did not answer as it should"
mcp "--chat" "$INIT" "$LIST" > chat.out
node -e '
  const [, list] = require("fs").readFileSync("chat.out", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const names = list.result.tools.map((t) => t.name);
  if (names.length !== 10 || names.includes("grooph_plan")) throw new Error("in a chat the server lists " + names.join(", "));
' || fail "grooph mcp --chat did not list the authoring tools only"

# The app that watch serves is in the package: start it on a free port, ask for its first page, stop it.
npx grooph watch --sessions --port 0 > watch.out 2>&1 &
WATCH_PID=$!
URL=""
for _ in $(seq 1 50); do
  URL="$(grep -Eo 'http://127\.0\.0\.1:[0-9]+/grooph/' watch.out | head -1 || true)"
  [[ -n "$URL" ]] && break
  sleep 0.1
done
[[ -n "$URL" ]] || { cat watch.out >&2; fail "watch did not start (is the app in the package?)"; }
curl -fsS "$URL" | grep -i >/dev/null "<title>" || fail "watch did not serve the app"
kill "$WATCH_PID" 2>/dev/null || true
WATCH_PID=""

if [[ -n "$KEEP" ]]; then mkdir -p "$KEEP" && cp "$TARBALL" "$KEEP/"; fi
echo "pack check: ok (grooph-$VERSION.tgz, ${SIZE_KB} KB, ${FILES} files; installed and run in a fresh folder)"
