#!/usr/bin/env bash
# The driver's merge, as decision 0023 words it: wait for every check on the pull request's head, merge with a
# merge commit only when all of them passed, then wait for CI on main at the merge commit.
#
#   scripts/driver/merge-when-green.sh <pull request number> [<the head commit you read>]
#
# Give it the head you read. It merges that commit and no other: a commit pushed after you read is refused, here
# and by GitHub (`--match-head-commit`). Without it, the head is taken when the script starts.
#
# It exits non-zero, having merged nothing, when the head is not the one named, a check did not pass, the checks
# have not finished after the wait (GROOPH_MERGE_WAIT seconds, 1800 by default), or the pull request cannot be
# merged. `main` has no branch protection: this script is the only gate, so it refuses when in doubt.
# It does not read the pull request. Someone other than its author does that first, and reads each job's log, not
# only its color.
set -u
n=${1:?usage: merge-when-green.sh <pull request number> [<head commit>]}
R=$(gh repo view --json nameWithOwner --jq .nameWithOwner) || exit 1
WAIT=${GROOPH_MERGE_WAIT:-1800}
case "$WAIT" in '' | *[!0-9]*) echo "GROOPH_MERGE_WAIT must be a number of seconds"; exit 1 ;; esac

head=$(gh pr view "$n" -R "$R" --json headRefOid --jq .headRefOid) || exit 1
case "$head" in
  ????????????????????????????????????????) ;;
  *) echo "#$n: could not read its head commit. Nothing merged."; exit 1 ;;
esac
if [ $# -ge 2 ] && [ ${#2} -lt 7 ]; then
  echo "#$n: name the head you read by at least seven characters. Nothing merged."; exit 8
fi
read_head=${2:-$head}
case "$head" in
  "$read_head"*) ;;
  *) echo "#$n: its head is $head, not the $read_head you read. Read it again. Nothing merged."; exit 8 ;;
esac

# Green is: every check on this head passed or was skipped, a job of the pull request's own CI run passed, and
# the list read the same way twice in a row. A head that was just pushed lists its jobs one at a
# time, and the branch's push run can be listed before the pull request's run exists; one reading of "all passed"
# can be a reading of half the list. gh lists the checks of the current head only, and reports a state it does not
# know as pending.
deadline=$(( $(date +%s) + WAIT ))
last=""
while :; do
  now=$(gh pr checks "$n" -R "$R" --json name,bucket,event,workflow --jq '[.[] | .event + ":" + .workflow + "/" + .name + "=" + .bucket] | sort | join(",")' 2>/dev/null)
  case ",$now," in
    *=fail,* | *=cancel,*) echo "#$n: a check did not pass ($now). Nothing merged."; exit 5 ;;
  esac
  ready=no
  if [ -n "$now" ] && ! printf '%s' ",$now," | grep -q "=pending,"; then
    printf '%s' ",$now," | grep -Eq ',pull_request:CI/[^=,]*=pass,' && ready=yes
  fi
  if [ "$ready" = yes ]; then
    [ "$now" = "$last" ] && break
    last=$now
  else
    last=""
  fi
  [ "$(date +%s)" -ge "$deadline" ] && { echo "#$n: checks not finished after ${WAIT} s ($now). Nothing merged."; exit 7; }
  sleep 20
done
echo "#$n checks at ${head}: $now"

state=$(gh pr view "$n" -R "$R" --json state --jq .state)
if [ "$state" = "MERGED" ]; then
  echo "#$n is already merged"
else
  m=""
  for _ in 1 2 3 4 5 6; do
    m=$(gh pr view "$n" -R "$R" --json mergeable --jq .mergeable)
    [ "$m" = "UNKNOWN" ] || break
    sleep 10
  done
  [ "$m" = "MERGEABLE" ] || { echo "#$n cannot be merged: $m. Nothing merged."; exit 6; }
  echo "== merging #$n at $head ($(date +%H:%M:%S))"
  gh pr merge "$n" -R "$R" --merge --match-head-commit "$head" || { echo "#$n: the merge was refused"; exit 2; }
fi

sha=$(gh pr view "$n" -R "$R" --json mergeCommit --jq .mergeCommit.oid)
case "$sha" in
  ????????????????????????????????????????) ;;
  *) echo "#$n: no merge commit to watch (\"$sha\"). Look at main yourself."; exit 3 ;;
esac
echo "#$n merge commit $sha"
id=""
for _ in $(seq 1 30); do
  id=$(gh run list -R "$R" --workflow ci.yml --branch main --commit "$sha" --json databaseId --jq '.[0].databaseId' 2>/dev/null)
  [ -n "$id" ] && break
  sleep 5
done
[ -n "$id" ] || { echo "#$n: no CI run found on main at $sha"; exit 3; }
deadline=$(( $(date +%s) + WAIT ))
while :; do
  run=$(gh run view "$id" -R "$R" --json status,conclusion --jq '.status + ":" + (.conclusion // "")' 2>/dev/null)
  case "$run" in completed:*) break ;; esac
  [ "$(date +%s)" -ge "$deadline" ] && { echo "#$n: CI on main still \"$run\" after ${WAIT} s (run $id). Look at it yourself."; exit 4; }
  sleep 15
done
echo "#$n CI on main: $run (run $id)"
[ "$run" = "completed:success" ] || { echo "CI on main is not green after #$n"; exit 4; }
echo "#$n merged, main green ($(date +%H:%M:%S))"
