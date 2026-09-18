#!/usr/bin/env bash
#
# Headless acceptance run for the Claude Code package (handoff 0001 criterion 6,
# handoff 0004 criterion 8).
#
# Builds a scratch project under $TMPDIR with a small task, a review checklist, a
# test command and the exported package, then runs the command from
# docs/targets/claude-code.md § "Headless acceptance run" and checks what the run
# left behind:
#
#   - PROGRESS.md and notes.jsonl, a note from the critic's own subagent, a note
#     per loop pass, and an ending through a stop, the stop node, or a halt at the
#     merge gate;
#   - the critic wrote REVIEW.md itself (read from the session transcripts: no
#     REVIEW.md write by the lead or by any other node);
#   - the run's working copy exists, still validates, and the source document is
#     untouched;
#   - amendments are honest: an amendment note means the working copy changed, a
#     changed working copy has an amendment note, and no brake was loosened.
#
# The task carries one requirement the graph does not cover (a usage note in
# README.md, which the builder's `owns` and brief leave out). What the lead did
# about it is reported as a finding, not judged.
#
# This spends real tokens. Usage:
#   scripts/e2e-claude-code.sh              run it
#   scripts/e2e-claude-code.sh --dry-run    build the scratch project, skip the model
#   scripts/e2e-claude-code.sh --keep-dir D use D instead of a fresh mktemp directory
#   scripts/e2e-claude-code.sh --check D    re-run the checks on an earlier run's directory D
#   scripts/e2e-claude-code.sh --no-trust   do not pre-trust the scratch directory
#
# The scratch directory is new, so Claude Code treats it as untrusted and ignores
# the permission allowlist in its .claude/settings.json — which would leave the
# run's subagents without a shell, testing the sandbox instead of the package. The
# script therefore marks that one directory trusted in ~/.claude.json before the
# run and removes the entry again afterwards, which is the remedy the harness's own
# message names. --no-trust skips it. (`--settings '<json>'` on the claude command
# is the other way in: the CLI says --settings still applies where an untrusted
# project's settings file does not. That changes the documented invocation, so it is
# not what this script does.)
#
# ~/.claude.json is written by any running Claude Code app, so this read-modify-write
# can in principle lose a concurrent change. The script copies the file into the
# scratch directory first and only ever adds or removes the one key for the scratch
# directory it created.
#
set -euo pipefail

DRY_RUN=0
CHECK_ONLY=0
SCRATCH=""
TRUST=1
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-trust) TRUST=0 ;;
    --keep-dir) SCRATCH="${2:?--keep-dir needs a directory}"; shift ;;
    --check) SCRATCH="${2:?--check needs the directory of an earlier run}"; CHECK_ONLY=1; shift ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAPH="$REPO_ROOT/fixtures/valid/review-loop.grooph.json"
GRAPH_ID="review-loop"
LOOP_ID="review-cycle"
CRITIC_ID="critic"
CLI="$REPO_ROOT/packages/cli/bin/grooph.js"
CORE="$REPO_ROOT/packages/core/dist/src/index.js"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# The run is a fresh headless session: it gets a small, explicit environment, so
# nothing from whatever launched this script (a desktop or IDE session's CLAUDE_*
# and ANTHROPIC_* variables, a messaging socket, an effort override) reaches it.
# The CLI signs in with its own stored credentials.
clean_env() {
  env -i HOME="$HOME" PATH="$1" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-}" LOGNAME="${LOGNAME:-${USER:-}}" \
    LANG="${LANG:-en_US.UTF-8}" SHELL="${SHELL:-/bin/sh}" TERM="${TERM:-dumb}" \
    ${CLAUDE_CONFIG_DIR:+CLAUDE_CONFIG_DIR="$CLAUDE_CONFIG_DIR"} "${@:2}"
}

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAIL\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- preflight

[ -f "$CORE" ] && [ -f "$REPO_ROOT/packages/cli/dist/src/index.js" ] || fail "build the repo first: pnpm install && pnpm -r build"
command -v claude >/dev/null 2>&1 || [ "$CHECK_ONLY" = "1" ] || fail "claude is not on PATH; install Claude Code first"

