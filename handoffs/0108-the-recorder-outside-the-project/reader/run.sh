#!/usr/bin/env bash
# Run one of the fresh reader's scripts (slice 0108). No model, no network; scratch folders only.
#
#   ./run.sh 01-hook-user.mjs          the hook in the --user layout, standing attacks (promise 1)
#   ./run.sh 02-settings.mjs           install --user / remove --user on a person's settings (promise 2)
#   ./run.sh 02b-numbers.mjs           what install writes back for numbers JavaScript cannot hold
#   ./run.sh 03-paths.mjs              GROOPH_HOME with characters a shell reads; the entry under sh, bash, zsh
#   ./run.sh 04-list.mjs               watch, unwatch, status, the refusals, commands at the same moment (promise 3)
#   ./run.sh 05-readers.mjs            sessions, hooks status, watch --sessions in a listed folder (promise 4)
#   ./run.sh 06-clean-project.mjs      nothing of grooph's left in a watched git project (promise 5)
#   GROOPH_MAIN_CLI=<origin/main's built packages/cli/bin/grooph.js> ./run.sh 07-project-layout.mjs   (promise 6)
#   ./run.sh 08-kill.mjs --times 250   install and watch killed at random moments
#   ./run.sh 09-home-collision.mjs     a project install made in ~ beside the user-level one
#   ./run.sh race.mjs --layout user --race hardlink-ours --calls 4000     one race (its header lists them)
#   ./races-all.sh out.txt             every race, both layouts;  ./races-hardlink-again.sh out.txt
#   ./run.sh make-table.mjs > table.md every row of the kept outputs (out-*.txt) as one table
#
# Environment, all optional:
#   GROOPH_CLI    the built bin/grooph.js to attack (default: this worktree's packages/cli/bin/grooph.js)
#   READER_TMP    where the scratch folder is made (default: the system's temporary folder)
#   READER_KEEP=1 leave the scratch folder in place afterward
#
# lib.mjs runs the command only with GROOPH_HOME, CLAUDE_CONFIG_DIR, CODEX_HOME and HOME all under that scratch
# folder, and stops with an error otherwise. Each script prints one line per attack: [HELD], [BROKE] or [LIMIT].
cd "$(dirname "$0")" || exit 1
exec node "$@"
