import type { Id } from "./types.js";

export type Severity = "error" | "warning";

/** Every rule code in `docs/graph-ir.md` §3. Codes are the contract; they never change meaning. */
export type IssueCode =
  // structural
  | "E_SCHEMA"
  | "E_DUPLICATE_ID"
  | "E_DANGLING_REF"
  | "E_LOOP_BACK_EDGE"
  // spec §12 hard errors
  | "E_CYCLE_NO_STOP"
  | "E_JUDGMENT_LOOP_NO_BAR"
  | "E_STOP_NOT_INSPECTABLE"
  | "E_NO_TARGET"
  | "E_NO_GOAL"
  | "E_IS_TEMPLATE"
  | "E_UNFILLED_SLOT"
  | "E_CRITIC_NOT_ISOLATED"
  | "E_OWNERSHIP_CONFLICT"
  | "E_IRREVERSIBLE_NO_GATE"
  // spec §12 warnings
  | "W_HOMOGENEOUS_CRITICS"
  | "W_FANOUT_ON_COUPLED"
  | "W_LONG_LOOP_NO_BUDGET"
  | "W_ASPIRATION_AS_ACCEPTANCE"
  // additional warnings
  | "W_ONLY_MAX_ITERATIONS"
  | "W_UNREACHABLE_NODE"
  | "W_NO_TERMINAL"
  | "W_OUTPUT_NOT_WRITABLE"
  | "W_UNKNOWN_KEY"
  | "W_DOC_TOO_LARGE";

export type Issue = {
  code: IssueCode;
  severity: Severity;
  message: string;
  /** the objects involved, so a view can highlight them */
  at: Id[];
};

/** Every rule in graph-ir §3, in table order. Each has at least one failing fixture. */
export const IMPLEMENTED_CODES = [
  "E_SCHEMA",
  "E_DUPLICATE_ID",
  "E_DANGLING_REF",
  "E_LOOP_BACK_EDGE",
  "E_CYCLE_NO_STOP",
  "E_JUDGMENT_LOOP_NO_BAR",
  "E_STOP_NOT_INSPECTABLE",
  "E_NO_TARGET",
  "E_NO_GOAL",
  "E_IS_TEMPLATE",
  "E_UNFILLED_SLOT",
  "E_CRITIC_NOT_ISOLATED",
  "E_OWNERSHIP_CONFLICT",
  "E_IRREVERSIBLE_NO_GATE",
  "W_HOMOGENEOUS_CRITICS",
  "W_FANOUT_ON_COUPLED",
  "W_LONG_LOOP_NO_BUDGET",
  "W_ASPIRATION_AS_ACCEPTANCE",
  "W_ONLY_MAX_ITERATIONS",
  "W_UNREACHABLE_NODE",
  "W_NO_TERMINAL",
  "W_OUTPUT_NOT_WRITABLE",
  "W_UNKNOWN_KEY",
  "W_DOC_TOO_LARGE",
] as const satisfies readonly IssueCode[];

export type ImplementedCode = (typeof IMPLEMENTED_CODES)[number];

/** Fails the build if a code joins `IssueCode` without joining `IMPLEMENTED_CODES`. */
export type _EveryCodeImplemented = [Exclude<IssueCode, ImplementedCode>] extends [never] ? true : never;
const _everyCodeImplemented: _EveryCodeImplemented = true;
void _everyCodeImplemented;

/** Codes named in graph-ir §3 but not implemented yet. Empty since stage 3. */
export const PLANNED_CODES = [] as const satisfies readonly IssueCode[];

export const error = (code: IssueCode, message: string, at: Id[] = []): Issue => ({
  code,
  severity: "error",
  message,
  at,
});

export const warning = (code: IssueCode, message: string, at: Id[] = []): Issue => ({
  code,
  severity: "warning",
  message,
  at,
});

export const hasErrors = (issues: readonly Issue[]): boolean =>
  issues.some((issue) => issue.severity === "error");

/** One line per issue, the form the CLI prints and the web app shows. */
export const formatIssue = (issue: Issue): string =>
  `${issue.severity === "error" ? "error" : "warning"}  ${issue.code}  ${issue.message}${
    issue.at.length > 0 ? `  [at: ${issue.at.join(", ")}]` : ""
  }`;