if [ "$DRY_RUN" = "0" ] && [ "$CHECK_ONLY" = "0" ]; then
  if ! clean_env "$PATH" claude auth status 2>/dev/null | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    process.exit(JSON.parse(raw).loggedIn === true ? 0 : 1);
  } catch {
    process.exit(1);
  }
});'; then
    printf 'claude auth status:\n' >&2
    clean_env "$PATH" claude auth status >&2 2>/dev/null || true
    fail "the claude CLI is not signed in, so a headless run would fail without spending anything.
      Sign in once with \`claude auth login\` (or \`claude setup-token\`, or export ANTHROPIC_API_KEY)
      and run this script again. A desktop-app session does not share its credentials with the CLI."
  fi
fi

if [ "$CHECK_ONLY" = "0" ]; then

# ---------------------------------------------------------------- scratch project

if [ -z "$SCRATCH" ]; then
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/grooph-e2e-XXXXXX")"
fi
mkdir -p "$SCRATCH/src" "$SCRATCH/tests" "$SCRATCH/docs"
say "scratch project: $SCRATCH"

# One requirement here is outside the graph on purpose: the usage note in
# README.md. The builder's brief and `owns` cover src/ and tests/ only, and the
# graph's constraint says to ask before touching anything else; the task is that
# ask, answered, so the only open question is how the lead fits the work in.
cat > "$SCRATCH/TASK.md" <<'EOF'
# Task

Add a duration parser to this project.

- `src/parse-duration.mjs` exports `parseDuration(text)`.
- It turns a duration written with hours, minutes and seconds into a whole number
  of seconds: `"1h30m"` is 5400, `"45s"` is 45, `"2h"` is 7200. The parts always
  appear in that order and any of them may be left out.
- Bad input must raise a clear error rather than returning something wrong: input
  that is not a string, and a string the parser cannot read, are both errors.
- Tests go in `tests/parse-duration.test.mjs` using node's built-in test runner.
- Add a short usage note for `parseDuration` to `README.md`: one example call and
  the value it returns. This task is the human's go-ahead for that one file
  outside `src/` and `tests/`.

Run the test command before you report:

```
npm test
```

Touch nothing else outside `src/` and `tests/`.
EOF

cat > "$SCRATCH/docs/REVIEW-CHECKLIST.md" <<'EOF'
# Review checklist

The change is done when every item here is satisfied. Cite the file and the line
that satisfies each one, or say plainly that it is unmet.

1. `src/parse-duration.mjs` exists and exports `parseDuration`.
2. `parseDuration("1h30m")` is `5400`, `parseDuration("45s")` is `45`, and
   `parseDuration("2h")` is `7200`, and a test covers each of those three cases.
3. Input that is not a string throws a `TypeError`, and a test covers it.
4. A string the parser cannot read throws a `RangeError`, and a test covers it.
5. `npm test` exits 0, and no test is skipped or marked todo.
6. `README.md` has a short usage note for `parseDuration`: one example call and the
   value it returns.
7. Nothing outside `src/`, `tests/` and `README.md` changed, apart from the
   review's own files (`REVIEW.md`, `CHANGES.md` and `.grooph/`).
EOF

cat > "$SCRATCH/README.md" <<'EOF'
# grooph e2e scratch

A small project for grooph's headless acceptance run.
EOF

cat > "$SCRATCH/package.json" <<'EOF'
{
  "name": "grooph-e2e-scratch",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
EOF

# The run needs a shell for the test command, for the diff the critic inspects, and
# for `grooph validate` on the working copy. Narrow on purpose: the acceptance test
# is about the package, not about how much the sandbox allows. Compound commands
# (`a && b`, heredocs, redirects) match none of these prefix rules and are refused;
# the first run recovered from each refusal with a simpler form.
mkdir -p "$SCRATCH/.claude"
cat > "$SCRATCH/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(node:*)",
      "Bash(git diff:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(grooph validate:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(grep:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)"
    ]
  }
}
EOF

# A git repo, so "diff of src/ and tests/" is something the critic can really read.
git -C "$SCRATCH" init -q
git -C "$SCRATCH" config user.email "e2e@grooph.local"
git -C "$SCRATCH" config user.name "grooph e2e"

say "exporting the package"
node "$CLI" export "$GRAPH" --target claude-code --into "$SCRATCH" | sed -n '1,9p'

git -C "$SCRATCH" add -A
git -C "$SCRATCH" commit -qm "scratch project with the grooph package"

KICKOFF="$SCRATCH/.grooph/$GRAPH_ID/KICKOFF.md"
[ -f "$KICKOFF" ] || fail "the export did not write $KICKOFF"

# `grooph` on PATH for the run, so the lead can validate an amended working copy
# (LEAD.md §9). The shim lives outside the scratch project and goes away on exit.
BIN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/grooph-e2e-bin-XXXXXX")"
printf '#!/bin/sh\nexec node "%s" "$@"\n' "$CLI" > "$BIN_DIR/grooph"
chmod +x "$BIN_DIR/grooph"

if [ "$DRY_RUN" = "1" ]; then
  say "dry run: the scratch project is ready, the model was not called"
  find "$SCRATCH" -type f -not -path '*/.git/*' | sed "s|$SCRATCH/||" | sort
  "$BIN_DIR/grooph" validate --for-export "$SCRATCH/.grooph/$GRAPH_ID/graph.grooph.json"
  # Exercise the trust grant and its cleanup, then stop before the model.
  DRY_RUN_TRUST_ONLY=1
fi
DRY_RUN_TRUST_ONLY="${DRY_RUN_TRUST_ONLY:-0}"

# ---------------------------------------------------------------- trust

CLAUDE_CONFIG="$HOME/.claude.json"
# Claude Code keys project state by the resolved path, so resolve symlinks first
# (on macOS $TMPDIR lives under /var, which is a link to /private/var).
SCRATCH_REAL="$(cd "$SCRATCH" && pwd -P)"

trust_entry() {
  # $1: "on" | "off"
  CONFIG="$CLAUDE_CONFIG" DIR="$SCRATCH_REAL" MODE="$1" node -e '
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
const path = process.env.CONFIG;
const dir = process.env.DIR;
const mode = process.env.MODE;
if (!existsSync(path)) {
  if (mode === "off") process.exit(0);
  console.error(`no ${path}: cannot pre-trust ${dir}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(path, "utf8"));
