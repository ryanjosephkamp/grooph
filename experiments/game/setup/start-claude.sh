#!/bin/bash
#
# Start the Claude Code session of the game experiment from the clean profile, in a terminal (PROTOCOL.md section 2;
# setup/PROFILE.md says what each line is for). The owner runs this; nothing else does.
#
#   experiments/game/setup/start-claude.sh rehearsal        the rehearsal, in ~/grooph-game/rehearsal-claude
#   experiments/game/setup/start-claude.sh run              the run, in ~/grooph-game/grooph-game-experiment-claude
#   experiments/game/setup/start-claude.sh sign-in          an empty folder, to sign in to the profile once
#   experiments/game/setup/start-claude.sh <which> --print  check everything, print the command, start nothing
#
# Before it starts anything it checks the machine and the folder, and writes the setup into the record
# (experiments/game/runs/claude-code/<which>/setup.txt) with a row in the ledger: a run is recorded before it is used.
# GROOPH_GAME_HOME moves the folders (default: ~/grooph-game).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(git -C "$here" rev-parse --show-toplevel)"
clone="$(cd "$(git -C "$here" rev-parse --git-common-dir)/.." && pwd -P)"
home="${GROOPH_GAME_HOME:-$HOME/grooph-game}"
profile="$home/profile-claude"
cache="$home/npm-cache-claude"
temp="$home/t" # the session's own temp folder (make-profile.sh makes it; setup/PROFILE.md says why it is not /tmp)
MODEL="claude-opus-5-5" # the lead is on the frontier tier, which the owner answered is Opus 5.5 (ANSWERS.md, 1)
stop() { echo "start-claude: $*" >&2; exit 1; }

which="${1:-}"; print=0; [ "${2:-}" = "--print" ] && print=1
case "$which" in
  rehearsal) folder="$home/rehearsal-claude" ;;
  run) folder="$home/grooph-game-experiment-claude" ;;
  sign-in) folder="$home/sign-in" ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

# The harness by its full path, and a path for the session that holds node, npm and git and not the grooph command:
# on this machine that command is a link into the clone that holds the checks.
claude="$(command -v claude || true)"; [ -x "$claude" ] || stop "claude is not on this terminal's PATH."
node_dir="$(dirname "$(command -v node)")"
session_path="$node_dir:/usr/bin:/bin:/usr/sbin:/sbin"
found() { PATH="$session_path" command -v "$1" 2>/dev/null || true; }
[ -z "$(found grooph)" ] || stop "the grooph command is on the session's path ($(found grooph)). It must not be."
for tool in node npm git; do [ -n "$(found $tool)" ] || stop "$tool is not on the session's path ($session_path)."; done

# The profile is the one this repository describes, with nothing of an account's in it.
"$here/make-profile.sh" --check >/dev/null || stop "the clean profile is not ready: run experiments/game/setup/make-profile.sh"
[ -e "/Library/Application Support/ClaudeCode" ] && stop "this machine has managed Claude Code settings (/Library/Application Support/ClaudeCode), which every session loads. Tell the driver."

if [ "$which" = "sign-in" ]; then
  mkdir -p "$folder"
