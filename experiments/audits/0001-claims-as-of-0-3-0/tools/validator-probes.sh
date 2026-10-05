#!/usr/bin/env bash
# Audit 0001, claims C20 to C22: what the validator refuses, and what it only warns about.
# Reads the repository it is run from (its built CLI) and writes five small graph documents
# into the folder given as its one argument (default: a fresh temporary folder). Calls no model.
#
#   cd <repository or snapshot root> && bash <this file> [output folder]
set -uo pipefail
REPO="$(pwd -P)"
OUT="${1:-$(mktemp -d "${TMPDIR:-/tmp}/grooph-audit-probes.XXXXXX")}"
mkdir -p "$OUT"
g() { node "$REPO/packages/cli/bin/grooph.js" "$@"; }
[[ -f "$REPO/packages/cli/dist/src/index.js" ]] || { echo "the CLI is not built: run pnpm -r build" >&2; exit 2; }
cd "$OUT"

g template use review-gate --name "Add slugify, reviewed" \
  --set "task=Add a slugify(text) function to src/strings.ts." \
  --set "checklist=docs/REVIEW-CHECKLIST.md" --set "test-command=npm test" \
  --out base.grooph.json >/dev/null

node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("base.grooph.json", "utf8"));
const write = (name, doc) => fs.writeFileSync(name + ".grooph.json", JSON.stringify(doc, null, 2) + "\n");
// P2: the loop keeps one stop, "the bar passed": no round cap, no budget.
const p2 = structuredClone(d); p2.loops[0].stops = [{ kind: "bar-passed" }]; write("p2-no-cap", p2);
// P3: no critic-isolation policy, and the critic is handed the builder context.
const p3 = structuredClone(d); p3.policies = []; for (const e of p3.edges) if (e.to === "critic") e.isolation = "shared"; write("p3-shared-no-policy", p3);
// P4: the same shared edge with the policy left in (the control for P3).
const p4 = structuredClone(d); for (const e of p4.edges) if (e.to === "critic") e.isolation = "shared"; write("p4-shared-with-policy", p4);
// P5: the builder is told to merge and publish, nothing is marked irreversible, and the human gate is gone.
const p5 = structuredClone(d);
const gate = p5.nodes.find((n) => n.kind === "human-gate").id;
p5.nodes = p5.nodes.filter((n) => n.id !== gate);
for (const e of p5.edges) { if (e.to === gate) e.to = "done"; }
p5.edges = p5.edges.filter((e) => e.from !== gate);
for (const l of p5.loops) { l.members = l.members.filter((m) => m !== gate); l.back = l.back.filter((b) => p5.edges.some((e) => e.id === b)); }
const builder = p5.nodes.find((n) => n.id === "builder"); builder.brief = (builder.brief ?? "") + " When the critic passes, merge the branch to main and publish the package.";
write("p5-unmarked-merge", p5);
// P6: the same, with the builder marked irreversible (the control for P5).
const p6 = structuredClone(p5); p6.nodes.find((n) => n.id === "builder").irreversible = ["merge", "publish"]; write("p6-marked-merge", p6);
'

for f in base p2-no-cap p3-shared-no-policy p4-shared-with-policy p5-unmarked-merge p6-marked-merge; do
  echo "== $f"
  g validate --for-export "$f.grooph.json"; echo "   exit $?"
done
echo "== export of p2-no-cap (a loop with no cap and no budget)"
mkdir -p export-p2 && g export p2-no-cap.grooph.json --target claude-code --into export-p2 >/dev/null 2>&1; echo "   exit $?; LEAD.md written: $([[ -n "$(find export-p2 -name LEAD.md)" ]] && echo yes || echo no)"
echo "wrote the probe documents to $OUT"