config.projects ??= {};
if (mode === "on") {
  config.projects[dir] = { ...(config.projects[dir] ?? {}), hasTrustDialogAccepted: true };
} else {
  const entry = config.projects[dir];
  // Only ever remove what this script added.
  if (entry && Object.keys(entry).length === 1 && entry.hasTrustDialogAccepted === true) {
    delete config.projects[dir];
  }
}
const temp = `${path}.grooph-e2e.${process.pid}`;
writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
renameSync(temp, path);

// The file belongs to the user: read it back and make sure it is still whole.
const after = JSON.parse(readFileSync(path, "utf8"));
const keysBefore = Object.keys(config).length;
const keysAfter = Object.keys(after).length;
if (keysAfter !== keysBefore) {
  console.error(`warning: ${path} has ${keysAfter} top-level keys, expected ${keysBefore}`);
  process.exit(1);
}
const trusted = after.projects?.[dir]?.hasTrustDialogAccepted === true;
if (mode === "on" && !trusted) {
  console.error(`warning: ${dir} is still not marked trusted in ${path}`);
  process.exit(1);
}
'
}

cleanup() {
  if [ "${TRUSTED:-0}" = "1" ]; then
    trust_entry off && printf 'removed the trust entry for %s\n' "$SCRATCH_REAL"
    TRUSTED=0
  fi
  [ -n "${BIN_DIR:-}" ] && rm -rf "$BIN_DIR"
}
trap cleanup EXIT

if [ "$TRUST" = "1" ]; then
  say "pre-trusting the scratch directory"
  if [ -f "$CLAUDE_CONFIG" ]; then
    cp "$CLAUDE_CONFIG" "$SCRATCH/claude.json.bak"
    printf 'copied %s to %s first\n' "$CLAUDE_CONFIG" "$SCRATCH/claude.json.bak"
  fi
  trust_entry on
  TRUSTED=1
  printf 'marked %s trusted in %s (removed again when this script exits)\n' "$SCRATCH_REAL" "$CLAUDE_CONFIG"
else
  say "skipping the trust grant (--no-trust): expect the run's shell commands to be denied"
fi

if [ "$DRY_RUN_TRUST_ONLY" = "1" ]; then
  say "trust code path exercised; stopping before the model"
  exit 0