else
  # A session's commands can reach every port on this machine's localhost (setup/PROFILE.md). The checks are served
  # on 4361 when they are run or proved, and their stand-in pages are not for a builder to see. So no session starts
  # while that port is open or anything of the checks' folder is running, on this machine, in any session.
  serving="$(lsof -nP -iTCP:4361 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $1" (pid "$2")"}' | sort -u | tr '\n' ' ')"
  [ -z "$serving" ] || stop "port 4361, where the held-out checks are served, is open on this machine: $serving. Whoever is running them must stop first (another lane's dry run counts). Tell the driver."
  running="$(pgrep -fl 'experiments/game/acceptance/' 2>/dev/null | head -3 | cut -c1-160 || true)"
  [ -z "$running" ] || stop "something of the held-out checks' folder is running on this machine: $running. It must stop first. Tell the driver."
  # The folder is the starting contents, outside the clone, with no instructions above it for a session to load.
  [ -d "$folder/.git" ] || stop "$folder is not there. Make it: experiments/game/setup/make-repo.sh$([ "$which" = rehearsal ] && echo ' --rehearsal')"
  case "$folder/" in "$root"/*|"$clone"/*) stop "$folder is inside grooph's clone." ;; esac
  up="$folder"
  while [ "$up" != "/" ]; do
    for f in CLAUDE.md CLAUDE.local.md .claude/CLAUDE.md; do
      [ "$up" != "$folder" ] && [ -e "$up/$f" ] && stop "$up/$f is above the session's folder, and a session reads instructions from the folders above its own. Move it away for the run."
    done
    up="$(dirname "$up")"
  done
  [ "$(git -C "$folder" rev-parse 'HEAD^{tree}' 2>/dev/null)" ] || stop "$folder has no commit."
  if [ "$which" = "run" ]; then
    # Neither arm keeps what its rehearsal left (PROTOCOL.md section 10): the folder it built in, its transcript in
    # this profile, a warm npm cache, its temp files. clear-rehearsal.sh moves them out of reach and says where.
    left=""
    [ -e "$home/rehearsal-claude" ] && left="$left $home/rehearsal-claude"
    # npm writes its own logs into the cache's _logs whenever anything runs it; what a rehearsal warms is _cacache.
    [ -n "$(find "$cache/_cacache" -type f 2>/dev/null | head -1)" ] && left="$left $cache(holds-packages)"
    [ -n "$(find "$temp" -mindepth 1 -maxdepth 3 2>/dev/null | head -1)" ] && left="$left $temp(not empty)"
    [ -n "$(ls -d "$profile"/projects/*rehearsal-claude* 2>/dev/null | head -1)" ] && left="$left the-rehearsal's-transcript-in-the-profile"
    [ -z "$left" ] || stop "what the rehearsal left is still here:$left
The run starts with none of it, as the Codex run will. Run: experiments/game/setup/clear-rehearsal.sh"
    # The run starts from the first commit and nothing else (PROTOCOL.md section 8, step 1).
    [ -z "$(git -C "$folder" status --porcelain)" ] || stop "$folder has files that are not in its first commit. The run starts from the starting contents and nothing else."
    [ "$(git -C "$folder" rev-list --count HEAD)" = 1 ] || stop "$folder has more than its first commit."
  fi
fi

id="$(uuidgen | tr 'A-Z' 'a-z')"
name="arena-claude-$which"
# What a session is started with. Nothing of the terminal's own environment goes in: no key, no proxy, no setting
# of grooph's. `Edit(/**)` is the session's own folder: on the command line a rule's leading slash is that folder.
# ZDOTDIR is an empty folder, so the shell a command runs in reads none of the account's own start-up files, which
# on this machine put the grooph command's folder back on the path.
# TMPDIR and CLAUDE_CODE_TMPDIR are the profile's own temp folder: the default, /tmp, is where every other session on
# this machine keeps its scratch files, the checks' own copies among them, and the profile closes it to commands.
# The hook's two files are the one thing in the session's folder that runs outside the sandbox, so the session may
# not change them: the rule is the folder's whole path, which no settings file could know beforehand.
run=(env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" SHELL=/bin/zsh ZDOTDIR="$profile/no-shell-startup" TERM="${TERM:-xterm-256color}" LANG="${LANG:-en_US.UTF-8}"
  TMPDIR="$temp" CLAUDE_CODE_TMPDIR="$temp"
  PATH="$session_path"
  CLAUDE_CONFIG_DIR="$profile" CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 ENABLE_CLAUDEAI_MCP_SERVERS=false DISABLE_AUTOUPDATER=1
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 CLAUDE_CODE_AUTO_CONNECT_IDE=false
  "$claude" --model "$MODEL" --permission-mode dontAsk --allowedTools "Edit(/**)" --disallowedTools "Edit(/$folder/.grooph/hooks/**)" --strict-mcp-config --setting-sources user,project --no-chrome --session-id "$id" --name "$name")

if [ "$which" != "sign-in" ]; then
  # The setup, written before the session exists (PROTOCOL.md section 4; decision 0015).
  record="$root/experiments/game/runs/claude-code/$which"
  [ "$print" = 1 ] && record="${GROOPH_GAME_DRY_RECORD:-$record}"
  if [ "$print" = 0 ] && [ -e "$record/setup.txt" ]; then
    stop "$record/setup.txt is there: this $which has been started before. A second start is a second session: move the first one's record to $record-1 and say so in it, then start again."
  fi
  transcript="$profile/projects/$(printf '%s' "$folder" | sed 's/[^A-Za-z0-9]/-/g')/$id.jsonl"
  setup="$(
    echo "what:              the $which of the Claude Code run (experiments/game/PROTOCOL.md)"
    echo "written:           $(date -u +%Y-%m-%dT%H:%M:%SZ), before the session was started"
    echo "session id:        $id"
    echo "its transcript:    $transcript (stays on this machine)"
    echo "the folder:        $folder"
    echo "its first commit:  $(git -C "$folder" rev-list --max-parents=0 HEAD | head -1), tree $(git -C "$folder" rev-parse "$(git -C "$folder" rev-list --max-parents=0 HEAD | head -1)^{tree}")"
    echo "its head:          $(git -C "$folder" rev-parse HEAD) ($(git -C "$folder" status --porcelain | wc -l | tr -d ' ') files changed or new since)"
    echo "the spec:          sha256 $(shasum -a 256 "$folder/SPEC.md" | cut -d' ' -f1)"
    echo "the freeze:        grooph at $(sed -n 's/^FROZEN_COMMIT=//p' "$here/frozen.env"); compiled by packages as of $(sed -n 's/^COMPILED_BY=//p' "$here/frozen.env")"
    echo "this record's own: grooph at $(git -C "$root" rev-parse HEAD)"
    echo "the tiers:         $(grep -h '^model:' "$folder"/.claude/agents/*.md | sort | uniq -c | tr -s ' ' | tr '\n' ';') the lead $MODEL"
    echo "the harness:       $("$claude" --version)"
    echo "the machine:       macOS $(sw_vers -productVersion), $(uname -m); node $(node --version), npm $(npm --version), $(git --version)"
    echo "the browsers:      $(ls "$HOME/Library/Caches/ms-playwright" 2>/dev/null | grep -E '^chromium' | tr '\n' ' ')"
    echo "blender:           $(command -v blender >/dev/null && echo 'on the path' || echo 'not on the path')"
    echo "the session's path: $session_path (grooph: not on it)"
    echo "its temp folder:   $temp ($(find "$temp" -mindepth 1 2>/dev/null | wc -l | tr -d ' ') files in it at the start)"
    echo "npm's cache:       $cache ($(find "$cache/_cacache" -type f 2>/dev/null | wc -l | tr -d ' ') packages' files in it at the start)"
    echo "local ports open:  $(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{n=split($9,a,":"); print a[n]}' | sort -un | tr '\n' ' ')(a session's commands can reach any of them: setup/PROFILE.md)"
    echo "the profile:       $profile, settings sha256 $(shasum -a 256 "$profile/settings.json" | cut -d' ' -f1)"
    echo "the command:       ${run[*]}"
    echo "the order:         the Claude Code run first, by the owner's choice (PROTOCOL.md, the note of 2026-10-04)"
  )"
  if [ "$print" = 0 ]; then
    mkdir -p "$record"
    printf '%s\n' "$setup" >"$record/setup.txt"
    cp "$profile/settings.json" "$record/profile-settings.json"
    node "$here/ledger.mjs" start "$which" "$id" "$transcript"
    echo "the record: $record/setup.txt"
  else
    printf '%s\n' "$setup"
  fi
fi

cd "$folder"
if [ "$print" = 1 ]; then
  echo
  echo "would start, in $folder:"
  printf '  %s\n' "${run[*]}"
  exit 0
fi
exec "${run[@]}"
