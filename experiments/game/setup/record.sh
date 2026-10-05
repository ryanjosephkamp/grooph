#!/bin/bash
#
# After a session of the game experiment has ended: copy what PROTOCOL.md section 4 lists into its record, and say
# what was found. It reads the game's folder and the transcript; it changes neither, and shows no session anything.
#
#   experiments/game/setup/record.sh rehearsal
#   experiments/game/setup/record.sh run
#
# It does not score: finding the result commit and running the checks three times is setup/score.sh (a later slice).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(git -C "$here" rev-parse --show-toplevel)"
which="${1:?rehearsal or run}"
record="$root/experiments/game/runs/claude-code/$which"
[ -f "$record/setup.txt" ] || { echo "record: $record/setup.txt is not there, so no session of this name was started by start-claude.sh." >&2; exit 1; }
field() { sed -n "s/^$1: *//p" "$record/setup.txt" | head -1; }
id="$(field 'session id')"
folder="$(field 'the folder')"
transcript="$(field 'its transcript' | sed 's/ (stays on this machine)$//')"
out="$record/after"
mkdir -p "$out"

# The run folder (notes, progress, the working copy of the graph), and what the hook wrote.
[ -d "$folder/.grooph/arena/runs" ] && cp -R "$folder/.grooph/arena/runs" "$out/run-folder"
[ -d "$folder/.grooph/events" ] && cp -R "$folder/.grooph/events" "$out/events"
git -C "$folder" log --format='%H %cI %s' >"$out/commits.txt"
git -C "$folder" status --porcelain >"$out/uncommitted.txt"
git -C "$folder" tag --list >"$out/tags.txt"

# The transcript stays on the machine: its place, its size and its checksum are the record. Subagents' transcripts
# are beside it, in a folder named for the session.
{
  echo "session id: $id"
  if [ -f "$transcript" ]; then
    echo "transcript: $transcript"
    echo "bytes: $(wc -c <"$transcript" | tr -d ' ')"
    echo "sha256: $(shasum -a 256 "$transcript" | cut -d' ' -f1)"
  else
    echo "transcript: NOT FOUND at $transcript"
  fi
} >"$out/transcript.txt"
all="$(dirname "$transcript")"
files="$( { [ -f "$transcript" ] && echo "$transcript"; [ -d "$all/$id" ] && find "$all/$id" -type f -name '*.jsonl'; } 2>/dev/null || true)"

# Which models answered, as the transcripts name them.
if [ -n "$files" ]; then
  # shellcheck disable=SC2086
  cat $files | grep -o '"model":"[^"]*"' | sort | uniq -c >"$out/models.txt" || true
  # Was anything of the held-out checks seen? Their folder's path and their file names, looked for in every transcript.
  {
    echo "Looked for in $(echo "$files" | wc -l | tr -d ' ') transcript file(s). A count above 0 is a hit to be read by a person:"
    for needle in "experiments/game/acceptance" "game/acceptance" "acceptance/check.mjs" "acceptance/LIST.md" "prove.mjs" "stand-ins/" "one-at-a-time" "Documents/grooph/"; do
      # shellcheck disable=SC2086
      echo "  $(cat $files | grep -c -F "$needle" || true)  $needle"
    done
  } >"$out/held-out-checks-seen.txt"
  # Anything refused: a permission, a host, a read.
  # shellcheck disable=SC2086
  cat $files | grep -o -i -E 'permission[^"]{0,80}denied[^"]{0,120}|not in the allow[^"]{0,120}|blocked by[^"]{0,120}|Operation not permitted[^"]{0,120}|host[^"]{0,40}not allowed[^"]{0,120}' | sort | uniq -c | sort -rn | head -60 >"$out/refusals.txt" || true
fi

commits="$(wc -l <"$out/commits.txt" | tr -d ' ')"
node "$here/ledger.mjs" end "$which" "recorded_after=$(date -u +%Y-%m-%dT%H:%M:%SZ)" "commits=$commits" "head=$(git -C "$folder" rev-parse HEAD)" "transcript_sha256=$(sed -n 's/^sha256: //p' "$out/transcript.txt")"

echo "the record:        $out"
echo "commits:           $commits (the first is the starting contents), $(wc -l <"$out/uncommitted.txt" | tr -d ' ') files not committed"
echo "tags:              $(tr '\n' ' ' <"$out/tags.txt")"
echo "run folder copied: $([ -d "$out/run-folder" ] && echo yes || echo 'no: the session made none')"
echo "events copied:     $([ -d "$out/events" ] && ls "$out/events" | wc -l | tr -d ' ' || echo 0) file(s)"
[ -f "$out/models.txt" ] && { echo "models that answered:"; sed 's/^/  /' "$out/models.txt"; }
[ -f "$out/held-out-checks-seen.txt" ] && cat "$out/held-out-checks-seen.txt"
[ -s "$out/refusals.txt" ] && { echo "refused (the most frequent; all in $out/refusals.txt):"; head -8 "$out/refusals.txt" | cut -c1-200; }
echo
echo "Write the owner's own notes (the time 'start' was answered, anything asked in the middle, a pause, the wall, what /cost printed) in $record/owner-notes.txt, then commit experiments/game/runs and experiments/game/ledger.json."