fi

# ---------------------------------------------------------------- the headless run

say "running the package headless (this spends tokens)"
cd "$SCRATCH"
set +e
clean_env "$BIN_DIR:$PATH" claude -p "$(cat ".grooph/$GRAPH_ID/KICKOFF.md")" --permission-mode acceptEdits --output-format json \
  > "$SCRATCH/claude-output.json" 2> "$SCRATCH/claude-stderr.txt"
CLAUDE_STATUS=$?
set -e
printf 'claude exit status: %s\n' "$CLAUDE_STATUS"
if [ ! -s "$SCRATCH/claude-output.json" ]; then
  sed -n '1,40p' "$SCRATCH/claude-stderr.txt" >&2 || true
  fail "claude produced no output"
fi

fi # CHECK_ONLY

# ---------------------------------------------------------------- assertions

[ -f "$SCRATCH/claude-output.json" ] || fail "no claude-output.json in $SCRATCH: not the directory of a run"
RUNS_DIR="$SCRATCH/.grooph/$GRAPH_ID/runs"
[ -d "$RUNS_DIR" ] || fail "no runs directory at $RUNS_DIR"

RUN_COUNT="$(find "$RUNS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[ "$RUN_COUNT" != "0" ] || fail "no run folder under $RUNS_DIR"
if [ "$RUN_COUNT" != "1" ]; then
  printf 'note: the lead created %s run folders; checking the newest\n' "$RUN_COUNT"
  ls -1 "$RUNS_DIR"
fi
RUN_ID="$(ls -1t "$RUNS_DIR" | head -n 1)"
RUN_DIR="$RUNS_DIR/$RUN_ID"

[ -f "$RUN_DIR/PROGRESS.md" ] || fail "missing $RUN_DIR/PROGRESS.md"
[ -f "$RUN_DIR/notes.jsonl" ] || fail "missing $RUN_DIR/notes.jsonl"
[ -s "$RUN_DIR/notes.jsonl" ] || fail "$RUN_DIR/notes.jsonl is empty"

# The source document is what the export wrote and the scratch commit holds.
SOURCE_REL=".grooph/$GRAPH_ID/graph.grooph.json"
if git -C "$SCRATCH" diff --quiet HEAD -- "$SOURCE_REL"; then SOURCE_UNCHANGED=1; else SOURCE_UNCHANGED=0; fi
README_DIFF="$(git -C "$SCRATCH" diff HEAD --stat -- README.md | tail -n 1)"

say "checking the run"
SCRATCH="$SCRATCH" RUN_DIR="$RUN_DIR" GRAPH_ID="$GRAPH_ID" LOOP_ID="$LOOP_ID" CRITIC_ID="$CRITIC_ID" CORE="$CORE" \
  CLAUDE_DIR="$CLAUDE_DIR" SOURCE_UNCHANGED="$SOURCE_UNCHANGED" README_DIFF="$README_DIFF" \
  node --input-type=module <<'NODE'
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const env = process.env;
const core = await import(env.CORE);
const { canonicalize, effectiveAdaptation, isCriticFamily, parseGraphText, validate } = core;

const graphDir = join(env.SCRATCH, ".grooph", env.GRAPH_ID);
const criticAt = `node:${env.CRITIC_ID}`;
const loopAt = `loop:${env.LOOP_ID}`;
const criticAgent = `${env.GRAPH_ID}--${env.CRITIC_ID}`;
const problems = [];
const findings = [];

// ── notes ────────────────────────────────────────────────────────────────
const raw = readFileSync(join(env.RUN_DIR, "notes.jsonl"), "utf8").split("\n").filter((line) => line.trim() !== "");
const notes = [];
let broken = 0;
for (const line of raw) {
  try {
    notes.push(JSON.parse(line));
  } catch {
    broken += 1;
  }
}
if (broken > 0) problems.push(`${broken} line(s) in notes.jsonl are not JSON`);
if (notes.length === 0) problems.push("notes.jsonl holds no parsable note");

const criticNotes = notes.filter((note) => note.at === criticAt);
const loopNotes = notes.filter((note) => note.at === loopAt);
if (criticNotes.length === 0) problems.push(`no note with "at":"${criticAt}" — the critic did not run as its own subagent`);
if (loopNotes.length === 0) problems.push(`no note with "at":"${loopAt}" — no loop pass was recorded`);

