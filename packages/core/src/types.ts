/**
 * The graph document, v0.
 *
 * Transcribed from `docs/graph-ir.md` §1, which is normative: when the schema
 * and these types disagree, these types win. Field order here is also the
 * canonical key order (§7), so keep declarations in document order.
 */

/** Kebab-case, unique across every id-bearing object in one document. */
export type Id = string;

/** Known ids get a profile under `docs/targets/`. */
export type HarnessId = "claude-code" | "codex" | (string & {});

export type Graph = {
  /** document schema version */
  grooph: 0;
  id: Id;
  name: string;
  /** graph version; bumps when a proposal is accepted */
  version: number;
  /** required for export and bootstrap (E_NO_GOAL) */
  goal?: string;
  /** required for export (E_NO_TARGET) */
  target?: { harness: HarnessId };
  /** free-text hints, surfaced in the lead brief */
  constraints?: { budget?: string; time?: string; other?: string };
  /** how far the lead may change the graph during a run; default "adaptive" (graph-ir §2, A-008) */
  adaptation?: Adaptation;
  /** pattern id; "graph-id@version" */
  lineage?: { pattern?: string; from?: string };
  /** present when this document is a template; shape and rules in docs/templates.md */
  template?: Template;
  /** one paragraph a human or executive can read */
  description?: string;

  nodes: Node[];
  edges: Edge[];
  loops: Loop[];
  policies?: Policy[];
  groups?: Group[];
  /** append-only; see graph-ir §6 */
  notes?: RunNote[];
  /** separable; models may ignore */
  layout?: Record<Id, { x: number; y: number; w?: number; h?: number }>;
};

/**
 * docs/templates.md §1. A document carrying this block is a template: not
 * exportable (`E_IS_TEMPLATE`) until `instantiate` removes it.
 */
export type Template = {
  /** a whole workflow, or nodes to insert into another graph (a single node is a fragment of one) */
  kind: TemplateKind;
  title: string;
  /** one sentence */
  summary: string;
  /** the situation this fits, in the spec §10 sense */
  whenToUse: string;
  /** the situation people wrongly reach for it in */
  notFor?: string;
  profile: Profile;
  /** `{{key}}` placeholders in string fields: the question to ask, and a realistic value for tests and demos */
  slots?: TemplateSlot[];
  tags?: string[];
  /** path or URL of a recorded run write-up (stage 6) */
  demo?: string;
};

export type TemplateKind = "graph" | "fragment";

/** Coarse on purpose: enough to offer "a fast one, a cheap one, a rigorous one". */
export type Profile = {
  cost: "low" | "medium" | "high";
  speed: "fast" | "medium" | "slow";
  rigor: "light" | "standard" | "high";
};

export type TemplateSlot = { key: string; ask: string; example: string };

/** graph-ir §2: `adaptive` amends the run's working copy, `propose` records proposals, `fixed` halts and asks. */
export type Adaptation = "adaptive" | "propose" | "fixed";

export type Node = AgentNode | HumanGateNode | CheckNode | MergeNode | StopNode;

export type NodeBase = { id: Id; name: string; description?: string; coupled?: boolean };

export type AgentNode = NodeBase & {
  kind: "agent";
  role: Role | { custom: string };
  model?: { tier: Tier; pin?: Record<HarnessId, string> };
  effort?: Effort;
  /** what this node may and may not do; the core of its prompt */
  brief: string;
  /** artifacts or facts it expects; free text or artifact ids */
  inputs?: string[];
  /** what it must leave behind; at least one */
  outputs: string[];
  /** named capabilities, not vendor tools */
  allow?: Capability[];
  deny?: Capability[];
  /** artifact ids this node exclusively writes */
  owns?: string[];
  /** irreversible actions it performs: "merge" | "publish" | "spend" | "delete" | custom */
  irreversible?: string[];
};

export type Role =
  | "lead"
  | "planner"
  | "builder"
  | "critic"
  | "tester"
  | "researcher"
  | "red-team"
  | "judge"
  | "synthesizer";

/**
 * `write-outputs`: may create or overwrite only the files it names in `outputs`
 * — what a critic needs to leave REVIEW.md behind while denied `edit-files`.
 */
export type Capability =
  | "read-files"
  | "edit-files"
  | "write-outputs"
  | "run-commands"
  | "run-tests"
  | "web"
  | "spawn-agents"
  | (string & {});

export type Tier = "frontier" | "strong" | "fast";
export type Effort = "low" | "medium" | "high" | "max";

export type HumanGateNode = NodeBase & { kind: "human-gate"; prompt: string; options?: string[] };

export type CheckNode = NodeBase & {
  kind: "check";
  check: {
    kind: "command" | "tests" | "diff" | "metric" | "evidence";
    run?: string;
    pass: string;
    threshold?: number;
  };
};

/** `merges` holds artifact ids. */
export type MergeNode = NodeBase & { kind: "merge"; merges: string[]; strategy?: string };

export type StopNode = NodeBase & { kind: "stop"; outcome?: "success" | "halt" };

export type EdgeWhen = "always" | "pass" | "fail" | { verdict: string };

export type Edge = {
  id: Id;
  /** node ids */
  from: Id;
  to: Id;
  /** default "always" */
  when?: EdgeWhen;
  /** default "fresh": the downstream worker sees only brief + evidence */
  isolation?: "fresh" | "shared";
  /** cap on simultaneous traversals of this edge */
  concurrency?: { max: number };
  retry?: { max: number };
  /** artifacts the downstream node may inspect; everything else is hidden */
  evidence?: string[];
  /** a human must approve before traversal */
  approval?: boolean;
  label?: string;
};

