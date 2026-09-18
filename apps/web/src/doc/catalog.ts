/**
 * The closed vocabularies of graph-ir §1, as runtime lists for pickers. The
 * `satisfies` checks fail the build if these drift from the core types.
 */
import type { BudgetMeasure, Capability, CheckNode, Edge, Effort, Evidence, Node, Role, StopKind, Tier } from "@grooph/core";

type Exhaustive<T extends string, L extends readonly T[]> = [T] extends [L[number]] ? L : never;

export const ROLES = [
  "lead",
  "planner",
  "builder",
  "critic",
  "tester",
  "researcher",
  "red-team",
  "judge",
  "synthesizer",
] as const satisfies readonly Role[];
export const ROLES_EXHAUSTIVE: Exhaustive<Role, typeof ROLES> = ROLES;

export const TIERS = ["frontier", "strong", "fast"] as const satisfies readonly Tier[];
export const TIERS_EXHAUSTIVE: Exhaustive<Tier, typeof TIERS> = TIERS;

export const EFFORTS = ["low", "medium", "high", "max"] as const satisfies readonly Effort[];
export const EFFORTS_EXHAUSTIVE: Exhaustive<Effort, typeof EFFORTS> = EFFORTS;

/** The named capabilities `Capability` lists; custom strings are allowed too. */
export const CAPABILITIES = [
  "read-files",
  "edit-files",
  "run-commands",
  "run-tests",
  "web",
  "spawn-agents",
] as const satisfies readonly Capability[];

/** graph-ir §1 names these; any other string is a custom irreversible action. */
export const IRREVERSIBLE = ["merge", "publish", "spend", "delete"] as const;

export const CHECK_KINDS = ["command", "tests", "diff", "metric", "evidence"] as const satisfies readonly CheckNode["check"]["kind"][];
export const CHECK_KINDS_EXHAUSTIVE: Exhaustive<CheckNode["check"]["kind"], typeof CHECK_KINDS> = CHECK_KINDS;

export const EVIDENCE_KINDS = ["file", "url", "metric", "checklist", "answer-key", "artifact"] as const satisfies readonly Evidence["kind"][];
export const EVIDENCE_KINDS_EXHAUSTIVE: Exhaustive<Evidence["kind"], typeof EVIDENCE_KINDS> = EVIDENCE_KINDS;

export const STOP_KINDS = [
  "bar-passed",
  "max-iterations",
  "budget",
  "human",
  "diminishing-returns",
  "evidence-invalid",
] as const satisfies readonly StopKind[];
export const STOP_KINDS_EXHAUSTIVE: Exhaustive<StopKind, typeof STOP_KINDS> = STOP_KINDS;

export const BUDGET_MEASURES = ["usd", "minutes", "turns", "tokens"] as const satisfies readonly BudgetMeasure[];
export const BUDGET_MEASURES_EXHAUSTIVE: Exhaustive<BudgetMeasure, typeof BUDGET_MEASURES> = BUDGET_MEASURES;

export const ISOLATIONS = ["fresh", "shared"] as const satisfies readonly NonNullable<Edge["isolation"]>[];

export type NodeKind = Node["kind"];

/** Kinds the canvas can add (handoff 0002, criterion 3). Merge nodes are edited, not created, in v0. */
export const ADDABLE_KINDS = ["agent", "human-gate", "check", "stop"] as const satisfies readonly NodeKind[];

export const KIND_LABEL: Record<NodeKind, string> = {
  agent: "Agent",
  "human-gate": "Human gate",
  check: "Check",
  merge: "Merge",
  stop: "Stop",
};

export const STOP_LABEL: Record<StopKind, string> = {
  "bar-passed": "Bar passed",
  "max-iterations": "Max iterations",
  budget: "Budget",
  human: "Human halt",
  "diminishing-returns": "Diminishing returns",
  "evidence-invalid": "Evidence invalid",
};
