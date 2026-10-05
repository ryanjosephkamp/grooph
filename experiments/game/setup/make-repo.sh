#!/bin/bash
#
# The starting contents of the game's repository (PROTOCOL.md section 2), built in a folder outside grooph's clone
# and committed once. Nothing is pushed: the two commands that would push are printed at the end, for the owner.
#
#   experiments/game/setup/make-repo.sh                    the Claude Code run's repository
#   experiments/game/setup/make-repo.sh --rehearsal        the same contents in a scratch folder, for the rehearsal
#   experiments/game/setup/make-repo.sh --out <folder>     the same contents wherever you say (outside the clone)
#
# What it makes, and nothing else: LICENSE (MIT), SPEC.md byte for byte, the Claude Code package as `grooph export`
# writes it, the event hook as `grooph hooks install` writes it, a .gitignore, a README of three lines. One commit.
#
# It refuses to go on when the spec, the graph or a check differs from the freeze (FROZEN.md), when the folder is
# there already, or when what it built is not, file for file, what was frozen. It never deletes anything.
#
# GROOPH_GAME_HOME moves the default folders (default: ~/grooph-game).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(git -C "$here" rev-parse --show-toplevel)"
# In a worktree the clone is where the shared .git is: nothing may be built inside either.
# --path-format=absolute: in a main clone git answers with a path relative to $here, in a worktree with a whole one.
clone="$(cd "$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)/.." && pwd -P)"
home="${GROOPH_GAME_HOME:-$HOME/grooph-game}"

# The models the owner answered with (ANSWERS.md, 1): the lead, the planner and the critics on Opus 5.5, the builder
# and the wrap-up on Sonnet 5.5. Full names, so that the package does not depend on what an alias means that day.
MODELS="frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5"
REMOTE="https://github.com/ryanjosephkamp/grooph-game-experiment-claude.git"
MANIFEST="$here/starting-contents.claude-code.sha256"

out="$home/grooph-game-experiment-claude"
freeze=0
while [ $# -gt 0 ]; do
  case "$1" in
    --rehearsal) out="$home/rehearsal-claude" ;;
    --out) out="${2:?--out needs a folder}"; shift ;;
    --write-manifest) freeze=1 ;; # the freeze itself: writes what this build made as the manifest every later build must equal
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "make-repo: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
stop() { echo "make-repo: $*" >&2; exit 1; }

