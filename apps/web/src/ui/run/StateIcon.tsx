import type { NodeRunState } from "@grooph/core";

/**
 * A run state as a shape, so it reads without colour (docs/runs.md §4):
 * pending an empty ring, running a ring with a dot, passed a tick, failed a
 * cross, halted two bars. Decorative: the label beside it says the same.
 */
export function StateIcon({ state }: { state: NodeRunState }) {
  return (
    <svg className={`state-icon state-${state}`} viewBox="0 0 16 16" aria-hidden="true">
      {state === "pending" ? <circle cx="8" cy="8" r="5.5" /> : null}
      {state === "running" ? (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="2.2" className="fill" />
        </>
      ) : null}
      {state === "passed" ? <path d="M3.5 8.5l3 3 6-7" /> : null}
      {state === "failed" ? <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> : null}
      {state === "halted" ? <path d="M6 4v8M10 4v8" /> : null}
    </svg>
  );
}