export type Loop = {
  id: Id;
  name: string;
  /** node ids; the cycle lives inside this set */
  members: Id[];
  /** edges that return work to an earlier member; at least one */
  back: Id[];
  /** inferred when absent: "grind" if every back edge starts at a check node, else "judgment" */
  mode?: "grind" | "judgment";
  /** required for judgment loops */
  bar?: Bar;
  /** at least one */
  stops: Stop[];
};

export type Bar = {
  name: string;
  /** at least one; an adjective is not a bar */
  inspects: Evidence[];
  /** reachable "good enough to stop" */
  acceptance: string;
  /** directional, possibly unreachable; never the stop condition */
  aspiration?: string;
  /** node whose output becomes the bar (spec-then-loop) */
  answerKeyFrom?: Id;
};

export type Evidence = {
  kind: "file" | "url" | "metric" | "checklist" | "answer-key" | "artifact";
  ref: string;
  note?: string;
};

export type BudgetMeasure = "usd" | "minutes" | "turns" | "tokens";

export type Stop =
  /** human halt; optionally asked every N rounds */
  | { kind: "human"; every?: number; then?: Id }
  | { kind: "budget"; measure: BudgetMeasure; limit: number; then?: Id }
  /** acceptance bar met */
  | { kind: "bar-passed"; then?: Id }
  | { kind: "diminishing-returns"; rounds: number; metric?: string; threshold?: number; then?: Id }
  | { kind: "evidence-invalid"; rounds: number; then?: Id }
  /** safety backstop, not the definition of done */
  | { kind: "max-iterations"; n: number; then?: Id };

export type StopKind = Stop["kind"];

export type PolicyKind =
  | "critic-isolation"
  | "no-self-grading"
  | "owner-per-artifact"
  | "concurrency-cap"
  | "no-live-graph-rewrite"
  | "evidence-required"
  | { custom: string };

export type PolicyScope = "graph" | `loop:${Id}` | `node:${Id}` | `edge:${Id}`;

export type Policy = {
  id: Id;
  kind: PolicyKind;
  scope: PolicyScope;
  /** e.g. { max: 3 } for concurrency-cap */
  params?: Record<string, string | number | boolean>;
};

export type Group = { id: Id; name: string; members: Id[]; coupled?: boolean };

export type RunNoteAt = "graph" | `node:${Id}` | `edge:${Id}` | `loop:${Id}`;

export type RunNote = {
  id: Id;
  /** run id, chosen by the lead at kickoff */
  run: string;
  at: RunNoteAt;
  /** ISO timestamps */
  started?: string;
  ended?: string;
  outcome?: "pass" | "fail" | "halt" | "invalid-evidence" | (string & {});
  /** critic verdict label, if any */
  verdict?: string;
  /** loop round, when `at` is a loop or a member */
  round?: number;
  /** what was actually inspected */
  evidence?: string[];
  cost?: { measure: BudgetMeasure; amount: number };
  /** repeated gaps observed */
  gaps?: string[];
  /** proposed graph edit; never applied automatically */
  proposal?: { summary: string; patch?: unknown };
  /** a change the lead made to the run's working copy (adaptive runs only) */
  amendment?: { summary: string; reason: string; patch?: unknown };
  /** free commentary, short */
  text?: string;
};

/* ------------------------------------------------------------------ *
 * Proposal sets (docs/executive.md §1): the candidates an executive
 * offers for one project, and the reasoning, as data.
 * ------------------------------------------------------------------ */

export type ProposalSet = {
  /** document schema version */
  groophProposals: 0;
  id: Id;
  title: string;
  /** the project and its constraints as the executive understood them */
  brief: string;
  /** one to four */
  candidates: Candidate[];
  recommendation?: { candidate: Id; why: string };
};

export type Candidate = {
  id: Id;
  /** "Lean", "Fast", "Rigorous": a word the owner can say back */
  label: string;
  /** `{ file }` is resolved against the proposal set's folder and inlined by `grooph share` */
  graph: Graph | CandidateFile;
  /** template id, when it started from one */
  basedOn?: string;
  /** why this shape fits this project, three or four sentences */
  rationale: string;
  pros: string[];
  /** include any validation warning, in plain words */
  cons: string[];
  profile: Profile;
  /** computed by core (`estimateShape`), never written by the executive */
  shape?: Shape;
};

export type CandidateFile = { file: string };

export type ShapeTier = Tier | "unset";

/** Structural and honest: counts and brakes, no dollar figures. */
export type Shape = {
  agents: number;
  checks: number;
  /** human-gate nodes plus edges that need approval */
  gates: number;
  loops: number;
  tiers: Record<ShapeTier, number>;
  /** sum over loops of their max-iterations, nested loops multiplied; null when a loop has none */
  worstCaseRounds: number | null;
  /** each loop's budget stop, as text */
  budgets: string[];
};

/* ------------------------------------------------------------------ *
 * Run bundles (docs/runs.md §2): one run, self-contained, for import,
 * share links and the `grooph watch` endpoint. Run data lives beside
 * the graph, never inside it (spec §4.7).
 * ------------------------------------------------------------------ */

/** A line of `notes.jsonl` that could not be read, by its line number (from 1). */
export type RunNoteIssue = { line: number; message: string };

export type RunBundle = {
  /** bundle schema version */
  groophRun: 0;
  /** the run id: the run folder's name */
  run: string;
  /** the run's PROGRESS.md, when there is one */
  progress?: string;
  /** the graph as the package placed it (`.grooph/<graph-id>/graph.grooph.json`) */
  source: Graph;
  /** the run's working copy (graph-ir §2) */
  working: Graph;
  /** the readable lines of notes.jsonl, in append order */
  notes: RunNote[];
  /** the lines that could not be read */
  issues?: RunNoteIssue[];
};