# The folder: named whole, outside the clone, and not there yet.
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac
inside_the_clone() {
  for inside in "$root" "$clone"; do
    case "$1/" in "$inside"/*) stop "$1 is inside grooph's clone ($inside). The game's repository is made outside it, so that no session started there can reach the checks." ;; esac
  done
}
inside_the_clone "$out"
parent="$(dirname "$out")"
mkdir -p "$parent"
out="$(cd "$parent" && pwd -P)/$(basename "$out")"
inside_the_clone "$out"
[ -e "$out" ] && stop "$out is there already. This script never writes over anything: move it away, or name another folder with --out."

# The freeze: the spec, the graph and every check are what FROZEN.md says they are.
(cd "$root" && shasum -a 256 -c --quiet experiments/game/setup/frozen.sha256) || stop "the spec, the graph or a check is not what was frozen (experiments/game/FROZEN.md). Nothing was made."
[ -z "$(git -C "$root" status --porcelain -- packages)" ] || stop "packages/ has changes that are not committed, so no commit can be named as the one that compiled the package."
# The compiler's commit is the last one that changed packages/: a commit that only adds a document is not another compiler.
compiler="$(git -C "$root" log -1 --format=%H -- packages)"
frozen="$(sed -n 's/^FROZEN_COMMIT=//p' "$here/frozen.env")"
stamp="$(sed -n 's/^FROZEN_DATE=//p' "$here/frozen.env")"

# The compiler, built from the source that is checked out, so that it is that commit's and not an older build's.
[ -d "$root/node_modules" ] || stop "run 'pnpm install' in $root first."
(cd "$root" && pnpm --silent --filter @grooph/core build >/dev/null && pnpm --silent --filter @grooph/cli build >/dev/null) || stop "the compiler did not build."
grooph() { env -u GROOPH_MODELS node "$root/packages/cli/bin/grooph.js" "$@"; }

mkdir "$out"
cp "$root/LICENSE" "$out/LICENSE"
cp "$root/experiments/game/SPEC.md" "$out/SPEC.md"
grooph export "$root/experiments/game/arena.grooph.json" --target claude-code --into "$out" --models "$MODELS" >/dev/null
grooph hooks install --dir "$out" >/dev/null
# node_modules, as the protocol says; and what the event hook records, which is the record's and not the game's (the
# hook's own installer says to leave it out, and a tree that is never clean misleads a session that asks git).
printf 'node_modules/\n.grooph/events/\n' >"$out/.gitignore"
cat >"$out/README.md" <<'EOF'
# grooph-game-experiment-claude
An experiment of grooph: one browser game, built by one Claude Code session from one loop graph, in up to six hours.
`SPEC.md` is what was asked for, `.claude/` and `.grooph/` are the package it ran from and the hook that records it, and everything else here the session made.
EOF
cmp -s "$root/experiments/game/SPEC.md" "$out/SPEC.md" || stop "SPEC.md was not copied byte for byte."

# What was built against what was frozen, file for file.
built="$(cd "$out" && find . -type f ! -path './.git/*' | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "${f#./}"; done)"
if [ "$freeze" = 1 ]; then
  printf '%s\n' "$built" >"$MANIFEST"
elif [ "$built" != "$(cat "$MANIFEST")" ]; then
  diff <(cat "$MANIFEST") <(printf '%s\n' "$built") >&2 || true
  stop "what was built is not what was frozen ($MANIFEST): the lines above are the difference.
The compiler here is grooph's packages at $compiler; the freeze was compiled at $(sed -n 's/^COMPILED_BY=//p' "$here/frozen.env").
If packages/ has changed since, build from that commit instead:
  git -C \"$clone\" worktree add --detach \"$home/grooph-at-the-freeze\" $(sed -n 's/^COMPILED_BY=//p' "$here/frozen.env")
and run its experiments/game/setup/make-repo.sh. The folder $out was made and is left for you to look at."
fi

# One commit, with the date of the frozen commit and no signature, so that the same contents are the same commit.
# The name and the e-mail are the ones grooph's own commits carry on this machine (the game's repository is public,
# and the address grooph's clone commits with is the one already public there). They are written into the
# repository itself: a session cannot write .git/config.
name="$(git -C "$root" config user.name || true)"; mail="$(git -C "$root" config user.email || true)"
[ -n "$name" ] && [ -n "$mail" ] || stop "git has no user.name or user.email in grooph's clone (git -C $root config user.email)."
git -C "$out" init -q -b main
git -C "$out" config user.name "$name"
git -C "$out" config user.email "$mail"
git -C "$out" add -A
GIT_AUTHOR_DATE="$stamp" GIT_COMMITTER_DATE="$stamp" git -C "$out" -c commit.gpgsign=false commit -q \
  -m "The starting contents: the spec, the package and the hook that records the run" \
  -m "SPEC.md, and the Claude Code package compiled from arena.grooph.json, as grooph's repository had them at $frozen. Compiled by grooph's packages as of $compiler with --models $MODELS. Nothing here was written by a session."

echo "made $out"
echo
git -C "$out" ls-files | sed 's/^/  /'
echo
echo "the tree:    $(git -C "$out" rev-parse 'HEAD^{tree}')"
echo "the commit:  $(git -C "$out" rev-parse HEAD)"
echo "the spec:    $(shasum -a 256 "$out/SPEC.md" | cut -d' ' -f1)"
echo "compiled by: grooph's packages as of $compiler, --models $MODELS"
echo "the kickoff: $out/.grooph/arena/KICKOFF.md"
if [ "$out" = "$home/grooph-game-experiment-claude" ]; then
  echo
  echo "Nothing was pushed. When the owner says so, these two lines put it on GitHub. The second replaces the blank"
  echo "README GitHub made the repository with, so that the first commit holds the starting contents and nothing else:"
  echo
  echo "  git -C \"$out\" remote add origin $REMOTE"
  echo "  git -C \"$out\" push --force -u origin main"
fi
