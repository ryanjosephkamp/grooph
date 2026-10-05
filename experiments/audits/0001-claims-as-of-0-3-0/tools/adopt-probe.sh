#!/usr/bin/env bash
# Audit 0001, claim C45 and finding F6: does adopting a run's working copy refuse a loosened brake?
# Copies one kept record into a scratch folder, raises its round cap and its budget in the working copy,
# and runs `grooph adopt`. Reads the repository it is run from (its built CLI). Calls no model.
#
#   cd <repository or snapshot root> && bash <this file> [scratch folder]
set -uo pipefail
REPO="$(pwd -P)"
W="${1:-$(mktemp -d "${TMPDIR:-/tmp}/grooph-audit-adopt.XXXXXX")}"
g() { node "$REPO/packages/cli/bin/grooph.js" "$@"; }
gid=parse-duration
mkdir -p "$W/.grooph/$gid/runs"
cp "$REPO/experiments/patterns/heterogeneous-critic/run/package/graph.grooph.json" "$W/.grooph/$gid/graph.grooph.json"
cp -R "$REPO/experiments/patterns/heterogeneous-critic/run/runs/"* "$W/.grooph/$gid/runs/"
run="$(ls "$W/.grooph/$gid/runs" | head -1)"
node -e '
const fs = require("fs"); const p = process.argv[1]; const d = JSON.parse(fs.readFileSync(p, "utf8"));
console.log("the working copy as the run left it:", JSON.stringify(d.loops[0].stops));
for (const s of d.loops[0].stops) { if (s.kind === "max-iterations") s.n = 40; if (s.kind === "budget") s.limit = 400; }
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log("loosened for the probe:             ", JSON.stringify(d.loops[0].stops));' "$W/.grooph/$gid/runs/$run/graph.grooph.json"
cd "$W"
echo "== grooph adopt (shows the change)"; g adopt ".grooph/$gid/runs/$run"; echo "   exit $?"
echo "== grooph adopt --write"; g adopt ".grooph/$gid/runs/$run" --write --into "$W/adopted.grooph.json"; echo "   exit $?"
[ -f "$W/adopted.grooph.json" ] && node -e 'const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log("adopted as version", d.version, "with stops", JSON.stringify(d.loops[0].stops));' "$W/adopted.grooph.json"
echo "the probe's files are in $W"
