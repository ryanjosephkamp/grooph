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

/**
 * A proposal applied to a copy: what the copy loosens that the graph has, by name, or nothing. The copy is saved
 * either way. A proposal is how a run asks for a brake to be loosened (graph-ir §2), so this is a thing to be told
 * and not a thing to refuse: the person reads each line before using the copy.
 */
export function loosened(source: Graph, proposed: Graph): ReactNode {
  const refused = checkAdoption(source, proposed).refused;
  if (refused.length === 0) return null;
  return (
    <div className="refusal-hint" data-brakes="proposed">
      <p>
        <strong>This copy loosens a brake the graph has.</strong> A proposal is how a run asks for that, and it is yours to grant or not: read each before you use the copy.
      </p>
      <ul className="brakes-list" data-brakes="loosens">
        {refused.map((change) => (
          <li key={change.name} data-change-name={change.name}>
            <span className="mono">{change.name}</span> {change.loosens}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The document adoption would save, held to the brakes of the source it would replace. */
export function judge(source: Graph, adopted: Graph, run: string): Judged {
  const check = checkAdoption(source, adopted);
  const tighter = check.changes.filter((change) => change.tightens !== undefined && change.loosens === undefined);
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
      {check.notices.map((notice) => (
        <p key={notice} data-brakes="note">
          Note: {notice}
        </p>
      ))}
    </>
  );
  if (check.refused.length === 0) return { ok: true, view: tighter.length + check.notices.length > 0 ? <div className="field-hint" data-brakes="said">{more}</div> : null };
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
