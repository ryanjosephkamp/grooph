import { readdirSync } from "node:fs";
import { join } from "node:path";
import { root, pattern } from "../refresh-reader-2/h2.mjs";
import { reachedWithout, decisionsShared, decisionName } from "../../../../../../packages/core/dist/src/reach.js";
// For each built-in pattern: the nodes that edges alone put behind a decision, and that reach.ts counts as reached
// without it because a loop's stop leads on (`then`) from every member.
for (const file of readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".grooph.json"))) {
  const doc = pattern(file.replace(".grooph.json", ""));
  if (!doc.loops.some((l) => l.stops.some((s) => s.then !== undefined))) continue;
  const bare = structuredClone(doc);
  for (const l of bare.loops) l.stops = l.stops.map(({ then, ...rest }) => rest);
  for (const closed of decisionsShared(doc, doc)) {
    const model = reachedWithout(doc, closed);
    const edgesOnly = reachedWithout(bare, closed);
    const hidden = doc.nodes.filter((n) => model.has(n.id) && !edgesOnly.has(n.id)).map((n) => n.id);
    if (hidden.length) console.log(`${doc.id}: without ${decisionName(closed)}: counted as reached only through a stop's "then": ${hidden.join(", ")}`);
  }
  console.log(`${doc.id}: lead-on stops:`, JSON.stringify(doc.loops.flatMap((l) => l.stops.filter((s) => s.then).map((s) => ({ loop: l.id, ...s })))));
}
