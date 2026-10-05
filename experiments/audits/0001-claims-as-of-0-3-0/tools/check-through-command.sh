#!/usr/bin/env bash
# Audit 0001, round two, part E: the two check cases of check-verdict-probe.mjs, through the grooph adopt command itself,
# on the kept proving record of grind-loop. Copies the record into a scratch folder, changes the working copy there, and
# runs grooph adopt --write into that folder. Reads the repository it is run from (its built CLI). Calls no model.
#
#   cd <repository root, packages built> && bash <this file> [scratch folder]
set -uo pipefail
REPO="$(pwd -P)"
W="${1:-$(mktemp -d "${TMPDIR:-/tmp}/grooph-audit-check.XXXXXX")}"
g() { node "$REPO/packages/cli/bin/grooph.js" "$@"; }
for case in always-passes verdicts-swapped; do
  D="$W/$case"; rm -rf "$D"; mkdir -p "$D/.grooph/g/runs"
  cp "$REPO/experiments/patterns/grind-loop/run/package/graph.grooph.json" "$D/.grooph/g/graph.grooph.json"
  cp -R "$REPO/experiments/patterns/grind-loop/run/runs/"* "$D/.grooph/g/runs/"
  run="$(ls "$D/.grooph/g/runs" | head -1)"
  node -e '
const fs=require("fs");const p=process.argv[1],c=process.argv[2];const d=JSON.parse(fs.readFileSync(p,"utf8"));
const isCheck=(id)=>d.nodes.find(n=>n.id===id)?.kind==="check";
if(c==="always-passes"){for(const n of d.nodes)if(n.kind==="check"){console.log("  the check was:",JSON.stringify(n.check));n.check={...n.check,run:"true",pass:"exit code 0"};console.log("  the check is now:",JSON.stringify(n.check));}}
else{for(const e of d.edges)if(isCheck(e.from)){const was=e.when;e.when=was==="pass"?"fail":was==="fail"?"pass":was;console.log("  edge",e.id,e.from,"->",e.to,"when",was,"=>",e.when);}}
fs.writeFileSync(p,JSON.stringify(d,null,2));' "$D/.grooph/g/runs/$run/graph.grooph.json" "$case"
  echo "== $case: grooph adopt --write"
  (cd "$D" && g adopt ".grooph/g/runs/$run" --write --into "$D/adopted.grooph.json"; echo "   exit $?")
  [ -f "$D/adopted.grooph.json" ] && echo "   written: adopted.grooph.json, version $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version)' "$D/adopted.grooph.json")" || echo "   nothing written"
done
