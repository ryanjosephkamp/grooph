/**
 * Adoption held to the graph's brakes, in the app (docs/runs.md §5; amendment A-008, decision 0008). A run may
 * tighten a brake and never loosen one: pressing "Adopt as version N" on a working copy that loosens one saves
 * nothing, and lists each such change by name with its reasons, in the words `grooph adopt` uses, with the command
 * that adopts it on purpose. There is no way to say yes here: that is a decision about what a deliberate yes looks
 * like on a phone, and it is not made yet.
 *
 * This is a piece of the app fetched when Adopt is pressed and not before (decision 0021): the comparison is core's
 * `brakes.ts` and `reach.ts`, which no address needs to open. Everything a person is shown comes from here, so that
 * the run's page carries only the fetch and the place to put it. The command is built by the function the command's
 * own message is built by (`adoptCommandLine`), and a test runs it.
 */
import type { Graph } from "@grooph/core";
import { adoptCommandLine, checkAdoption } from "@grooph/core/adoption";
import type { ReactNode } from "react";

export type Judged = {
  /** nothing loosens a brake: the working copy may be saved */
  ok: boolean;
  /** what to show: the refusal, or what was tightened and noted; nothing when there is nothing to say */
  view: ReactNode;
};

const copy = (text: string) => () => void navigator.clipboard?.writeText(text).catch(() => undefined);

/** A line a person must see is brought to where they are looking: on a phone the run's panel is a few lines tall. */
const shown = (el: HTMLElement | null) => el?.scrollIntoView({ block: "start" });

/**
 * A proposal applied to a copy: what the copy loosens that the graph has, by name, and what is noted, or nothing.
 * The copy is saved either way. A proposal is how a run asks for a brake to be loosened (graph-ir §2), so this is a
 * thing to be told and not a thing to refuse. The copy is the run's working copy with the proposal applied, so what
 * it loosens may be the run's own amendment and not the proposal's: the words lay it at neither.
 */
export function loosened(source: Graph, proposed: Graph, graph: boolean): ReactNode {
  // A copy that does not match the schema is not a thing the comparison was written for: it is not asked, and said.
  if (!graph) {
    return (
      <p className="field-hint" data-brakes="not-compared" ref={shown}>
        Its brakes were not compared with the graph's: the copy is not a valid graph. Open the copy to see why before you use it.
      </p>
    );
  }
  const check = checkAdoption(source, proposed);
  if (check.refused.length + check.notices.length === 0) return null;
  const notes = check.notices.map((notice) => (
    <p key={notice} data-brakes="note">
      Note: {notice}
    </p>
  ));
  if (check.refused.length === 0) return <div className="field-hint" data-brakes="said" ref={shown}>{notes}</div>;
  return (
    <div className="refusal-hint" data-brakes="proposed" ref={shown}>
      <p>
        <strong>This copy loosens a brake the graph has.</strong> It is the run's working copy with this proposal applied; either may have done it, and it is yours to allow or not: read each line before you use the copy.
      </p>
      <ul className="brakes-list" data-brakes="loosens">
        {check.refused.map((change) => (
          <li key={change.name} data-change-name={change.name}>
            <span className="mono">{change.name}</span> {change.loosens}
          </li>
        ))}
      </ul>
      {notes}
    </div>
  );
}

/** The document adoption would save, held to the brakes of the source it would replace. */
export function judge(source: Graph, adopted: Graph, run: string): Judged {
  const check = checkAdoption(source, adopted);
  const tighter = check.changes.filter((change) => change.tightens !== undefined && change.loosens === undefined);
  const unjudged = check.changes.filter((change) => change.unjudged !== undefined && change.loosens === undefined);
  const command = adoptCommandLine(`.grooph/${source.id}/runs/${run}`, check.refused.map((change) => change.name));
  const more = (
    <>
      {tighter.length > 0 ? (
        <>
          <p>{check.refused.length > 0 ? "It also tightens a brake:" : "It tightens a brake:"}</p>
          <ul className="brakes-list" data-brakes="tightens">
            {tighter.map((change) => (
              <li key={change.name} data-change-name={change.name}>
                <span className="mono">{change.name}</span> undoing it: {change.tightens}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {unjudged.length > 0 ? (
        <>
          <p>
            {check.swapped
              ? "With a check removed in this copy, no change is called a tightening. If the check that comes in is the same one under another id, these may be built round it:"
              : "An answer a gate did not give, or a step marked irreversible that the graph did not have, lets a person or a run do what it could not before. It is named here and not called a tightening:"}
          </p>
          <ul className="brakes-list" data-brakes="unjudged">
            {unjudged.map((change) => (
              <li key={change.name} data-change-name={change.name}>
                <span className="mono">{change.name}</span> undoing it: {change.unjudged}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {check.notices.map((notice) => (
        <p key={notice} data-brakes="note">
          Note: {notice}
        </p>
      ))}
    </>
  );
  if (check.refused.length === 0) return { ok: true, view: tighter.length + unjudged.length + check.notices.length > 0 ? <div className="field-hint" data-brakes="said">{more}</div> : null };
  return {
    ok: false,
    view: (
      <div className="refusal" role="alert" data-brakes="refused">
        <p>
          <strong>Not adopted: this working copy loosens a brake.</strong> A run may tighten a brake and never loosen one. Nothing was saved.
        </p>
        <ul className="brakes-list" data-brakes="loosens">
          {check.refused.map((change) => (
            <li key={change.name} data-change-name={change.name}>
              <span className="mono">{change.name}</span> {change.loosens}
            </li>
          ))}
        </ul>
        <p>To adopt it on purpose, run this in the project's folder. It names each change above:</p>
        <pre className="issue-lines" data-brakes="command">{command}</pre>
        <button type="button" className="btn" onClick={copy(command)}>
          Copy the command
        </button>
        {more}
      </div>
    ),
  };
}