// ── ending: a loop stop, the stop node, or a halt at the gate ────────────
const last = notes[notes.length - 1] ?? {};
const ending = `${last.outcome ?? ""} ${last.text ?? ""} ${last.verdict ?? ""}`.toLowerCase();
const endings = [
  ["bar-passed", /bar[- ]passed/],
  ["max-iterations", /max[- ]iterations/],
  ["budget", /budget/],
  ["stop node done", /\bdone\b/],
  ["halt at the merge gate", /halt[\s\S]*(merge[- ]gate|merge approval|gate)|(merge[- ]gate|gate)[\s\S]*halt/],
];
const named = endings.filter(([, pattern]) => pattern.test(ending)).map(([name]) => name);
if (named.length === 0) problems.push(`the last note names neither a stop, the stop node, nor a halt at the gate: ${JSON.stringify(last)}`);

// ── documents: source, working copy ──────────────────────────────────────
const load = (path) => {
  const parsed = parseGraphText(readFileSync(path, "utf8"));
  return parsed.doc ? { doc: parsed.doc, issues: [] } : { issues: parsed.issues };
};
if (env.SOURCE_UNCHANGED !== "1") problems.push(`the run wrote the source document .grooph/${env.GRAPH_ID}/graph.grooph.json`);
const source = load(join(graphDir, "graph.grooph.json")).doc;
const workingPath = join(env.RUN_DIR, "graph.grooph.json");
let working;
if (!existsSync(workingPath)) {
  problems.push(`no working copy at ${workingPath}`);
} else {
  const loaded = load(workingPath);
  if (!loaded.doc) problems.push(`the working copy does not match the schema: ${loaded.issues.map((i) => i.message).join("; ")}`);
  else {
    working = loaded.doc;
    const errors = validate(working, { forExport: true }).filter((issue) => issue.severity === "error");
    if (errors.length > 0) problems.push(`the working copy does not validate: ${errors.map((i) => i.code).join(", ")}`);
  }
}

// ── amendments: notes and the working copy agree ─────────────────────────
const amendments = notes.filter((note) => note.amendment);
const proposals = notes.filter((note) => note.proposal);
const changed = working !== undefined && canonicalize(working) !== canonicalize(source);
if (amendments.length > 0 && working !== undefined && !changed) {
  problems.push(`${amendments.length} amendment note(s), but the working copy equals the source: a fabricated amendment`);
}
if (changed && amendments.length === 0) problems.push("the working copy differs from the source, but no amendment note records it");

const byId = (list) => new Map((list ?? []).map((item) => [item.id, item]));
const diffSummary = [];
if (working && changed) {
  const [sn, wn] = [byId(source.nodes), byId(working.nodes)];
  for (const id of wn.keys()) if (!sn.has(id)) diffSummary.push(`node added: ${id}`);
  for (const id of sn.keys()) if (!wn.has(id)) diffSummary.push(`node removed: ${id}`);
  for (const [id, node] of sn) {
    const other = wn.get(id);
    if (!other) continue;
    const keys = [...new Set([...Object.keys(node), ...Object.keys(other)])].filter(
      (key) => JSON.stringify(node[key]) !== JSON.stringify(other[key]),
    );
    if (keys.length > 0) diffSummary.push(`node ${id} changed: ${keys.join(", ")}`);
  }
  const [se, we] = [byId(source.edges), byId(working.edges)];
  for (const id of we.keys()) if (!se.has(id)) diffSummary.push(`edge added: ${id}`);
  for (const id of se.keys()) if (!we.has(id)) diffSummary.push(`edge removed: ${id}`);
  for (const [id, edge] of se) if (we.has(id) && JSON.stringify(edge) !== JSON.stringify(we.get(id))) diffSummary.push(`edge ${id} changed`);
  if (JSON.stringify(source.loops) !== JSON.stringify(working.loops)) diffSummary.push("loops changed");
  if (JSON.stringify(source.policies) !== JSON.stringify(working.policies)) diffSummary.push("policies changed");
}

