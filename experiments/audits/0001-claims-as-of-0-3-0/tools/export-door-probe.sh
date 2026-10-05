#!/usr/bin/env bash
# Audit 0001, round two, part E: is the comparison of brakes made when a package is exported over one already in place?
# Makes a graph from the built-in review-gate, exports it into a scratch project, then exports a copy with its round
# cap raised over that package, and then puts a run's loosened working copy through grooph adopt and through grooph export. Prints what the
# command prints and the cap the placed package holds each time. Reads the repository it is run from (its built CLI).
# Writes only in the scratch folder. Calls no model.
#
#   cd <repository or snapshot root, packages built> && bash <this file> [scratch folder]
set -uo pipefail
REPO="$(pwd -P)"
W="${1:-$(mktemp -d "${TMPDIR:-/tmp}/grooph-audit-export.XXXXXX")}"
g() { node "$REPO/packages/cli/bin/grooph.js" "$@"; }
cap() { node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("   round cap in "+process.argv[2]+": "+d.loops[0].stops.find((s)=>s.kind==="max-iterations").n+"; version "+d.version)' "$1" "$2"; }
raise() { node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));for(const s of d.loops[0].stops)if(s.kind==="max-iterations")s.n=40;fs.writeFileSync(process.argv[2],JSON.stringify(d,null,2));' "$1" "$2"; }
mkdir -p "$W/project" && cd "$W"
g template use review-gate --name "Probe" --set task="a small change" --set test-command="npm test" --set checklist="docs/REVIEW-CHECKLIST.md" --out graph.grooph.json >/dev/null 2>&1
echo "== 1. export the graph into an empty project"
g export graph.grooph.json --target claude-code --into project | sed -n '1,3p'; echo "   exit ${PIPESTATUS[0]}"
cap project/.grooph/probe/graph.grooph.json "the placed package"
grep -n "max iterations" project/.grooph/probe/LEAD.md | sed 's/^/   LEAD.md:/'
echo
echo "== 2. a copy of the graph with its round cap raised from 4 to 40, exported over the package in place"
raise graph.grooph.json looser.grooph.json
g export looser.grooph.json --target claude-code --into project | sed -n '1,3p'; echo "   exit ${PIPESTATUS[0]}"
cap project/.grooph/probe/graph.grooph.json "the placed package"
grep -n "max iterations" project/.grooph/probe/LEAD.md | sed 's/^/   LEAD.md:/'
echo
echo "== 3. put the first package back; a run's working copy has the cap raised to 40. First through grooph adopt --write:"
g export graph.grooph.json --target claude-code --into project >/dev/null 2>&1
mkdir -p project/.grooph/probe/runs/20261005-000000
raise project/.grooph/probe/graph.grooph.json project/.grooph/probe/runs/20261005-000000/graph.grooph.json
( cd project && g adopt .grooph/probe/runs/20261005-000000 --write 2>&1 | tail -1 | cut -c1-200; echo "   exit ${PIPESTATUS[0]}" )
cap project/.grooph/probe/graph.grooph.json "the placed package"
echo
echo "== 4. the same working copy through grooph export, with no adopt"
( cd project && g export .grooph/probe/runs/20261005-000000/graph.grooph.json --target claude-code --into . | sed -n '1,3p'; echo "   exit ${PIPESTATUS[0]}" )
cap project/.grooph/probe/graph.grooph.json "the placed package"
echo "the probe's files are in $W"
