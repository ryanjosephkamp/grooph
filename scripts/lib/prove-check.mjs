/**
 * The assertions of a pattern proving run (handoff 0009, criterion 4), made on
 * the evidence folder alone, so they can be re-made on any kept run:
 *
 *   1. the expected agents ran as their own subagents (a subagent transcript of
 *      that agent type, a dispatch from the lead, and a note at node:<id>);
 *   2. critics, and any other node the template names, wrote their own reports:
 *      a write by that node's subagent, and none by the lead or another node;
 *   3. the run ended through a stop of the template, its stop node, or a halt at
 *      a gate (and, for a run resumed by script, the first invocation halted at
 *      the gate the answer was for);
 *   4. every amendment note matches a real change in the working copy;
 *   5. no brake was loosened;
 *   6. the source document is untouched;
 *   7. every note conforms to the RunNote schema.
 *
 * Added for the second batch (handoff 0011, criteria 1 and 4), all driven by the
 * template's expect.json where it says so:
 *
 *   8. a loop note's `cost: {measure: "dispatches"}` agrees with the number of
 *      `"outcome":"started"` lines at that loop's members written before it (off
 *      by one is a finding; more than one is a problem), and a loop note's `stop`
 *      is one of the loop's stops (a finding when it is not);
 *   9. `notRun`: agents that must not have run (a gate halted before them);
 *  10. `ownership`: each owner wrote only under its `owns` folders (its own report
 *      files aside), and nobody else wrote there;
 *  11. `ending`: the run ended one of the ways the template expects;
 *  12. `absent`: files the run must not have created (PUBLISHED.txt behind a gate);
 *  13. `proposals.min`, `amendments.max`: what a propose-level run must record;
 *  14. `heldOut.readers` / `heldOut.notReaders`: who touched the held-out evidence
 *      (a critic that never did judged without it; a builder that did saw its cases).
 *
 * Problems fail the check. Findings are reported, not judged: they are what the
 * write-up is made of (what the lead did that the package did not intend, which
 * files a critic read, the permission denials, whether a back edge fired).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readNotes, sha256, writesOf } from "./prove-evidence.mjs";

const byId = (list) => new Map((list ?? []).map((item) => [item.id, item]));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** A small RFC 6902 applier (add, remove, replace, move, copy, test), enough to replay a lead's JSON Patch. */
function applyJsonPatch(doc, patch) {
  const copy = structuredClone(doc);
  const walk = (path) => {
    const parts = path.split("/").slice(1).map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
    const last = parts.pop();
    let parent = copy;
    for (const part of parts) {
      parent = Array.isArray(parent) ? parent[Number(part)] : parent?.[part];
      if (parent === undefined) throw new Error(`no ${path}`);
    }
    return { parent, last };
  };
  const get = (path) => {
    const { parent, last } = walk(path);
    return Array.isArray(parent) ? parent[Number(last)] : parent[last];
  };
  const remove = (path) => {
    const { parent, last } = walk(path);
    if (Array.isArray(parent)) parent.splice(Number(last), 1);
    else delete parent[last];
  };
  const add = (path, value) => {
    const { parent, last } = walk(path);
    if (Array.isArray(parent)) parent.splice(last === "-" ? parent.length : Number(last), 0, value);
    else parent[last] = value;
  };
  for (const op of patch) {
    if (op.op === "add") add(op.path, structuredClone(op.value));
    else if (op.op === "remove") remove(op.path);
    else if (op.op === "replace") {
      const { parent, last } = walk(op.path);
      if (Array.isArray(parent)) parent[Number(last)] = structuredClone(op.value);
      else parent[last] = structuredClone(op.value);
    } else if (op.op === "move") {
      const value = get(op.from);
      remove(op.from);
      add(op.path, value);
    } else if (op.op === "copy") add(op.path, structuredClone(get(op.from)));
    else if (op.op === "test") {
      if (JSON.stringify(get(op.path)) !== JSON.stringify(op.value)) throw new Error(`test failed at ${op.path}`);
    } else throw new Error(`unknown JSON Patch op ${op.op}`);
  }
  return copy;
}

const pattern = (text) => new RegExp(text.replace(/[-\s]/g, "[- ]?"), "i");

