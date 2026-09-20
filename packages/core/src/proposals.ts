/**
 * Proposal sets (docs/executive.md §1): the one to four candidate graphs an
 * executive offers for a project, with the reasoning, as a document. Pure,
 * like the rest of core; resolving `{ file }` candidates from disk is the
 * CLI's job.
 */

import type { Severity } from "./issues.js";
import { nearestIds } from "./parse.js";
import { proposalSetSchema } from "./schema/proposals.js";
import type { UnknownKey } from "./schema/dsl.js";
import { didYouMean } from "./suggest.js";
import type { Candidate, CandidateFile, Graph, Id, Loop, ProposalSet, Shape, ShapeTier } from "./types.js";
import { validate } from "./validate.js";

/** The codes a proposal set can raise. Graph codes keep their graph-ir meaning; `E_DUPLICATE_LABEL` and `E_CANDIDATE_INVALID` are the set's own. */
export type ProposalIssueCode =
  | "E_SCHEMA"
  | "E_DUPLICATE_ID"
  | "E_DUPLICATE_LABEL"
  | "E_DANGLING_REF"
  | "E_CANDIDATE_INVALID"
  | "W_UNKNOWN_KEY";

/** The same shape as a graph issue (docs/executive.md §1), so one printer serves both. */
export type ProposalIssue = { code: ProposalIssueCode; severity: Severity; message: string; at: Id[] };

const issue = (code: ProposalIssueCode, severity: Severity, message: string, at: Id[] = []): ProposalIssue => ({
  code,
  severity,
  message,
  at,
});

export type ProposalParseResult = { set?: ProposalSet; issues: ProposalIssue[] };

/** Check an unknown JSON value against the proposal set schema: `E_SCHEMA` issues naming the path, or the set. */
export function parseProposalSet(json: unknown): ProposalParseResult {
  const found: { path: string; message: string }[] = [];
  proposalSetSchema.check(json, "", found);
  if (found.length > 0) {
    return {
      issues: found.map((f) => issue("E_SCHEMA", "error", `${f.path === "" ? "/" : f.path}: ${f.message}`, nearestIds(json, f.path))),
    };
  }
  return { set: json as ProposalSet, issues: [] };
}

/** Parse JSON text, reporting a syntax error as `E_SCHEMA` too. */
export function parseProposalSetText(text: string): ProposalParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { issues: [issue("E_SCHEMA", "error", `/: not valid JSON: ${(err as Error).message}`)] };
  }
  return parseProposalSet(json);
}

/** Whether a parsed JSON value looks like a proposal set rather than a graph: the one key that tells them apart. */
export const isProposalSetLike = (json: unknown): boolean =>
  typeof json === "object" && json !== null && !Array.isArray(json) && "groophProposals" in json;

export const isCandidateFile = (graph: Candidate["graph"]): graph is CandidateFile => !("grooph" in graph) && "file" in graph;

export type ValidateProposalsOptions = {
  /** A `{ file }` candidate is an error (`E_CANDIDATE_INVALID`): links and `--out` files must carry every graph. */
  requireInline?: boolean;
};

/**
 * The proposal set rules (docs/executive.md §1): the schema (which holds one to
 * four candidates), ids unique, labels distinct, the recommendation names a
 * candidate, and every inline graph free of export errors. A `{ file }`
 * candidate's graph is checked once it is inlined.
 */
export function validateProposalSet(set: ProposalSet, options: ValidateProposalsOptions = {}): ProposalIssue[] {
  const parsed = parseProposalSet(set);
  if (!parsed.set) return parsed.issues;
  const candidates = set.candidates;
  const issues: ProposalIssue[] = [];

  const places = new Map<Id, string[]>();
  places.set(set.id, ["the set's own id"]);
  candidates.forEach((c, i) => places.set(c.id, [...(places.get(c.id) ?? []), `candidates[${i}]`]));
  for (const [id, where] of places) {
    if (where.length > 1) issues.push(issue("E_DUPLICATE_ID", "error", `id "${id}" is used ${where.length} times: ${where.join(", ")}`, [id]));
  }

  const byLabel = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = labelKey(c.label);
    byLabel.set(key, [...(byLabel.get(key) ?? []), c]);
  }
  for (const same of byLabel.values()) {
    if (same.length < 2) continue;
    issues.push(
      issue(
        "E_DUPLICATE_LABEL",
        "error",
        `candidates ${same.map((c) => `"${c.id}"`).join(", ")} share the label "${same[0]!.label}"; labels are what the owner says back, so each must differ (case is ignored)`,
        same.map((c) => c.id),
      ),
    );
  }

  const recommended = set.recommendation?.candidate;
  if (recommended !== undefined && !candidates.some((c) => c.id === recommended)) {
    issues.push(
      issue(
        "E_DANGLING_REF",
        "error",
        `the recommendation names candidate "${recommended}", which is not in the set${didYouMean(recommended, candidates.map((c) => c.id))}`,
        [set.id],
      ),
    );
  }

  for (const c of candidates) {
    if (isCandidateFile(c.graph)) {
      if (options.requireInline) {
        issues.push(
          issue(
            "E_CANDIDATE_INVALID",
            "error",
            `candidate "${c.id}" (${c.label}) points at ${c.graph.file} instead of carrying its graph; grooph share inlines it`,
            [c.id],
          ),
        );
      }
      continue;
    }
    const errors = validate(c.graph, { forExport: true }).filter((i) => i.severity === "error");
    if (errors.length === 0) continue;
    const codes = [...new Set(errors.map((e) => e.code))];
    issues.push(
      issue(
        "E_CANDIDATE_INVALID",
        "error",
        `candidate "${c.id}" (${c.label}) has errors that block export: ${codes.join(", ")}. First: ${errors[0]!.message}. Fix its graph and run grooph validate --for-export on it`,
        [c.id],
      ),
    );
  }

  const unknown: UnknownKey[] = [];
  proposalSetSchema.unknownKeys(set, "", unknown);
  // Keys inside a candidate's graph are the graph validator's to report.
  for (const { path, key, known } of unknown.filter((u) => !/^\/candidates\/\d+\/graph\//.test(u.path))) {
    const owner = nearestIds(set, path.slice(0, path.lastIndexOf("/")));
    issues.push(
      issue(
        "W_UNKNOWN_KEY",
        "warning",
        `unknown key "${key}" at ${path}${didYouMean(key, known)}; it is kept, but grooph does not read it`,
        owner.length > 0 ? owner : [set.id],
      ),
    );
  }
  return issues;
}

