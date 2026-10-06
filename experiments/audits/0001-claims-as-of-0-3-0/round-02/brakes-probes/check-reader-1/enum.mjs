// Exhaustive small changes to the edges that leave a check (changed, added, removed), alone and in pairs of fields,
// on every built-in template and valid fixture that has a check. Counts what is adopted with nothing refused, and
// asks an oracle of my own whether the check's pass matters less afterwards.
import { pool, tryIt, loosened, whenOf } from "./lib3.mjs";
const WHENS = [undefined, "pass", "fail", { verdict: "flaky" }];
const stats = { tried: 0, valid: 0, through: 0, holesNoPerson: 0, holesPerson: 0 };
const seen = new Map();
const note = (kind, file, c, label, r, why) => {
  const key = `${kind} | ${why.join("; ").replace(/"[^"]*"/g, "X").replace(/ at \S+| reaches \S+/g, "")} | ${label.replace(/\b[a-z0-9-]+(?=[ ,)]|$)/g, "·")}`;
  if (!seen.has(kind)) seen.set(kind, []);
  seen.get(kind).push({ file, c, label, why, changes: r.changes, tight: r.tight });
};
const newTargets = (w) => ({
  "NEW success stop": () => { w.nodes.push({ id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); return "zz-done"; },
  "NEW agent then NEW success stop": () => { w.nodes.push({ id: "zz-ship", kind: "agent", name: "Ship", role: "builder", brief: "Ship it.", outputs: ["SHIPPED.md"], allow: ["read-files", "write-outputs"] }, { id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "zz-e-ship-done", from: "zz-ship", to: "zz-done" }); return "zz-ship"; },
});
for (const { file, doc } of pool()) {
  for (const check of doc.nodes.filter((n) => n.kind === "check")) {
    const c = check.id;
    const targets = [...doc.nodes.map((n) => n.id).filter((id) => id !== c), "NEW success stop", "NEW agent then NEW success stop"];
    const run = (label, change) => {
      stats.tried += 1;
      const r = tryIt(doc, change);
      if (!r || !r.ok) return;
      stats.valid += 1;
      if (r.names.length > 0) return;
      stats.through += 1;
      const noPerson = loosened(doc, r.doc, c, false);
      const person = loosened(doc, r.doc, c, true);
      if (noPerson.length) { stats.holesNoPerson += 1; note("HOLE (no person)", file, c, label, r, noPerson); }
      else if (person.length) { stats.holesPerson += 1; note("LOOSER (a person approves)", file, c, label, r, person); }
      else note("through, oracle silent", file, c, label, r, []);
    };
    const target = (w, t) => (newTargets(w)[t] ? newTargets(w)[t]() : t);
    // 1. each edge that leaves it: to, when, approval, evidence, alone and together
    for (const edge of doc.edges.filter((e) => e.from === c)) {
      run(`remove ${edge.id}`, (w) => { w.edges = w.edges.filter((e) => e.id !== edge.id); for (const l of w.loops) l.back = l.back.filter((b) => b !== edge.id); w.loops = w.loops.filter((l) => l.back.length); });
      for (const t of [undefined, ...targets]) for (const when of [null, ...WHENS]) for (const approval of [false, true]) for (const evidence of [false, true]) {
        if (t === undefined && when === null && !approval && !evidence) continue;
        if (when !== null && JSON.stringify(when) === JSON.stringify(edge.when)) continue;
        if (t === edge.to) continue;
        run(`${edge.id} (${whenOf(edge)} to ${edge.to}):${t ? ` to=${t}` : ""}${when !== null ? ` when=${JSON.stringify(when) ?? "always"}` : ""}${approval ? " approval" : ""}${evidence ? " +evidence" : ""}`, (w) => {
          const e = w.edges.find((x) => x.id === edge.id);
          if (approval && e.approval) return false;
          if (t) e.to = target(w, t);
          if (when !== null) { if (when === undefined) delete e.when; else e.when = when; }
          if (approval) e.approval = true;
          if (evidence) e.evidence = [...(e.evidence ?? []), "the full log"];
        });
      }
    }
    // 2. an edge added there
    for (const t of targets) for (const when of WHENS) for (const approval of [false, true]) for (const evidence of [false, true]) {
      run(`add edge ${c} -> ${t} when=${JSON.stringify(when) ?? "always"}${approval ? " approval" : ""}${evidence ? " +evidence" : ""}`, (w) => {
        w.edges.push({ id: "zz-e-new", from: c, to: target(w, t), ...(when === undefined ? {} : { when }), ...(approval ? { approval: true } : {}), ...(evidence ? { evidence: ["the full log"] } : {}) });
      });
    }
  }
}
console.log(JSON.stringify(stats));
for (const [kind, list] of seen) {
  console.log(`\n== ${kind}: ${list.length}`);
  const groups = new Map();
  for (const item of list) { const k = item.label.replace(/^(\S+) \(/, "E (").replace(/to=(?!NEW)\S+/, "to=KNOWN").replace(/-> (?!NEW)\S+/, "-> KNOWN").replace(/^E \((\w+) to \S+\)/, "E ($1)").replace(/^add edge \S+/, "add edge C").replace(/^remove \S+/, "remove E"); (groups.get(k) ?? groups.set(k, []).get(k)).push(item); }
  for (const [k, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const x = items[0];
    console.log(`  ${String(items.length).padStart(4)}  ${k}\n        e.g. ${x.file} ${x.c}: ${x.label}${x.why.length ? `\n        => ${x.why.join("; ")}` : ""}${x.tight.length ? `\n        tightens: ${x.tight.join(" | ").slice(0, 300)}` : ""}`);
  }
}
