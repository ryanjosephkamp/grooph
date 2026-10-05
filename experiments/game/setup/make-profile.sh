#!/bin/bash
#
# The clean profile for the Claude Code run (PROTOCOL.md section 2; setup/PROFILE.md says what each line is for and
# where it is documented): a configuration folder of its own, outside grooph's clone, holding one settings file.
#
#   experiments/game/setup/make-profile.sh            make it, or write its settings file again
#   experiments/game/setup/make-profile.sh --check    make nothing: say whether the one that is there is as it should be
#
# It writes settings.json and nothing else. Signing in is the owner's, once, inside Claude Code (RUNBOOK.md); the
# sign-in is kept in the macOS Keychain under this folder's own entry, apart from the account's everyday one.
# GROOPH_GAME_HOME moves the folders (default: ~/grooph-game).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
home="${GROOPH_GAME_HOME:-$HOME/grooph-game}"
profile="$home/profile-claude"
cache="$home/npm-cache-claude"
settings="$(sed "s|__NPM_CACHE__|$cache|g" "$here/profile/settings.json")"
printf '%s' "$settings" | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' || { echo "make-profile: the settings are not JSON" >&2; exit 1; }

if [ "${1:-}" = "--check" ]; then
  [ -f "$profile/settings.json" ] || { echo "make-profile: $profile/settings.json is not there. Run make-profile.sh." >&2; exit 1; }
  [ "$(cat "$profile/settings.json")" = "$settings" ] || { echo "make-profile: $profile/settings.json is not what setup/profile/settings.json says. Run make-profile.sh again." >&2; exit 1; }
  # Nothing of an account's own may be in it: instructions, skills, agents, plugins, servers.
  for extra in CLAUDE.md skills agents commands plugins rules; do
    [ -e "$profile/$extra" ] && { echo "make-profile: $profile/$extra is there. A clean profile has none." >&2; exit 1; }
  done
  [ -d "$profile/no-shell-startup" ] && [ -z "$(ls -A "$profile/no-shell-startup")" ] || { echo "make-profile: $profile/no-shell-startup must be there and empty. Run make-profile.sh." >&2; exit 1; }
  echo "the profile at $profile is as it should be"
  exit 0
fi
# no-shell-startup stays empty: it is where the session's shell looks for start-up files, so that it finds none.
mkdir -p "$profile/no-shell-startup" "$cache"
printf '%s\n' "$settings" >"$profile/settings.json"
echo "the profile:   $profile"
echo "its settings:  $profile/settings.json"
echo "npm's cache:   $cache (empty at first; the only folder outside its own a session may write)"