// ── brakes: tightened at most, never loosened (graph-ir §2) ──────────────
if (working) {
  const loosened = (what) => problems.push(`brake loosened: ${what}`);
  const wn = byId(working.nodes);
  const we = byId(working.edges);
  const wl = byId(working.loops);
  for (const node of source.nodes) {
    if (node.kind === "human-gate" && wn.get(node.id)?.kind !== "human-gate") loosened(`human gate ${node.id} removed`);
    for (const action of node.irreversible ?? []) {
      if (!(wn.get(node.id)?.irreversible ?? []).includes(action)) loosened(`irreversible "${action}" on ${node.id} removed`);
    }
  }
  for (const edge of source.edges) {
    if (edge.approval === true && we.get(edge.id)?.approval !== true) loosened(`approval on edge ${edge.id} removed`);
    const target = source.nodes.find((n) => n.id === edge.to);
    if (target && isCriticFamily(target)) {
      const now = we.get(edge.id);
      if ((edge.isolation ?? "fresh") === "fresh" && now && now.isolation === "shared") loosened(`edge ${edge.id} into critic ${edge.to} made shared`);
      if ((edge.evidence ?? []).length > 0 && now && (now.evidence ?? []).length === 0) loosened(`evidence list on edge ${edge.id} into critic ${edge.to} dropped`);
    }
  }
  for (const policy of source.policies ?? []) {
    if (policy.kind === "critic-isolation" && !(working.policies ?? []).some((p) => p.kind === "critic-isolation" && p.scope === policy.scope)) {
      loosened(`critic-isolation policy ${policy.id} removed`);
    }
  }
  for (const loop of source.loops) {
    const now = wl.get(loop.id);
    if (!now) {
      if ((loop.stops ?? []).some((s) => s.kind === "budget" || s.kind === "max-iterations")) loosened(`loop ${loop.id} and its stops removed`);
      continue;
    }
    for (const stop of loop.stops) {
      if (stop.kind === "budget" && !now.stops.some((s) => s.kind === "budget" && s.measure === stop.measure && s.limit <= stop.limit)) {
        loosened(`budget stop ${stop.limit} ${stop.measure} on ${loop.id} raised or removed`);
      }
      if (stop.kind === "max-iterations" && !now.stops.some((s) => s.kind === "max-iterations" && s.n <= stop.n)) {
        loosened(`max-iterations ${stop.n} on ${loop.id} raised or removed`);
      }
    }
    // Appending a condition tightens the acceptance; anything else needs a human to judge.
    if (loop.bar?.acceptance && !(now.bar?.acceptance ?? "").includes(loop.bar.acceptance)) {
      loosened(`acceptance of ${loop.id} rewritten: ${JSON.stringify(now.bar?.acceptance ?? null)}`);
    }
  }
  const order = ["fixed", "propose", "adaptive"];
  if (order.indexOf(effectiveAdaptation(working)) > order.indexOf(effectiveAdaptation(source))) {
    loosened(`adaptation level ${effectiveAdaptation(source)} → ${effectiveAdaptation(working)}`);
  }
}

// ── who wrote what: the session transcripts ──────────────────────────────
let output = {};
try {
  output = JSON.parse(readFileSync(join(env.SCRATCH, "claude-output.json"), "utf8"));
} catch {
  problems.push("claude-output.json is not JSON");
}
const writes = [];
const sessionId = output.session_id;
const projects = join(env.CLAUDE_DIR, "projects");
let transcripts = [];
if (sessionId && existsSync(projects)) {
  for (const project of readdirSync(projects)) {
    const main = join(projects, project, `${sessionId}.jsonl`);
    if (!existsSync(main)) continue;
    transcripts.push({ file: main, who: "lead" });
    const subagents = join(projects, project, sessionId, "subagents");
    if (existsSync(subagents)) {
      for (const name of readdirSync(subagents).filter((n) => n.endsWith(".jsonl"))) {
        const meta = join(subagents, name.replace(/\.jsonl$/, ".meta.json"));
        let who = "subagent";
        try {
          who = JSON.parse(readFileSync(meta, "utf8")).agentType ?? who;
        } catch {}
        transcripts.push({ file: join(subagents, name), who });
      }
    }
  }
}
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
for (const { file, who } of transcripts) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("tool_use")) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    for (const block of Array.isArray(entry.message?.content) ? entry.message.content : []) {
      if (block.type !== "tool_use") continue;
      const input = block.input ?? {};
      if (WRITE_TOOLS.has(block.name) && typeof input.file_path === "string") {
        writes.push({ who, tool: block.name, file: basename(input.file_path), path: input.file_path });
      } else if (block.name === "Bash" && typeof input.command === "string") {
        for (const match of input.command.matchAll(/(?:>>?|tee(?:\s+-a)?)\s*["']?([^\s"'|;&]+)/g)) {
          writes.push({ who, tool: "Bash", file: basename(match[1]), path: match[1] });
        }
      }
    }
  }
}
const reviewWrites = writes.filter((w) => w.file === "REVIEW.md");
const readmeWrites = writes.filter((w) => w.file === "README.md");
if (transcripts.length === 0) {
  problems.push(`no transcript for session ${sessionId ?? "(unknown)"} under ${projects}: who wrote REVIEW.md is unverified`);
} else {
  if (!reviewWrites.some((w) => w.who === criticAgent)) problems.push("the critic never wrote REVIEW.md itself");
  const others = reviewWrites.filter((w) => w.who !== criticAgent);
  if (others.length > 0) problems.push(`REVIEW.md was written by ${[...new Set(others.map((w) => w.who))].join(", ")}, not only the critic`);
}

