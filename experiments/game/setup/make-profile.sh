#!/bin/bash
#
# The clean profile for the Claude Code run (PROTOCOL.md section 2; setup/PROFILE.md says what each line is for and
# where it is documented): a configuration folder of its own, outside grooph's clone, holding one settings file.
#
#   experiments/game/setup/make-profile.sh            make it, or write its settings file again
#   experiments/game/setup/make-profile.sh --check    make nothing: say whether the one that is there is as it should be
#
# It writes settings.json and makes three folders beside it; nothing else. Signing in is the owner's, once, inside
# Claude Code (RUNBOOK.md); the sign-in is kept in the macOS Keychain under this folder's own entry, apart from the
# account's everyday one. GROOPH_GAME_HOME moves the folders (default: ~/grooph-game).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
home="${GROOPH_GAME_HOME:-$HOME/grooph-game}"
profile="$home/profile-claude"
cache="$home/npm-cache-claude"
# The session's own temp folder. Claude Code keeps every session's temp files under one folder for the user, /tmp by
# default, where the other sessions on this machine keep theirs. This one is the profile's alone. Its name is short
# on purpose: with a long one Claude Code gives commands a temp folder under the system's instead.
temp="$home/t"
# The account's own temp folder on this machine (under /var/folders), which the profile closes to commands.
user_temp="$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null || true)"; user_temp="${user_temp%/}"
case "$user_temp" in /var/folders/*) ;; *) echo "make-profile: this machine's temp folder is '$user_temp', not under /var/folders. Tell the driver." >&2; exit 1 ;; esac
settings="$(sed -e "s|__NPM_CACHE__|$cache|g" -e "s|__USER_TEMP__|$user_temp|g" "$here/profile/settings.json")"
printf '%s' "$settings" | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' || { echo "make-profile: the settings are not JSON" >&2; exit 1; }

if [ "${1:-}" = "--check" ]; then
  no() { echo "make-profile: $*" >&2; exit 1; }
  [ -f "$profile/settings.json" ] || no "$profile/settings.json is not there. Run make-profile.sh."
  [ "$(cat "$profile/settings.json")" = "$settings" ] || no "$profile/settings.json is not what setup/profile/settings.json says. Run make-profile.sh again."
  # Nothing of an account's own may be in it: instructions, rules, skills, agents, commands, plugins, servers.
  # Claude Code makes folders of its own in a profile (session history, and a plugins folder that may hold only its
  # lists), so what is looked for is what a session would load, not whether a folder exists.
  for file in CLAUDE.md CLAUDE.local.md; do [ -e "$profile/$file" ] && no "$profile/$file is there. A clean profile has no instructions."; done
  for folder in rules skills agents commands workflows output-styles; do
    [ -d "$profile/$folder" ] || continue
    found="$(find "$profile/$folder" -type f ! -name '.DS_Store' ! -path '*/.trash/*' | head -3)"
    [ -z "$found" ] || no "$profile/$folder holds something a session would load: $(echo "$found" | tr '\n' ' '). A clean profile has none. Tell the driver."
  done
  for synced in "$profile/skills/synced" "$profile/plugins/synced"; do
    [ -d "$synced" ] && [ -n "$(ls -A "$synced")" ] && no "$synced holds what the account's sign-in brought with it. Tell the driver."
  done
  # Plugins and servers, as Claude Code itself lists them for this profile. Neither command starts a session.
  claude_bin="$(command -v claude || true)"
  if [ -x "$claude_bin" ]; then
    scratch="$(mktemp -d "${TMPDIR:-/tmp}/make-profile-check.XXXXXX")"
    plugins="$(cd "$scratch" && CLAUDE_CONFIG_DIR="$profile" "$claude_bin" plugin list 2>&1 || true)"
    servers="$(cd "$scratch" && CLAUDE_CONFIG_DIR="$profile" ENABLE_CLAUDEAI_MCP_SERVERS=false "$claude_bin" mcp list 2>&1 || true)"
    rmdir "$scratch" 2>/dev/null || true
    echo "$plugins" | grep -q "No plugins installed" || no "the profile has a plugin: $(echo "$plugins" | head -3 | tr '\n' ' '). Tell the driver."
    echo "$servers" | grep -q "No MCP servers configured" || no "the profile has a connected server: $(echo "$servers" | head -3 | tr '\n' ' '). Tell the driver."
  fi
  [ -d "$profile/no-shell-startup" ] && [ -z "$(ls -A "$profile/no-shell-startup")" ] || no "$profile/no-shell-startup must be there and empty. Run make-profile.sh."
  [ -d "$temp" ] || no "$temp is not there. Run make-profile.sh."
  echo "the profile at $profile is as it should be"
  exit 0
fi
# no-shell-startup stays empty: it is where the session's shell looks for start-up files, so that it finds none.
mkdir -p "$profile/no-shell-startup" "$cache" "$temp"
printf '%s\n' "$settings" >"$profile/settings.json"
echo "the profile:   $profile"
echo "its settings:  $profile/settings.json"
echo "npm's cache:   $cache (empty at first; the only folder outside its own a session's commands may write, with its temp folder)"
echo "its temp:      $temp (the profile's own; the account's temp folders are closed to it)"
