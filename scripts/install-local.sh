#!/usr/bin/env bash
# Install grooph from this clone for the current user (docs/executive.md §5):
#
#   <bin dir>/grooph                  -> <repo>/packages/cli/bin/grooph.js    the CLI, on PATH
#   ~/.claude/skills/grooph-design    -> <repo>/plugins/grooph/skills/grooph-design   the skill, for Claude Code
#
# Both are symbolic links into this clone, so `git pull && pnpm -r build` updates them.
# It prints exactly what it will touch before touching anything, changes nothing that is
# already right, and never replaces a file or link it did not make. It does not edit your
# shell profile; when the bin folder is not on PATH it says which line to add.
#
# Usage:
#   scripts/install-local.sh [--bin-dir <dir>] [--dry-run]
#   scripts/install-local.sh --uninstall [--bin-dir <dir>] [--dry-run]
#
#   --bin-dir <dir>  where the `grooph` link goes (default: $HOME/.local/bin)
#   --dry-run        print the plan and stop
#   --uninstall      remove the two links, only if they still point into this clone
#
# Needs Node 22 or later and a built CLI (pnpm install && pnpm -r build).

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
BIN_DIR="${HOME}/.local/bin"
MODE="install"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bin-dir)
      [[ $# -ge 2 && -n "$2" ]] || { echo "install-local: --bin-dir needs a folder" >&2; exit 2; }
      BIN_DIR="$2"
      shift 2
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    -h | --help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install-local: unknown option $1 (see --help)" >&2; exit 2 ;;
  esac
done

CLI_TARGET="$REPO/packages/cli/bin/grooph.js"
SKILL_TARGET="$REPO/plugins/grooph/skills/grooph-design"
CLI_LINK="$BIN_DIR/grooph"
SKILLS_DIR="$HOME/.claude/skills"
SKILL_LINK="$SKILLS_DIR/grooph-design"

# What is at a path: "absent", "ours" (a link to the target), or a description of something else.
state_of() {
  local link="$1" target="$2"
  if [[ -L "$link" ]]; then
    local points
    points="$(readlink "$link")"
    if [[ "$points" == "$target" ]]; then echo "ours"; else echo "a link to $points"; fi
  elif [[ -e "$link" ]]; then
    if [[ -d "$link" ]]; then echo "a folder"; else echo "a file"; fi
  else
    echo "absent"
  fi
}

# The plan as printed, and beside each line what to do: "", "mkdir<US>dir", "link<US>target<US>link" or "rm<US>link".
US=$'\x1f'
plan=()
actions=()
blocked=0

add() { plan+=("$1"); actions+=("$2"); }

run_action() {
  local verb a b
  IFS="$US" read -r verb a b <<<"$1"
  case "$verb" in
    mkdir) mkdir -p "$a" ;;
    link) ln -s "$a" "$b" ;;
    rm) rm "$a" ;;
  esac
}

if [[ "$MODE" == "install" ]]; then
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if (( node_major < 22 )); then
    echo "install-local: grooph needs Node 22 or later on PATH (found: $(node --version 2>/dev/null || echo none))" >&2
    exit 1
  fi
  if [[ ! -f "$REPO/packages/cli/dist/src/index.js" || ! -d "$REPO/packages/cli/dist/patterns" ]]; then
    echo "install-local: the CLI is not built yet. In $REPO run:" >&2
    echo "  pnpm install && pnpm -r build" >&2
    exit 1
  fi
  [[ -f "$SKILL_TARGET/SKILL.md" ]] || { echo "install-local: $SKILL_TARGET/SKILL.md is missing" >&2; exit 1; }

  for pair in "$CLI_LINK|$CLI_TARGET|the grooph CLI" "$SKILL_LINK|$SKILL_TARGET|the grooph-design skill"; do
    IFS='|' read -r link target what <<<"$pair"
    state="$(state_of "$link" "$target")"
    case "$state" in
      ours) add "unchanged  $link -> $target  ($what, already linked)" "" ;;
      absent)
        parent="$(dirname "$link")"
        [[ -d "$parent" ]] || add "create     $parent/  (folder)" "mkdir${US}${parent}"
        add "link       $link -> $target  ($what)" "link${US}${target}${US}${link}"
        ;;
      *)
        add "BLOCKED    $link is $state; it is not grooph's, so it is left alone. Move it aside and run this again." ""
        blocked=1
        ;;
    esac
  done
else
  for pair in "$CLI_LINK|$CLI_TARGET" "$SKILL_LINK|$SKILL_TARGET"; do
    IFS='|' read -r link target <<<"$pair"
    state="$(state_of "$link" "$target")"
    case "$state" in
      ours) add "remove     $link  (link to $target)" "rm${US}${link}" ;;
      absent) add "unchanged  $link  (not there)" "" ;;
      *) add "skip       $link is $state, not a link into this clone; left alone" "" ;;
    esac
  done
fi

echo "grooph ${MODE}, from $REPO"
echo "home: $HOME"
for line in "${plan[@]}"; do echo "  $line"; done

if (( blocked )); then
  echo "Nothing was changed." >&2
  exit 1
fi

pending=0
for action in "${actions[@]}"; do if [[ -n "$action" ]]; then pending=1; fi; done
if (( DRY_RUN )); then
  echo "Dry run: nothing was changed."
  exit 0
fi
if (( pending == 0 )); then
  echo "Nothing to do."
else
  for action in "${actions[@]}"; do
    if [[ -n "$action" ]]; then run_action "$action"; fi
  done
  echo "Done."
fi

if [[ "$MODE" == "install" ]]; then
  echo "check: $("$CLI_LINK" --version) at $CLI_LINK"
  case ":$PATH:" in
    *":$BIN_DIR:"*) echo "grooph is on PATH. In Claude Code the skill is /grooph-design; running sessions pick it up without a restart." ;;
    *)
      echo "$BIN_DIR is not on PATH, so the shell will not find grooph yet. Add this line to your shell profile (this script does not edit it):"
      echo "  export PATH=\"$BIN_DIR:\$PATH\""
      ;;
  esac
fi