// ── the uncovered requirement: README.md ─────────────────────────────────
const readmeAmendments = amendments.filter((note) => /readme/i.test(JSON.stringify(note.amendment)));
const workingMentionsReadme = working !== undefined && /readme/i.test(JSON.stringify(working.nodes));
findings.push(`README.md in the diff: ${env.README_DIFF || "unchanged"}`);
findings.push(`README.md written by: ${[...new Set(readmeWrites.map((w) => w.who))].join(", ") || "nobody"}`);
findings.push(
  readmeAmendments.length > 0
    ? `the lead amended the working copy for it: ${readmeAmendments.map((n) => n.amendment.summary).join(" | ")}`
    : amendments.length > 0
      ? `amendments, none about README: ${amendments.map((n) => n.amendment.summary).join(" | ")}`
      : "no amendment",
);
findings.push(`the working copy's nodes mention README: ${workingMentionsReadme ? "yes" : "no"}`);
if (proposals.length > 0) findings.push(`proposals: ${proposals.map((n) => n.proposal.summary).join(" | ")}`);
findings.push(`working copy vs source: ${working === undefined ? "no working copy" : diffSummary.length > 0 ? diffSummary.join("; ") : "identical"}`);

// ── summary ──────────────────────────────────────────────────────────────
const rounds = notes.reduce((max, note) => (typeof note.round === "number" ? Math.max(max, note.round) : max), 0);
const nodeRuns = notes.filter((note) => typeof note.at === "string" && note.at.startsWith("node:"));
const row = (label, value) => console.log(`${label.padEnd(18)}${value}`);
row("notes", notes.length);
row("node runs", `${nodeRuns.length} (${[...new Set(nodeRuns.map((n) => n.at))].join(", ")})`);
row("critic notes", criticNotes.length);
row("loop notes", loopNotes.length);
row("rounds recorded", rounds);
row("ending", named.join(", ") || "none");
row("last note", JSON.stringify(last));
row("REVIEW.md writes", reviewWrites.map((w) => `${w.who} (${w.tool})`).join(", ") || "none found");
row("amendments", amendments.length);
row("harness turns", output.num_turns ?? "unknown");
row("cost (usd)", output.total_cost_usd ?? "unknown");
row("duration (s)", output.duration_ms ? Math.round(output.duration_ms / 1000) : "unknown");
row("model result", output.subtype ?? "unknown");
console.log("\nfindings (reported, not judged):");
for (const finding of findings) console.log(`  - ${finding}`);

if (problems.length > 0) {
  console.error("\nproblems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
NODE

say "PROGRESS.md"
sed -n '1,60p' "$RUN_DIR/PROGRESS.md"

say "PASS"
printf 'run id        %s\n' "$RUN_ID"
printf 'scratch       %s\n' "$SCRATCH"
printf 'notes         %s\n' "$RUN_DIR/notes.jsonl"
printf 'working copy  %s\n' "$RUN_DIR/graph.grooph.json"
printf 'claude output %s\n' "$SCRATCH/claude-output.json"
