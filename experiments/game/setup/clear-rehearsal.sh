#!/bin/bash
#
# After the rehearsal has been recorded and read, and before the run: move what the rehearsal left out of the run's
# reach. Neither arm keeps its rehearsal's leftovers (PROTOCOL.md section 10): the folder it built in, its transcript
# in the profile, the npm cache it warmed, its temp files. The run starts as if no rehearsal had happened, except
# that the profile is signed in and the browser is installed, which is so for both arms.
#
#   experiments/game/setup/clear-rehearsal.sh            move them, and say where
#   experiments/game/setup/clear-rehearsal.sh --print    say what would be moved, and move nothing
#
# It deletes nothing. Everything goes to ~/grooph-game-kept/rehearsal-claude-<time>/ (GROOPH_GAME_KEPT moves it),
# and the rehearsal's record is told where. The transcript's checksum was taken by record.sh before the move.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(git -C "$here" rev-parse --show-toplevel)"
home="${GROOPH_GAME_HOME:-$HOME/grooph-game}"
profile="$home/profile-claude"
cache="$home/npm-cache-claude"
temp="$home/t"
record="${GROOPH_GAME_DRY_RECORD:-$root/experiments/game/runs/claude-code/rehearsal}"
stop() { echo "clear-rehearsal: $*" >&2; exit 1; }
print=0; [ "${1:-}" = "--print" ] && print=1

[ -f "$record/setup.txt" ] || stop "no rehearsal was started by start-claude.sh ($record/setup.txt is not there). Nothing to clear."
[ -f "$record/after/transcript.txt" ] || stop "the rehearsal has not been recorded yet. Run experiments/game/setup/record.sh rehearsal first: it takes the transcript's checksum where the transcript is now."
# start-claude.sh names every session it starts, and the name is on the process's command line.
if pgrep -f -- "--name arena-claude-" >/dev/null 2>&1; then
  stop "a session of this profile is still open. /exit it first."
fi

kept="${GROOPH_GAME_KEPT:-$HOME/grooph-game-kept}/rehearsal-claude-$(date -u +%Y%m%dT%H%M%SZ)"
case "$kept/" in "$home"/*) stop "$kept is inside $home, where the run could look. Name another folder with GROOPH_GAME_KEPT." ;; esac

moves=()
[ -e "$home/rehearsal-claude" ] && moves+=("$home/rehearsal-claude|folder")
for transcripts in "$profile"/projects/*rehearsal-claude*; do [ -e "$transcripts" ] && moves+=("$transcripts|transcripts/$(basename "$transcripts")"); done
[ -n "$(ls -A "$cache" 2>/dev/null)" ] && moves+=("$cache|npm-cache")
[ -n "$(ls -A "$temp" 2>/dev/null)" ] && moves+=("$temp|temp")

if [ "${#moves[@]}" = 0 ]; then echo "nothing of the rehearsal is left in $home"; exit 0; fi
for move in "${moves[@]}"; do
  from="${move%%|*}"; to="$kept/${move##*|}"
  if [ "$print" = 1 ]; then echo "would move $from -> $to"; continue; fi
  mkdir -p "$(dirname "$to")"
  mv "$from" "$to"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) moved $from -> $to" | tee -a "$record/after/moved.txt"
done
[ "$print" = 1 ] && exit 0
# The cache and the temp folder are there again, empty, as make-profile.sh made them.
mkdir -p "$cache" "$temp"
echo
echo "The rehearsal's leftovers are in $kept. The run can now be started."
echo "Commit experiments/game/runs: the rehearsal's record says where they went."