/** How labels are compared: what `grooph pick` matches and what must be distinct. */
export const labelKey = (label: string): string => label.trim().replace(/\s+/g, " ").toLowerCase();

// ─── shape ────────────────────────────────────────────────────────────────

const maxIterations = (loop: Loop): number | undefined => {
  const caps = (loop.stops ?? []).flatMap((stop) => (stop.kind === "max-iterations" ? [stop.n] : []));
  return caps.length === 0 ? undefined : Math.min(...caps);
};

/**
 * The structure of a graph at a glance (docs/executive.md §1): counts and
 * brakes, no dollar figures. A loop nested inside another (its members a
 * strict subset of the other's) runs afresh on every outer round (graph-ir §2),
 * so its rounds are multiplied by every enclosing loop's cap.
 */
export function estimateShape(graph: Graph): Shape {
  const nodes = graph.nodes ?? [];
  const loops = graph.loops ?? [];
  const tiers: Record<ShapeTier, number> = { frontier: 0, strong: 0, fast: 0, unset: 0 };
  for (const node of nodes) if (node.kind === "agent") tiers[node.model?.tier ?? "unset"] += 1;

  const caps = loops.map(maxIterations);
  let worstCaseRounds: number | null = null;
  if (caps.every((n): n is number => n !== undefined)) {
    const members = loops.map((loop) => new Set(loop.members ?? []));
    const encloses = (outer: number, inner: number): boolean =>
      outer !== inner && members[inner]!.size < members[outer]!.size && [...members[inner]!].every((m) => members[outer]!.has(m));
    worstCaseRounds = caps.reduce((total, cap, i) => total + caps.reduce((factor, outer, j) => (encloses(j, i) ? factor * outer : factor), cap), 0);
  }

  const budgeted = loops.filter((loop) => (loop.stops ?? []).some((stop) => stop.kind === "budget"));
  const budgets = budgeted.flatMap((loop) =>
    (loop.stops ?? []).flatMap((stop) =>
      stop.kind === "budget" ? [`${budgeted.length > 1 ? `${loop.name || loop.id}: ` : ""}${amount(stop.measure, stop.limit)}`] : [],
    ),
  );

  return {
    agents: nodes.filter((n) => n.kind === "agent").length,
    checks: nodes.filter((n) => n.kind === "check").length,
    gates: nodes.filter((n) => n.kind === "human-gate").length + (graph.edges ?? []).filter((e) => e.approval === true).length,
    loops: loops.length,
    tiers,
    worstCaseRounds,
    budgets,
  };
}

const amount = (measure: string, limit: number): string => (measure === "usd" ? `$${limit}` : `${limit} ${measure}`);

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One line for a card or a chat message: "4 agents · 1 gate · 1 loop · up to 4 rounds · 12 dispatches". A dispatch is one node run. */
export function shapeLine(shape: Shape): string {
  const parts = [count(shape.agents, "agent")];
  if (shape.checks > 0) parts.push(count(shape.checks, "check"));
  if (shape.gates > 0) parts.push(count(shape.gates, "gate"));
  if (shape.loops === 0) parts.push("no loop");
  else {
    parts.push(count(shape.loops, "loop"));
    parts.push(shape.worstCaseRounds === null ? "no round cap" : `up to ${count(shape.worstCaseRounds, "round")}`);
  }
  parts.push(...shape.budgets);
  return parts.join(" · ");
}

/** "1 frontier · 2 strong", in tier order, leaving out tiers nobody uses. */
export function tierLine(shape: Shape): string {
  const order: ShapeTier[] = ["frontier", "strong", "fast", "unset"];
  const used = order.filter((tier) => shape.tiers[tier] > 0);
  return used.map((tier) => `${shape.tiers[tier]} ${tier === "unset" ? "session default" : tier}`).join(" · ");
}

/** Canonical form of a proposal set: key order from the schema, graphs in their own canonical order. */
export function canonicalizeProposals(set: ProposalSet): string {
  return `${JSON.stringify(proposalSetSchema.canon(set), null, 2)}\n`;
}

/** Candidates found by id or label, case-insensitive (what `grooph pick` and the compare view accept). */
export function findCandidates(set: ProposalSet, query: string): { byId: Candidate[]; byLabel: Candidate[] } {
  const key = labelKey(query);
  return {
    byId: set.candidates.filter((c) => c.id.toLowerCase() === key),
    byLabel: set.candidates.filter((c) => labelKey(c.label) === key),
  };
}
