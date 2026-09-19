#!/usr/bin/env bash
# Exercise scripts/install-local.sh against a throwaway HOME, never the real one:
# install, run again (idempotent), refuse to replace what is not grooph's, dry run,
# uninstall. Needs a built CLI. Run from anywhere; CI runs it after the build.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP_ROOT="${TMPDIR:-/tmp}"
SCRATCH="$(mktemp -d "${TMP_ROOT%/}/grooph-install-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT

REAL_HOME="$HOME"
export HOME="$SCRATCH/home"
mkdir -p "$HOME"
[[ "$HOME" != "$REAL_HOME" ]] || { echo "refusing: HOME is the real home" >&2; exit 1; }

INSTALL="$REPO/scripts/install-local.sh"
BIN="$HOME/.local/bin"
fail() { echo "FAIL: $*" >&2; exit 1; }
step() { echo; echo "── $*"; }

step "dry run touches nothing"
out="$("$INSTALL" --dry-run)"
echo "$out"
grep -q "link       $BIN/grooph -> $REPO/packages/cli/bin/grooph.js" <<<"$out" || fail "dry run does not list the CLI link"
grep -q "link       $HOME/.claude/skills/grooph-design -> $REPO/plugins/grooph/skills/grooph-design" <<<"$out" || fail "dry run does not list the skill link"
grep -q "Dry run: nothing was changed." <<<"$out" || fail "dry run did not say so"
[[ -z "$(ls -A "$HOME")" ]] || fail "dry run wrote into HOME"

step "install"
out="$(PATH="$BIN:$PATH" "$INSTALL")"
echo "$out"
[[ "$(readlink "$BIN/grooph")" == "$REPO/packages/cli/bin/grooph.js" ]] || fail "CLI link"
[[ "$(readlink "$HOME/.claude/skills/grooph-design")" == "$REPO/plugins/grooph/skills/grooph-design" ]] || fail "skill link"
[[ -f "$HOME/.claude/skills/grooph-design/SKILL.md" ]] || fail "the skill does not resolve through the link"
grep -q "grooph is on PATH" <<<"$out" || fail "PATH check"
[[ "$("$BIN/grooph" --version)" == "0.0.0" ]] || fail "the linked CLI does not run"
"$BIN/grooph" template list >/dev/null || fail "the linked CLI cannot find its bundled templates"
[[ "$(cd "$HOME" && find . -mindepth 1 | sort | tr '\n' ' ')" == "./.claude ./.claude/skills ./.claude/skills/grooph-design ./.local ./.local/bin ./.local/bin/grooph " ]] ||
  fail "install touched more than the two links and their folders: $(cd "$HOME" && find . -mindepth 1)"

step "install again changes nothing"
out="$(PATH="$BIN:$PATH" "$INSTALL")"
echo "$out"
grep -q "Nothing to do." <<<"$out" || fail "second install was not a no-op"
[[ "$(grep -c "^  unchanged" <<<"$out")" == 2 ]] || fail "second install did not report both links unchanged"

step "without the bin folder on PATH it says what to add, and edits no profile"
out="$(PATH="/usr/bin:/bin:$(dirname "$(command -v node)")" "$INSTALL")"
grep -q "export PATH=\"$BIN:\$PATH\"" <<<"$out" || fail "no PATH advice"
[[ ! -e "$HOME/.zshrc" && ! -e "$HOME/.bashrc" && ! -e "$HOME/.profile" && ! -e "$HOME/.zprofile" ]] || fail "a shell profile was written"

step "uninstall removes only its own links"
out="$("$INSTALL" --uninstall)"
echo "$out"
[[ ! -e "$BIN/grooph" && ! -L "$BIN/grooph" ]] || fail "CLI link left behind"
[[ ! -e "$HOME/.claude/skills/grooph-design" && ! -L "$HOME/.claude/skills/grooph-design" ]] || fail "skill link left behind"
[[ -f "$REPO/plugins/grooph/skills/grooph-design/SKILL.md" ]] || fail "uninstall reached into the clone"
out="$("$INSTALL" --uninstall)"
grep -q "Nothing to do." <<<"$out" || fail "second uninstall was not a no-op"

step "something else in the way is never replaced"
mkdir -p "$BIN" "$HOME/.claude/skills/grooph-design"
echo "#!/bin/sh" >"$BIN/grooph"
echo "mine" >"$HOME/.claude/skills/grooph-design/SKILL.md"
if out="$("$INSTALL" 2>&1)"; then fail "install succeeded over foreign files"; fi
echo "$out"
grep -q "BLOCKED    $BIN/grooph is a file" <<<"$out" || fail "the foreign CLI file was not named"
grep -q "Nothing was changed." <<<"$out" || fail "did not say nothing changed"
[[ "$(cat "$BIN/grooph")" == "#!/bin/sh" && "$(cat "$HOME/.claude/skills/grooph-design/SKILL.md")" == "mine" ]] || fail "a foreign file was changed"
out="$("$INSTALL" --uninstall)"
grep -q "skip       $BIN/grooph is a file" <<<"$out" || fail "uninstall did not skip the foreign file"
[[ -f "$BIN/grooph" ]] || fail "uninstall removed a foreign file"

echo
echo "install-local.sh: all checks passed (HOME was $HOME)"