/** The text of a file the run wrote, by basename: from the run folder in the evidence, else the added lines of project.diff. */
function reportText(evidenceDir, runDir, name) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.toLowerCase() === name.toLowerCase()) found.push(full);
    }
  };
  if (existsSync(runDir)) walk(runDir);
  if (found.length > 0) return readFileSync(found[0], "utf8");
  const diffPath = join(evidenceDir, "project.diff");
  if (!existsSync(diffPath)) return null;
  const blocks = readFileSync(diffPath, "utf8").split(/^diff --git /m);
  const block = blocks.find((b) => new RegExp(`^\\+\\+\\+ b/(?:.*/)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "mi").test(b));
  if (!block) return null;
  return block
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

export async function checkRun(evidenceDir, { core, template }) {
  const problems = [];
  const findings = [];
  const facts = {};
  const { canonicalize, effectiveAdaptation, isCriticFamily, parseGraph, parseGraphText, validate, applyOps, OP_NAMES } = core;

  const resultPath = join(evidenceDir, "result.json");
  if (!existsSync(resultPath)) return { problems: [`no result.json in ${evidenceDir}: not the evidence folder of a run`], findings, facts };
  const result = readJson(resultPath);
  const expect = existsSync(join(evidenceDir, "expect.json")) ? readJson(join(evidenceDir, "expect.json")) : { agents: [], reports: {} };
  if (template && result.template !== template) problems.push(`result.json is for ${result.template}, not ${template}`);
  const graphId = result.graph_id;

  // ── the run folder ─────────────────────────────────────────────────────
  const runDir = result.run_id ? join(evidenceDir, "runs", result.run_id) : null;
  if (!runDir || !existsSync(runDir)) {
    problems.push(`no run folder${result.run_id ? ` runs/${result.run_id}` : ""} in the evidence: the lead never set the run up`);
    return { problems, findings, facts, result };
  }
  if ((result.run_ids ?? []).length > 1) findings.push(`the lead created ${result.run_ids.length} run folders: ${result.run_ids.join(", ")}; checking ${result.run_id}`);
  // The run id's form: from the clock since slice 0010 (<yyyymmdd-hhmmss>, -2, -3 … on collision); the first batch's <yyyymmdd-hhmm>-<4 chars> was typed by hand.
  const idForm = /^\d{8}-\d{6}(?:-\d+)?$/.test(result.run_id) ? "the clock form" : /^\d{8}-\d{4}-[a-z0-9]{4}$/.test(result.run_id) ? "the earlier random-suffix form" : "neither documented form";
  findings.push(`run id ${result.run_id}: ${idForm}`);
  for (const file of ["PROGRESS.md", "notes.jsonl", "graph.grooph.json"]) {
    if (!existsSync(join(runDir, file))) problems.push(`missing runs/${result.run_id}/${file}`);
  }

  // ── source and working copy ────────────────────────────────────────────
  const sourcePath = join(evidenceDir, "package", "graph.grooph.json");
  const source = parseGraphText(readFileSync(sourcePath, "utf8")).doc;
  if (!source) problems.push("the source document in package/ does not parse");
  if (sha256(sourcePath) !== result.source_sha256_before) problems.push("the source document changed during the run (its hash differs from the one taken before the run)");

  let working;
  const workingPath = join(runDir, "graph.grooph.json");
  if (existsSync(workingPath)) {
    const loaded = parseGraphText(readFileSync(workingPath, "utf8"));
    if (!loaded.doc) problems.push(`the working copy does not match the schema: ${loaded.issues.map((i) => i.message).join("; ")}`);
    else {
      working = loaded.doc;
      const errors = validate(working, { forExport: true }).filter((issue) => issue.severity === "error");
      if (errors.length > 0) problems.push(`the working copy does not validate: ${errors.map((i) => i.code).join(", ")}`);
    }
  }
  const graph = working ?? source;

  // ── 7. notes conform to the RunNote schema ─────────────────────────────
  const { notes: rawNotes, broken } = readNotes(join(runDir, "notes.jsonl"));
  if (broken > 0) problems.push(`${broken} line(s) of notes.jsonl are not JSON`);
  const notes = rawNotes.filter(Boolean);
  if (notes.length === 0) problems.push("notes.jsonl holds no note");
  if (source && notes.length > 0) {
    const parsed = parseGraph({ ...structuredClone(source), notes });
    for (const issue of parsed.issues.filter((i) => i.code === "E_SCHEMA")) problems.push(`note schema: ${issue.message}`);
  }
  const KNOWN = new Set(["id", "run", "at", "started", "ended", "outcome", "verdict", "round", "stop", "evidence", "cost", "gaps", "proposal", "amendment", "text"]);
  const unknownKeys = [...new Set(notes.flatMap((note) => Object.keys(note).filter((key) => !KNOWN.has(key))))];
  if (unknownKeys.length > 0) findings.push(`notes carry keys outside the RunNote shape (accepted, preserved): ${unknownKeys.join(", ")}`);
  const ids = notes.map((note) => note.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) problems.push(`note ids repeat: ${[...new Set(dupes)].join(", ")}`);
  const otherRuns = [...new Set(notes.map((note) => note.run).filter((run) => run !== result.run_id))];
  if (otherRuns.length > 0) problems.push(`notes name other run ids: ${otherRuns.join(", ")}`);
  const known = { node: byId(graph?.nodes), edge: byId(graph?.edges), loop: byId(graph?.loops) };
  for (const note of notes) {
    const [kind, id] = String(note.at).split(":");
    if (id && known[kind] && !known[kind].has(id) && !byId(source?.[`${kind}s`]).has(id)) problems.push(`note ${note.id} is at ${note.at}, which is not in the graph`);
  }

  // ── 1. expected agents ran as their own subagents ──────────────────────
  const digestPath = join(evidenceDir, "transcript-digest.json");
  const digest = existsSync(digestPath) ? readJson(digestPath) : [];
  if (digest.length === 0) problems.push("no transcript digest: who ran and who wrote what is unverified");
  const subagentRuns = new Map();
  for (const entry of digest.filter((e) => e.who !== "lead")) subagentRuns.set(entry.who, (subagentRuns.get(entry.who) ?? 0) + 1);
  const dispatches = digest.filter((e) => e.who === "lead").flatMap((e) => e.tool_uses.filter((u) => u.tool === "Agent" || u.tool === "Task"));
  for (const nodeId of expect.agents ?? []) {
    const agent = `${graphId}--${nodeId}`;
    if (!subagentRuns.has(agent)) problems.push(`${nodeId} never ran as its own subagent (no ${agent} transcript)`);
    if (!dispatches.some((d) => d.subagent_type === agent)) problems.push(`the lead never dispatched ${agent}`);
    if (!notes.some((note) => note.at === `node:${nodeId}`)) problems.push(`no note at node:${nodeId}`);
  }
  // A node the template dispatches per piece or per candidate must have been dispatched at least that often.
  for (const [nodeId, want] of Object.entries(expect.dispatches ?? {})) {
    const agent = `${graphId}--${nodeId}`;
    const count = dispatches.filter((d) => d.subagent_type === agent).length;
    if (typeof want.min === "number" && count < want.min) problems.push(`${nodeId} was dispatched ${count} time(s); the template expects at least ${want.min}`);
    else findings.push(`${nodeId} dispatched ${count} time(s)`);
  }
  const generalDispatches = dispatches.filter((d) => !String(d.subagent_type ?? "").startsWith(`${graphId}--`));
  if (generalDispatches.length > 0) {
    findings.push(`dispatches outside the package's agents: ${generalDispatches.map((d) => `${d.subagent_type ?? "general-purpose"} (${d.description ?? "no description"})`).join("; ")}`);
  }

  // ── 2. reports written by their own node ───────────────────────────────
  const writes = writesOf(digest);
  for (const [nodeId, files] of Object.entries(expect.reports ?? {})) {
    const agent = `${graphId}--${nodeId}`;
    for (const name of files) {
      // A lead may name the report per round (REVIEW-r0.md, REVIEW-round-1.md): same stem, same extension.
      const [stem, ext] = [name.replace(/\.[^.]+$/, ""), name.slice(name.lastIndexOf("."))];
      const sameReport = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[-_.][\\w.-]*)?${ext.replace(".", "\\.")}$`, "i");
      const matching = writes.filter((w) => sameReport.test(w.name));
      if (!matching.some((w) => w.who === agent)) problems.push(`${nodeId} never wrote ${name} itself`);
      const others = [...new Set(matching.filter((w) => w.who !== agent).map((w) => w.who))];
      if (others.length > 0) problems.push(`${name} was also written by ${others.join(", ")}, not only ${nodeId}`);
      findings.push(`${name}: ${matching.map((w) => `${w.who === agent ? nodeId : w.who} ${w.tool} ${w.file}`).join("; ") || "never written"}`);
    }
  }
  const runPrefix = `.grooph/${graphId}/runs/`;
  const leadWritesOutside = writes.filter((w) => w.who === "lead" && !w.file.startsWith(runPrefix));
  if (leadWritesOutside.length > 0) findings.push(`the lead wrote outside the run folder: ${[...new Set(leadWritesOutside.map((w) => w.file))].join(", ")}`);
  for (const entry of digest.filter((e) => e.who !== "lead")) {
    const reads = entry.tool_uses.filter((u) => ["Read", "Glob", "Grep"].includes(u.tool)).map((u) => u.file ?? u.path ?? u.pattern).filter(Boolean);
    const commands = entry.tool_uses.filter((u) => u.tool === "Bash").map((u) => u.command);
    facts[`reads:${entry.who}:${entry.transcript}`] = { reads: [...new Set(reads)], commands };
  }
  // What each critic looked at: the measure of whether it stayed with its evidence or used the repository.
  const criticAgents = new Set((graph?.nodes ?? []).filter(isCriticFamily).map((node) => `${graphId}--${node.id}`));
  for (const entry of digest.filter((e) => criticAgents.has(e.who))) {
    const uses = entry.tool_uses.filter((u) => !u.error);
    const reads = [...new Set(uses.filter((u) => u.tool === "Read").map((u) => u.file))];
    const commands = uses.filter((u) => u.tool === "Bash").map((u) => (u.command.length > 90 ? `${u.command.slice(0, 90)}…` : u.command));
    findings.push(`${entry.who} (${entry.description ?? entry.transcript}) read ${reads.join(", ") || "nothing"}; ran ${commands.map((c) => `\`${c}\``).join(", ") || "nothing"}`);
  }

  // ── 3. the ending ──────────────────────────────────────────────────────
  const stopKinds = [...new Set((graph?.loops ?? []).flatMap((loop) => loop.stops.map((stop) => stop.kind)))];
  const stopNodes = (graph?.nodes ?? []).filter((node) => node.kind === "stop");
  const gates = (graph?.nodes ?? []).filter((node) => node.kind === "human-gate");
  const approvalEdges = (graph?.edges ?? []).filter((edge) => edge.approval === true);
  // A stop counts as fired only where a clause says so: "max-iterations 0/5 not fired" names a stop without firing it.
  // A note's `stop` field (graph-ir §6, written from slice 0010 on) says it outright.
  const firedIn = (note) => {
    if (typeof note?.stop === "string") return stopKinds.includes(note.stop) ? [note.stop] : [];
    const found = [];
    for (const clause of `${note?.text ?? ""}`.split(/[;.\n]/)) {
      if (/\bnot\b|n't\b|\bno\b/i.test(clause)) continue;
      for (const kind of stopKinds) {
        if (!pattern(kind).test(clause)) continue;
        const verb = /\b(fired|fires|firing|hit|reached|exhausted|exceeded|ended|stopped)\b/i.test(clause);
        if (verb || (kind === "bar-passed" && note.outcome === "pass")) found.push(kind);
      }
    }
    return [...new Set(found)];
  };
  const endingOf = (note) => {
    if (!note) return [];
    const text = `${note.outcome ?? ""} ${note.text ?? ""} ${note.verdict ?? ""}`;
    const named = [];
    const halted = note.outcome === "halt" || /\bhalt/i.test(text);
    for (const gate of [...gates, ...approvalEdges]) {
      if (halted && (text.includes(gate.id) || (gate.name && text.toLowerCase().includes(gate.name.toLowerCase())))) named.push(`halt at ${gate.id}`);
    }
    for (const node of stopNodes) {
      // Whole words only: a gate that says "cannot be undone" does not name the stop node "Done".
      const escaped = node.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${node.id}\\b`, "i").test(text) || new RegExp(`\\b${escaped}\\b`, "i").test(text)) named.push(`stop node ${node.id}`);
    }
    for (const kind of firedIn(note)) named.push(`stop ${kind}`);
    return named;
  };
  const last = notes[notes.length - 1];
  const ending = endingOf(last);
  if (last && last.at !== "graph") findings.push(`the final note is at ${last.at}, not at graph`);
  if (ending.length === 0) problems.push(`the final note names no stop, stop node or halt at a gate: ${JSON.stringify(last)}`);
  facts.ending = ending;
  const loopNotes = notes.filter((note) => String(note.at).startsWith("loop:"));
  // The stop that fired, as the notes tell it: the final note, else the last loop pass that names one.
  let fired = firedIn(last);
  for (const note of [...loopNotes].reverse()) {
    if (fired.length > 0) break;
    fired = firedIn(note);
  }
  facts.stop_fired = fired;

  if (expect.resume) {
    const first = result.invocations?.[0];
    const upTo = first?.notes_after ?? 0;
    const halt = rawNotes[upTo - 1];
    const named = endingOf(halt);
    if (!named.includes(`halt at ${expect.resume.gate}`)) problems.push(`the first invocation did not end in a halt at ${expect.resume.gate} (note ${upTo}: ${JSON.stringify(halt)})`);
    if ((result.invocations ?? []).length < 2) problems.push(`the run was to be resumed once with a scripted "${expect.resume.answer}", and was not`);
  }

  // ── 9. agents that must not have run (a gate halted before them) ───────
  for (const nodeId of expect.notRun ?? []) {
    const agent = `${graphId}--${nodeId}`;
    if (subagentRuns.has(agent)) problems.push(`${nodeId} ran as a subagent (${agent}), and the template expects the run to halt before it`);
    if (dispatches.some((d) => d.subagent_type === agent)) problems.push(`the lead dispatched ${agent}, which must not run`);
    if (notes.some((note) => note.at === `node:${nodeId}` && note.outcome && note.outcome !== "halt")) problems.push(`a note at node:${nodeId} records it running`);
  }

  // ── 11. the ending the template expects ────────────────────────────────
  if (Array.isArray(expect.ending) && expect.ending.length > 0) {
    const actual = new Set([...ending, ...fired.map((kind) => `stop ${kind}`)]);
    const hit = expect.ending.filter((want) => actual.has(want));
    if (hit.length === 0) problems.push(`the run ended by ${[...actual].join(", ") || "nothing named"}; the template expects one of: ${expect.ending.join(", ")}`);
    else findings.push(`ending as expected: ${hit.join(", ")}`);
  }

  // ── 4. amendments ⇄ working copy ───────────────────────────────────────
  const amendments = notes.filter((note) => note.amendment);
  const proposals = notes.filter((note) => note.proposal);
  const changed = working !== undefined && source !== undefined && canonicalize(working) !== canonicalize(source);
  if (amendments.length > 0 && working !== undefined && !changed) problems.push(`${amendments.length} amendment note(s), but the working copy equals the source`);
  if (changed && amendments.length === 0) problems.push("the working copy differs from the source, but no amendment note records it");
  if (amendments.length > 0 && working && source) {
    const patches = amendments.map((note) => note.amendment.patch);
    if (patches.every((patch) => Array.isArray(patch) && patch.length > 0)) {
      let replay = source;
      let failed = "";
      for (const [i, patch] of patches.entries()) {
        try {
          if (patch.every((op) => typeof op?.op === "string" && OP_NAMES.includes(op.op))) {
            const applied = applyOps(replay, patch);
            if (!applied.ok) throw new Error(applied.error.message);
            replay = applied.doc;
          } else if (patch.every((op) => typeof op?.path === "string")) {
            replay = applyJsonPatch(replay, patch);
          } else throw new Error("neither a grooph op list nor a JSON Patch");
        } catch (err) {
          failed = `amendment ${amendments[i].id}'s patch does not apply: ${err.message}`;
          break;
        }
      }
      if (failed) problems.push(failed);
      else if (canonicalize(replay) !== canonicalize(working)) problems.push("replaying every amendment's patch on the source does not give the working copy");
      else findings.push("replaying every amendment's patch on the source gives the working copy exactly");
    } else findings.push("some amendments carry no patch; matched against the working copy as a whole only");
  }
  const diffSummary = [];
  if (working && source && changed) {
    const [sn, wn] = [byId(source.nodes), byId(working.nodes)];
    for (const id of wn.keys()) if (!sn.has(id)) diffSummary.push(`node added: ${id}`);
    for (const id of sn.keys()) if (!wn.has(id)) diffSummary.push(`node removed: ${id}`);
    for (const [id, node] of sn) {
      const other = wn.get(id);
      if (!other) continue;
      const keys = [...new Set([...Object.keys(node), ...Object.keys(other)])].filter((key) => JSON.stringify(node[key]) !== JSON.stringify(other[key]));
      if (keys.length > 0) diffSummary.push(`node ${id} changed: ${keys.join(", ")}`);
    }
    const [se, we] = [byId(source.edges), byId(working.edges)];
    for (const id of we.keys()) if (!se.has(id)) diffSummary.push(`edge added: ${id}`);
    for (const id of se.keys()) if (!we.has(id)) diffSummary.push(`edge removed: ${id}`);
    for (const [id, edge] of se) if (we.has(id) && JSON.stringify(edge) !== JSON.stringify(we.get(id))) diffSummary.push(`edge ${id} changed`);
    for (const key of ["loops", "policies", "goal", "constraints", "description", "adaptation"]) {
      if (JSON.stringify(source[key]) !== JSON.stringify(working[key])) diffSummary.push(`${key} changed`);
    }
  }
  facts.working_copy = working === undefined ? "missing" : changed ? diffSummary : "identical to the source";
  facts.amendments = amendments.map((note) => note.amendment.summary);
  facts.proposals = proposals.map((note) => note.proposal.summary);
  // ── 13. what a propose-level run must record ───────────────────────────
  if (typeof expect.proposals?.min === "number" && proposals.length < expect.proposals.min) problems.push(`${proposals.length} proposal note(s); the template expects at least ${expect.proposals.min}`);
  if (typeof expect.amendments?.max === "number" && amendments.length > expect.amendments.max) problems.push(`${amendments.length} amendment note(s); the template allows at most ${expect.amendments.max}`);

  // ── 5. brakes ──────────────────────────────────────────────────────────
  if (working && source) {
    const loosened = (what) => problems.push(`brake loosened: ${what}`);
    const wn = byId(working.nodes);
    const we = byId(working.edges);
    const wl = byId(working.loops);
    for (const node of source.nodes) {
      if (node.kind === "human-gate" && wn.get(node.id)?.kind !== "human-gate") loosened(`human gate ${node.id} removed`);
      for (const action of node.irreversible ?? []) if (!(wn.get(node.id)?.irreversible ?? []).includes(action)) loosened(`irreversible "${action}" on ${node.id} removed`);
    }
    for (const edge of source.edges) {
      if (edge.approval === true && we.get(edge.id)?.approval !== true) loosened(`approval on edge ${edge.id} removed`);
      const target = source.nodes.find((n) => n.id === edge.to);
      if (target && isCriticFamily(target)) {
        const now = we.get(edge.id);
        if ((edge.isolation ?? "fresh") === "fresh" && now && now.isolation === "shared") loosened(`edge ${edge.id} into critic ${edge.to} made shared`);
        if ((edge.evidence ?? []).length > 0 && now && (now.evidence ?? []).length === 0) loosened(`evidence list on edge ${edge.id} into critic ${edge.to} dropped`);
      }
    }
    for (const policy of source.policies ?? []) {
      if (policy.kind === "critic-isolation" && !(working.policies ?? []).some((p) => p.kind === "critic-isolation" && p.scope === policy.scope)) loosened(`critic-isolation policy ${policy.id} removed`);
    }
    for (const loop of source.loops) {
      const now = wl.get(loop.id);
      if (!now) {
        if (loop.stops.some((s) => s.kind === "budget" || s.kind === "max-iterations")) loosened(`loop ${loop.id} and its stops removed`);
        continue;
      }
      for (const stop of loop.stops) {
        if (stop.kind === "budget" && !now.stops.some((s) => s.kind === "budget" && s.measure === stop.measure && s.limit <= stop.limit)) loosened(`budget stop ${stop.limit} ${stop.measure} on ${loop.id} raised or removed`);
        if (stop.kind === "max-iterations" && !now.stops.some((s) => s.kind === "max-iterations" && s.n <= stop.n)) loosened(`max-iterations ${stop.n} on ${loop.id} raised or removed`);
      }
      if (loop.bar?.acceptance && !(now.bar?.acceptance ?? "").includes(loop.bar.acceptance)) loosened(`acceptance of ${loop.id} rewritten: ${JSON.stringify(now.bar?.acceptance ?? null)}`);
    }
    const order = ["fixed", "propose", "adaptive"];
    if (order.indexOf(effectiveAdaptation(working)) > order.indexOf(effectiveAdaptation(source))) loosened(`adaptation level ${effectiveAdaptation(source)} → ${effectiveAdaptation(working)}`);
  }

  // ── 6. the source document, seen from the project diff too ─────────────
  const diffPath = join(evidenceDir, "project.diff");
  if (existsSync(diffPath) && readFileSync(diffPath, "utf8").includes(`b/.grooph/${graphId}/graph.grooph.json`)) problems.push("project.diff shows the source document changed");

  // ── 12. files the run must not have created ────────────────────────────
  const changedFiles = (result.project_files_changed ?? []).map((line) => line.split(" ").slice(1).join(" "));
  for (const name of expect.absent ?? []) {
    if (changedFiles.some((file) => file === name || file.endsWith(`/${name}`))) problems.push(`${name} exists in the project after the run, and the template expects it never to be written`);
    else findings.push(`${name} absent, as expected`);
  }

  // ── 10. ownership: an owner writes only under its owns, and nobody else writes there ──
  const ownership = expect.ownership ?? {};
  const under = (file, prefix) => file === prefix || file.startsWith(`${prefix.replace(/\/$/, "")}/`);
  for (const [nodeId, prefixes] of Object.entries(ownership)) {
    const agent = `${graphId}--${nodeId}`;
    const reportNames = new Set((expect.reports?.[nodeId] ?? []).map((name) => name.toLowerCase()));
    const own = writes.filter((w) => w.who === agent);
    const outside = own.filter((w) => !prefixes.some((prefix) => under(w.file, prefix)) && !reportNames.has(w.name.toLowerCase()) && !w.file.startsWith(runPrefix));
    if (outside.length > 0) problems.push(`${nodeId} wrote outside ${prefixes.join(", ")}: ${[...new Set(outside.map((w) => w.file))].join(", ")}`);
    const intruders = writes.filter((w) => w.who !== agent && prefixes.some((prefix) => under(w.file, prefix)));
    if (intruders.length > 0) problems.push(`${[...new Set(intruders.map((w) => `${w.who === "lead" ? "the lead" : w.who} (${w.file})`))].join(", ")} wrote under ${prefixes.join(", ")}, which ${nodeId} owns`);
    findings.push(`${nodeId} wrote ${own.length} file(s): ${[...new Set(own.map((w) => w.file))].join(", ") || "nothing"}`);
  }

  // ── the judge's pick names one candidate (tournament-then-judge) ───────
  if (expect.pick?.report && Array.isArray(expect.pick.among)) {
    const text = reportText(evidenceDir, runDir, expect.pick.report);
    if (text === null) problems.push(`${expect.pick.report} is not in the evidence, so the pick cannot be read`);
    else {
      const named = expect.pick.among.filter((item) => text.includes(item) || new RegExp(`\\b${item.split("/").pop()}\\b`, "i").test(text.replace(/candidates?[- /]/gi, "")));
      const winnerLine = text.split("\n").find((line) => /\b(winner|pick(ed)?|chosen|choose|finalist to finish)\b/i.test(line) && expect.pick.among.some((item) => line.includes(item) || new RegExp(`\\b${item.split("/").pop()}\\b`).test(line)));
      if (named.length === 0) problems.push(`${expect.pick.report} names none of ${expect.pick.among.join(", ")}`);
      else findings.push(`${expect.pick.report} names ${named.join(", ")}${winnerLine ? `; the pick line: "${winnerLine.trim().slice(0, 120)}"` : "; no line says which won in so many words"}`);
      facts.pick = { named, winner_line: winnerLine?.trim() ?? null };
    }
  }

  // ── 8. the dispatch count, and the stop named on loop notes ────────────
  const loopsById = byId(graph?.loops);
  const memberNodes = (loop) => new Set((loop.members ?? []).map((id) => `node:${id}`));
  const counted = [];
  for (const [i, note] of notes.entries()) {
    if (!String(note.at).startsWith("loop:")) continue;
    const loop = loopsById.get(note.at.slice(5));
    if (!loop) continue;
    if (typeof note.stop === "string" && !loop.stops.some((stop) => stop.kind === note.stop)) findings.push(`note ${note.id} names stop \`${note.stop}\` on ${note.at}, which has only: ${loop.stops.map((s) => s.kind).join(", ")}`);
    if (note.cost?.measure !== "dispatches") continue;
    const members = memberNodes(loop);
    const started = notes.slice(0, i).filter((n) => n.outcome === "started" && members.has(n.at)).length;
    const off = Math.abs(started - note.cost.amount);
    counted.push({ note: note.id, loop: loop.id, round: note.round ?? null, recorded: note.cost.amount, started, off });
    if (off > 1) problems.push(`note ${note.id}: ${note.at} records ${note.cost.amount} dispatches, but ${started} started line(s) at its members precede it`);
  }
  for (const loop of graph?.loops ?? []) {
    if (loop.stops.some((stop) => stop.kind === "budget" && stop.measure === "dispatches") && !counted.some((c) => c.loop === loop.id)) findings.push(`loop ${loop.id} has a dispatches budget, but no loop note records a dispatch count`);
  }
  if (counted.length > 0) {
    const worst = Math.max(...counted.map((c) => c.off));
    findings.push(`dispatch count: ${counted.map((c) => `${c.note} ${c.loop}${c.round === null ? "" : ` r${c.round}`} recorded ${c.recorded}, started lines ${c.started}`).join("; ")}${worst === 0 ? " (exact)" : ` (off by ${worst})`}`);
  }
  facts.dispatch_count = counted;

  // ── back edges: did the loop loop, and what caught ─────────────────────
  const backEdgeIds = new Set((graph?.loops ?? []).flatMap((loop) => loop.back ?? []));
  const laterRounds = notes.filter((note) => String(note.at).startsWith("loop:") && typeof note.round === "number" && note.round > 0);
  const edgeNotes = notes.filter((note) => String(note.at).startsWith("edge:") && backEdgeIds.has(note.at.slice(5)));
  // A back edge counts as named only in a clause that does not deny it ("back edge e-tests-fail not taken" names none).
  const mentioned = [
    ...new Set(
      notes.flatMap((note) =>
        `${note.text ?? ""}`
          .split(/[;.\n]/)
          .filter((clause) => !/\bnot\b|n't\b|\bno\b|\bnever\b/i.test(clause))
          .flatMap((clause) => [...backEdgeIds].filter((id) => new RegExp(`\\b${id}\\b`).test(clause) && /\b(tak\w+|follow\w*|back|rout\w+)\b/i.test(clause))),
      ),
    ),
  ];
  const failVerdicts = notes.filter((note) => String(note.at).startsWith("node:") && (note.outcome === "fail" || /^(fail|rebut|next-phase)$/.test(`${note.verdict ?? ""}`)));
  facts.back_edges = { later_rounds: laterRounds.length, edge_notes: edgeNotes.map((n) => n.at), mentioned, caught_by: [...new Set(failVerdicts.map((n) => `${n.at.slice(5)}${n.verdict ? ` (${n.verdict})` : ""}`))] };
  const backEdgeTaken = laterRounds.length > 0 || edgeNotes.length > 0 || mentioned.length > 0;
  facts.back_edges.taken = backEdgeTaken;
  findings.push(
    backEdgeTaken
      ? `back edge taken: ${[...new Set([...mentioned, ...edgeNotes.map((n) => n.at.slice(5))])].join(", ") || "a later round is recorded"}; ${laterRounds.length} loop note(s) beyond round 0; caught by ${facts.back_edges.caught_by.join(", ") || "no fail verdict recorded"}`
      : `no back edge taken: every loop note is round 0 and no back edge is named${expect.backEdge === true ? " (the task was designed to force one; the write-up must say why it did not)" : ""}`,
  );
  // Verdicts per node, in order: the shape of the loop as the critics and judges told it.
  const verdictsByNode = {};
  for (const note of notes) {
    if (!String(note.at).startsWith("node:") || !(note.verdict || (note.outcome && note.outcome !== "started"))) continue;
    (verdictsByNode[note.at.slice(5)] ??= []).push(note.verdict ?? note.outcome);
  }
  facts.verdicts = verdictsByNode;
  const judged = Object.entries(verdictsByNode).filter(([nodeId]) => (graph?.nodes ?? []).some((node) => node.id === nodeId && isCriticFamily(node)));
  if (judged.length > 0) findings.push(`verdicts in order: ${judged.map(([nodeId, list]) => `${nodeId} → ${list.join(", ")}`).join("; ")}`);

  // ── 14. held-out evidence: who touched it ──────────────────────────────
  const heldOut = result.held_out?.dir;
  if (heldOut) {
    const touched = new Map();
    const marks = [heldOut, "/held-out/"];
    for (const entry of digest) {
      const uses = entry.tool_uses.filter((u) => !u.error && marks.some((m) => `${u.file ?? ""}${u.path ?? ""}${u.command ?? ""}${u.prompt ?? ""}`.includes(m)));
      if (uses.length > 0) touched.set(entry.who, uses.length);
    }
    const label = (who) => (who.startsWith(`${graphId}--`) ? who.slice(graphId.length + 2) : who);
    findings.push(`held-out evidence (${(result.held_out.files ?? []).map((f) => f.path).join(", ")}): touched by ${[...touched].map(([who, n]) => `${label(who)} ×${n}`).join(", ") || "nobody"}`);
    for (const nodeId of expect.heldOut?.readers ?? []) {
      if (!touched.has(`${graphId}--${nodeId}`)) problems.push(`${nodeId} never read or ran the held-out evidence, so its judgment was not made against it`);
    }
    for (const nodeId of expect.heldOut?.notReaders ?? []) {
      if (touched.has(`${graphId}--${nodeId}`)) problems.push(`${nodeId} read the held-out evidence it was told is not its to read (${touched.get(`${graphId}--${nodeId}`)} tool use(s))`);
    }
    facts.held_out_touched = Object.fromEntries([...touched].map(([who, n]) => [label(who), n]));
  }

  // ── counts ─────────────────────────────────────────────────────────────
  const rounds = [...new Set(loopNotes.map((note) => note.round).filter((round) => typeof round === "number"))];
  facts.loop_passes = loopNotes.length;
  facts.rounds_recorded = rounds.length;
  facts.last_round = rounds.length > 0 ? Math.max(...rounds) : null;
  facts.subagents = Object.fromEntries(subagentRuns);
  facts.notes = notes.length;
  facts.node_runs = notes.filter((note) => String(note.at).startsWith("node:")).length;
  // Timestamps: read from the clock they never run backwards along the file; the first batch's estimates did (D4).
  const stamps = notes.flatMap((note) => [note.started, note.ended].filter((t) => typeof t === "string").map((t) => Date.parse(t)));
  const backwards = stamps.filter((t, i) => i > 0 && Number.isFinite(t) && Number.isFinite(stamps[i - 1]) && t < stamps[i - 1]).length;
  facts.timestamps = { given: stamps.length, out_of_order: backwards };
  if (stamps.length > 0) findings.push(`timestamps: ${stamps.length} given, ${backwards} out of append order${backwards > 0 ? " (estimated, not read from the clock)" : ""}`);
  facts.started_notes = notes.filter((note) => note.outcome === "started").length;
  facts.halt_notes = notes.filter((note) => note.outcome === "halt").map((note) => note.at);
  const leadTurns = notes.filter((note) => note.cost?.measure === "turns").map((note) => note.cost.amount);
  facts.lead_turns = leadTurns.length > 0 ? Math.max(...leadTurns) : null;
  facts.denials = result.permission_denials?.length ?? 0;
  if (facts.denials > 0) findings.push(`permission denials: ${result.permission_denials.map((d) => `${d.tool}${d.command ? ` \`${d.command.slice(0, 80)}\`` : ""}${d.who ? ` (${d.who})` : ""}`).join("; ")}`);

  return { problems, findings, facts, result };
}

