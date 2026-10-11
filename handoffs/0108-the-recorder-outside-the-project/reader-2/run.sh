#!/usr/bin/env bash
# Second reader, slice 0108 (the attack on the answer to the first reader). No model, no network; scratch folders only.
# Every run of grooph goes through ../reader/lib.mjs, which refuses to start it unless GROOPH_HOME, CLAUDE_CONFIG_DIR,
# CODEX_HOME and HOME all resolve under a scratch folder it made. Each script prints one line per attack:
# [HELD], [BROKE] or [LIMIT]. The kept outputs are out-<script>.txt.
#
#   ./run.sh 10-reinstall.mjs               install --user run again with --tools changed or GROOPH_HOME moved
#   ./run.sh 11-fuzz-settings.mjs --small   the settings editor against model.mjs: 43 small texts x 4 option sets
#   ./run.sh 11-fuzz-settings.mjs --seed 1 --count 400 --jobs 4     random texts (./fuzz-all.sh runs the small set and seeds 1 to 3)
#   ./run.sh 12-entries.mjs                 which entries are taken for grooph's; remove and the hook's file; the refusal in a home folder
#   ./run.sh 13-readers.mjs                 what a session can still do to the readers from inside its listed project
#   ./run.sh 14-writes.mjs                  where install and remove refuse; leftover *.grooph-tmp; deep and large settings
#   ./run.sh 15-list.mjs --rounds 10        the list's lock: a lock left behind, a holder stopped, fifty commands at once; refusals
#   ./run.sh 15b-stale-lock.mjs --rounds 60 one race of 15, more times
#   ./run.sh 16-kill.mjs --times 200        remove and both-harness installs killed at random moments
#   ./run.sh 17-hook.mjs                    the hook: what stands at watched.json; GROOPH_EVENTS_DIR in each layout
#   ./run.sh 18-misc.mjs --rounds 150       install and remove at the same moment; a project's remove in ~; two sentences
#   ./run.sh 19-odd-texts.mjs               settings that are not UTF-8, have a byte-order mark, or write a key twice
#   ./run.sh 20-list-words.mjs              two sentences about a list that cannot be read whole
#   GROOPH_MAIN_CLI=<origin/main's built bin/grooph.js> ./rerun-first-reader.sh    the first reader's scripts again (out-r1-*.txt)
#   the races: (cd ../reader && node race.mjs --layout user --race dir-name --attacker swap --calls 2000 --conc 8), kept in out-races.txt
#
# Environment, all optional (as for the first reader's scripts):
#   GROOPH_CLI    the built bin/grooph.js to attack (default: this worktree's packages/cli/bin/grooph.js)
#   READER_TMP    where the scratch folder is made (default: the system's temporary folder)
#   READER_KEEP=1 leave the scratch folder in place afterward
cd "$(dirname "$0")" || exit 1
exec node "$@"
