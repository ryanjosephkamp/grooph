#!/usr/bin/env bash
#
# Headless acceptance run for the Claude Code package (handoff 0001, criterion 6).
#
# Builds a scratch project under $TMPDIR with a small task, a review checklist, a
# test command and the exported package, then runs the command from
# docs/targets/claude-code.md § "Headless acceptance run" and checks what the run
# left behind: a progress file, run notes, a note from the critic's own subagent,
# a note per loop pass, and an ending that names a stop.
#
# This spends real tokens. Usage:
#   scripts/e2e-claude-code.sh              run it
#   scripts/e2e-claude-code.sh --dry-run    build the scratch project, skip the model
#   scripts/e2e-claude-code.sh --keep-dir D use D instead of a fresh mktemp directory
#
set -euo pipefail

DRY_RUN=0
SCRATCH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --keep-dir) SCRATCH="${2:?--keep-dir needs a directory}"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAPH="$REPO_ROOT/fixtures/valid/review-loop.grooph.json"
GRAPH_ID="review-loop"
LOOP_ID="review-cycle"
CRITIC_ID="critic"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAIL\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- scratch project

if [ -z "$SCRATCH" ]; then
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/grooph-e2e-XXXXXX")"
fi
mkdir -p "$SCRATCH/src" "$SCRATCH/tests" "$SCRATCH/docs"
say "scratch project: $SCRATCH"

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

Run the test command before you report:

```
npm test
```

Touch nothing outside `src/` and `tests/`.
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
6. Nothing outside `src/` and `tests/` changed.
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

# The run needs a shell for the test command and for the diff the critic inspects.
# Narrow on purpose: the acceptance test is about the package, not about how much
# the sandbox allows.
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
node "$REPO_ROOT/packages/cli/bin/grooph.js" export "$GRAPH" \
  --target claude-code --into "$SCRATCH" | sed -n '1,9p'

git -C "$SCRATCH" add -A
git -C "$SCRATCH" commit -qm "scratch project with the grooph package"

KICKOFF="$SCRATCH/.grooph/$GRAPH_ID/KICKOFF.md"
[ -f "$KICKOFF" ] || fail "the export did not write $KICKOFF"

if [ "$DRY_RUN" = "1" ]; then
  say "dry run: the scratch project is ready, the model was not called"
  find "$SCRATCH" -type f -not -path '*/.git/*' | sed "s|$SCRATCH/||" | sort
  exit 0
fi

# ---------------------------------------------------------------- the headless run

say "running the package headless (this spends tokens)"
cd "$SCRATCH"
set +e
claude -p "$(cat ".grooph/$GRAPH_ID/KICKOFF.md")" --permission-mode acceptEdits --output-format json \
  > "$SCRATCH/claude-output.json" 2> "$SCRATCH/claude-stderr.txt"
CLAUDE_STATUS=$?
set -e
printf 'claude exit status: %s\n' "$CLAUDE_STATUS"
if [ ! -s "$SCRATCH/claude-output.json" ]; then
  sed -n '1,40p' "$SCRATCH/claude-stderr.txt" >&2 || true
  fail "claude produced no output"
fi

# ---------------------------------------------------------------- assertions

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

say "checking the run notes"
CRITIC_ID="$CRITIC_ID" LOOP_ID="$LOOP_ID" node - "$RUN_DIR/notes.jsonl" "$SCRATCH/claude-output.json" <<'NODE'
import { readFileSync } from "node:fs";

const [notesPath, outputPath] = process.argv.slice(2);
const criticAt = `node:${process.env.CRITIC_ID}`;
const loopAt = `loop:${process.env.LOOP_ID}`;

const raw = readFileSync(notesPath, "utf8").split("\n").filter((line) => line.trim() !== "");
const notes = [];
const broken = [];
for (const line of raw) {
  try {
    notes.push(JSON.parse(line));
  } catch {
    broken.push(line);
  }
}

const problems = [];
if (broken.length > 0) problems.push(`${broken.length} line(s) in notes.jsonl are not JSON`);
if (notes.length === 0) problems.push("notes.jsonl holds no parsable note");

const criticNotes = notes.filter((note) => note.at === criticAt);
const loopNotes = notes.filter((note) => note.at === loopAt);
if (criticNotes.length === 0) problems.push(`no note with "at":"${criticAt}" — the critic did not run as its own subagent`);
if (loopNotes.length === 0) problems.push(`no note with "at":"${loopAt}" — no loop pass was recorded`);

const last = notes[notes.length - 1] ?? {};
const ending = `${last.outcome ?? ""} ${last.text ?? ""} ${last.verdict ?? ""}`.toLowerCase();
const stopWords = ["bar-passed", "bar passed", "max-iterations", "max iterations", "budget", "done", "halt"];
const named = stopWords.filter((word) => ending.includes(word));
if (named.length === 0) {
  problems.push(`the last note does not name a stop or the stop node: ${JSON.stringify(last)}`);
}

const rounds = notes.reduce((max, note) => (typeof note.round === "number" ? Math.max(max, note.round) : max), 0);

let turns = "unknown";
let cost = "unknown";
try {
  const output = JSON.parse(readFileSync(outputPath, "utf8"));
  turns = output.num_turns ?? "unknown";
  cost = output.total_cost_usd ?? "unknown";
} catch {
  /* the summary is a nicety, not an assertion */
}

const nodeRuns = notes.filter((note) => typeof note.at === "string" && note.at.startsWith("node:"));
console.log(`notes            ${notes.length}`);
console.log(`node runs        ${nodeRuns.length} (${[...new Set(nodeRuns.map((n) => n.at))].join(", ")})`);
console.log(`critic notes     ${criticNotes.length}`);
console.log(`loop notes       ${loopNotes.length}`);
console.log(`rounds recorded  ${rounds}`);
console.log(`stop named       ${named.join(", ") || "none"}`);
console.log(`last note        ${JSON.stringify(last)}`);
console.log(`lead turns       ${turns}`);
console.log(`cost (usd)       ${cost}`);

if (problems.length > 0) {
  console.error("\nproblems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
NODE

say "PROGRESS.md"
sed -n '1,40p' "$RUN_DIR/PROGRESS.md"

say "PASS"
printf 'run id        %s\n' "$RUN_ID"
printf 'scratch       %s\n' "$SCRATCH"
printf 'notes         %s\n' "$RUN_DIR/notes.jsonl"
printf 'claude output %s\n' "$SCRATCH/claude-output.json"
