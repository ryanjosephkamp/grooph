import { g, bar, L, core, errorsOf, tryIt } from "./lib4.mjs";
const [which = "debate-then-build", loopId = "build", critic = "judge"] = process.argv.slice(2);
const src = g(which);
const r = tryIt(src, (w) => { const l = L(w, loopId); l.members.push(critic); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); });
console.log("refused:", r.refused, "errors:", errorsOf(r.doc).length, "warnings:", core.validate(r.doc, { forExport: true }).map((i) => i.code));
const lead = (doc) => {
  const out = core.compile(doc, "claude-code");
  const files = out.files ?? out.package?.files ?? out;
  const list = Array.isArray(files) ? files : Object.entries(files).map(([path, content]) => ({ path, content }));
  const text = list.find((f) => f.path.endsWith("LEAD.md")).content;
  const at = text.indexOf("### Loop `" + loopId + "`");
  return text.slice(at, text.indexOf("\n### ", at + 5) > 0 ? text.indexOf("\n### ", at + 5) : at + 2500);
};
console.log("=== BEFORE\n" + lead(src) + "\n=== AFTER\n" + lead(r.doc));
