#!/bin/bash
# Mutation checks of the tests of the correction of 2026-10-12 (HANDBACK-2.md), each on a copy of the checkout and
# never in it: the runner refuses a run when its own files change under it, and a test run in the checkout would too.
#   bash handoffs/0111-a-second-look-at-watching/mutants-of-the-folder-check.sh <the checkout, built> <an empty scratch folder> [<one of m0 to m11>]
# m0 is the copy unchanged. A copy is no git checkout, so the two tests that need a commit fail in every copy, m0 too
# ("both blocks are run with one hook..." and "the tables are made from the records..."). Each of m1 to m11 makes one
# change and has to fail more than those two:
#   m1  the exception passes for any runner in this checkout          -> "the one correction names both runners"
#   m2  nothing is closed to a watched session                        -> "the three arms of one task" (every argument)
#   m3  the folder check looks at the top alone                       -> both tests of the folder check
#   m4  one more space in a comment of the runner's script            -> "the correction as the repository keeps it"
#   m5  the tables say "the same thing" of any two runners            -> "with the correction the repository keeps"
#   m6  the earlier runner's runs are counted for any runner          -> "the one correction names both runners"
#   m7  a settings file below the top is not taken for an install's   -> both tests of the folder check
#   m8  a checkout that cannot say what it is made with starts a run   -> "a checkout that cannot say what its hook..."
#   m9  the folder check takes a name in its exact case only          -> the test of the folder check, as a function
#   m10 the lab's runner changes two values of the environment        -> "the three arms of one task" (the values)
#   m11 the session is given twice the minutes                        -> "the three arms of one task" (the limits)
# Any change to the runner's script also fails the two tests of the kept correction: that is m4, and it is on purpose.
# m10 changes one of the runner's five other files instead: there the kept correction no longer names this checkout's
# runner, one test says so and skips, and the test of the three arms is what fails. (m8 to m11 are a second reader's.)
set -u
W="$1"; S="$2"
snapshot() {
  rm -rf "$S/$1"; mkdir -p "$S/$1"
  for d in experiments handoffs scripts; do rsync -a --exclude node_modules "$W/$d" "$S/$1/"; done
  ln -s "$W/node_modules" "$S/$1/node_modules"; ln -s "$W/packages" "$S/$1/packages"
}
mutate() { # name file old new
  python3 - "$S/$1/$2" "$3" "$4" <<'EOF' || touch "$S/$1/the-change-was-not-made"
import sys
p, old, new = sys.argv[1:4]
s = open(p, encoding="utf8").read()
assert s.count(old) == 1, (old, s.count(old))
open(p, "w", encoding="utf8").write(s.replace(old, new))
EOF
}
run() {
  if [ -e "$S/$1/the-change-was-not-made" ]; then echo "== $1: NOT RUN: the change could not be made (the line it changes is no longer there)"; return; fi
  (cd "$S/$1" && node --test scripts/lib/watching-second-look-paid.test.mjs > "$S/$1-out.txt" 2>&1)
  echo "== $1: $(grep -E '^ℹ (pass|fail|skipped)' "$S/$1-out.txt" | tr '\n' ' ')"
  grep -E '^✖ ' "$S/$1-out.txt" | sort -u | cut -c1-170
}
R=scripts/lib/watching-second-look-paid.mjs
only="${3:-}"
if [ -n "$only" ]; then eval "$(grep "^snapshot $only;" "$0")"; echo done; exit 0; fi
snapshot m0; run m0
snapshot m1; mutate m1 $R ' && was[key] === correction.the_earlier_runner && now[key] === correction.the_corrected_runner;' ' && was[key] === correction.the_earlier_runner;'; run m1
snapshot m2; mutate m2 $R 'usd: watchdog.usd, minutes: watchdog.minutes, closed: built.closed, unpinned' 'usd: watchdog.usd, minutes: watchdog.minutes, closed: [], unpinned'; run m2
snapshot m3; mutate m3 $R 'if (looked <= FOLDERS_LOOKED_IN) lookIn(join(dir, name), path);' 'if (looked < 0) lookIn(join(dir, name), path);'; run m3
snapshot m4; mutate m4 $R '/** How many folders of a session'"'"'s are looked in before the looking stops and says so. */' '/** How many folders of a session'"'"'s are looked in before the looking stops and says so.  */'; run m4
snapshot m5; mutate m5 experiments/watching/second-look/tables.mjs 'correction && runners.size === 2 && runners.has(correction.the_earlier_runner) && runners.has(correction.the_corrected_runner) ?' 'correction && runners.size === 2 ?'; run m5
snapshot m6; mutate m6 $R '  if (correction === null || now.runner_sha256 !== correction.the_corrected_runner) return null;' '  if (correction === null) return null;'; run m6
snapshot m7; mutate m7 $R 'if (SETTINGS_OF_AN_INSTALL.some((one) => is(name, one))) found.of_an_install.push(path);' 'if (SETTINGS_OF_AN_INSTALL.some((one) => is(name, one)) && from === ".claude") found.of_an_install.push(path);'; run m7
snapshot m8; mutate m8 $R '  if (untold.length > 0) throw new NotStarted(' '  if (untold.length > 99) throw new NotStarted('; run m8
snapshot m9; mutate m9 $R '  const is = (name, lower) => name.toLowerCase() === lower;' '  const is = (name, lower) => name === lower;'; run m9
snapshot m10; mutate m10 scripts/lib/study-three-paid.mjs '  const child = await runBounded({ program: command.argv[0], args: command.argv.slice(1), cwd, env: command.env, outPath' '  const child = await runBounded({ program: command.argv[0], args: command.argv.slice(1), cwd, env: { ...command.env, TERM: "xterm", LANG: "C" }, outPath'; run m10
snapshot m11; mutate m11 $R 'usd: watchdog.usd, minutes: watchdog.minutes, closed: built.closed, unpinned' 'usd: watchdog.usd, minutes: watchdog.minutes * 2, closed: built.closed, unpinned'; run m11
echo done
