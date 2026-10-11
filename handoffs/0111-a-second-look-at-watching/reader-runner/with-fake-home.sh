#!/bin/sh
# The reader's wrapper (slice 0111, a fresh read of the runner). Every script in this folder is run through it:
#
#   sh handoffs/0111-a-second-look-at-watching/reader-runner/with-fake-home.sh <script.mjs> [args]
#
# It starts node with an environment of its own making, so that nothing a script tries can reach the owner's places
# or start a harness:
#   HOME    a folder made under a temp directory, standing in for the owner's home (so os.homedir(), DEFAULT_HOME,
#           theOwnersOwn() and whatever a tool falls back to are all inside it)
#   TMPDIR  another folder under the same temp directory
#   PATH    a private folder holding a link to node and nothing else, then the system's own folders: no `claude`,
#           no `codex`, no `grooph` is on it, so findHarness() finds nothing and nothing can start one by name
# READER_TMP names the temp directory to use; without it one is made with mktemp.
# READER_ROOT names the checkout the scripts read the runner from; without it, it is the one this folder is in. The
# reader pinned it to a copy of one commit (git archive <commit> scripts experiments docs/comparisons.md | tar -x -C
# <a temp folder>, with packages/ linked in from the built checkout), because the branch was being changed as it was read.
set -eu
top="${READER_TMP:-$(mktemp -d)}/reader-runner"
mkdir -p "$top/owner" "$top/tmp" "$top/bin"
ln -sf "$(command -v node)" "$top/bin/node"
exec env -i HOME="$top/owner" TMPDIR="$top/tmp" READER_TOP="$top" READER_ROOT="${READER_ROOT:-}" PATH="$top/bin:/usr/bin:/bin:/usr/sbin:/sbin" "$top/bin/node" "$@"