export function printCheck({ problems, findings, facts, result }) {
  const row = (label, value) => console.log(`${label.padEnd(20)}${value}`);
  if (result) {
    row("template", `${result.template} (graph ${result.graph_id})`);
    row("run id", result.run_id ?? "none");
    row("harness", `${result.harness} ${result.harness_version ?? "?"}`);
    row("models", Object.keys(result.models ?? {}).join(", ") || "unknown");
    row("cost (usd)", result.cost_usd ?? "unknown");
    row("harness turns", result.harness_turns ?? "unknown");
    row("duration (s)", result.duration_s ?? "unknown");
  }
  if (facts) {
    row("lead-counted turns", facts.lead_turns ?? "not noted");
    row("notes", `${facts.notes ?? 0} (${facts.node_runs ?? 0} node runs, ${facts.loop_passes ?? 0} loop passes)`);
    row("rounds recorded", `${facts.rounds_recorded ?? 0}${facts.last_round !== null && facts.last_round !== undefined ? ` (last round ${facts.last_round})` : ""}`);
    row("ending", (facts.ending ?? []).join(", ") || "none named");
    row("stop fired", (facts.stop_fired ?? []).join(", ") || "none named");
    row("halt notes", (facts.halt_notes ?? []).join(", ") || "none");
    row("started notes", facts.started_notes ?? 0);
    row("subagents", Object.entries(facts.subagents ?? {}).map(([who, n]) => `${who} ×${n}`).join(", ") || "none");
    row("amendments", (facts.amendments ?? []).length ? facts.amendments.join(" | ") : "none");
    row("proposals", (facts.proposals ?? []).length ? facts.proposals.join(" | ") : "none");
    row("working copy", Array.isArray(facts.working_copy) ? facts.working_copy.join("; ") : facts.working_copy);
    row("denials", facts.denials ?? 0);
    if (facts.back_edges) row("back edges", facts.back_edges.later_rounds > 0 || facts.back_edges.mentioned.length > 0 || facts.back_edges.edge_notes.length > 0 ? `yes (${facts.back_edges.later_rounds} loop note(s) beyond round 0; caught by ${facts.back_edges.caught_by.join(", ") || "?"})` : "none");
    if (facts.dispatch_count?.length) row("dispatch count", facts.dispatch_count.map((c) => `${c.loop}: recorded ${c.recorded}, started ${c.started}`).join("; "));
    if (facts.held_out_touched) row("held-out touched", Object.entries(facts.held_out_touched).map(([who, n]) => `${who} ×${n}`).join(", ") || "nobody");
  }
  if (findings.length > 0) {
    console.log("\nfindings (reported, not judged):");
    for (const finding of findings) console.log(`  - ${finding}`);
  }
  if (problems.length > 0) {
    console.error("\nproblems:");
    for (const problem of problems) console.error(`  - ${problem}`);
  }
}

