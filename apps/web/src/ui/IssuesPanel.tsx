import type { Issue } from "@grooph/core";

import { countBySeverity, highlightFor, packageNeeds } from "../doc/issues.js";
import { useDoc } from "../doc/store.js";
import { useEditor } from "./editorContext.js";
import { PackageNeeds } from "./PackageNeeds.js";

/**
 * The validator's list, as `grooph validate` prints it: the graph's own findings. Tapping
 * an issue highlights the objects in its `at` and brings them into view. What only a package asks for is under it.
 */
export function IssuesPanel({ issues }: { issues: Issue[] }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const { errors, warnings } = countBySeverity(issues);

  const needs = <PackageNeeds doc={doc} onOpen={() => editor.openPanel({ type: "graph" })} />;
  if (issues.length === 0) {
    return (
      <div className="inspector">
        <p className="all-clear">{packageNeeds(doc).length === 0 ? "No issues. The graph validates for export." : "No issues. The graph validates."}</p>
        {needs}
      </div>
    );
  }

  const nameOf = (id: string): string =>
    id === doc.id
      ? "graph"
      : (doc.nodes.find((n) => n.id === id)?.name || doc.loops.find((l) => l.id === id)?.name || id);

  return (
    <div className="inspector">
      <p className="issue-summary">
        {errors} error{errors === 1 ? "" : "s"}, {warnings} warning{warnings === 1 ? "" : "s"}.{" "}
        {errors > 0 ? "A package waits until the errors are fixed; the plan can be kept as it is." : "Warnings are carried into the lead brief."}
      </p>
      <ul className="issues">
        {issues.map((issue, i) => {
          const h = highlightFor(doc, issue.at);
          const active = issue.at.length > 0 && issue.at.every((id) => editor.highlight.nodes.has(id) || editor.highlight.edges.has(id) || editor.highlight.loops.has(id) || (id === doc.id && editor.highlight.graph));
          return (
            <li key={`${issue.code}-${i}`}>
              <button
                type="button"
                className={`issue issue-${issue.severity}${active ? " issue-active" : ""}`}
                onClick={() => {
                  editor.setHighlight(h);
                  if (h.nodes.size > 0) editor.reveal([...h.nodes]);
                  else if (h.edges.size > 0) {
                    const ends = doc.edges.filter((e) => h.edges.has(e.id)).flatMap((e) => [e.from, e.to]);
                    editor.reveal(ends);
                  }
                }}
              >
                <span className="issue-head">
                  <span className="issue-severity">{issue.severity}</span>
                  <span className="issue-code mono">{issue.code}</span>
                </span>
                <span className="issue-message">{issue.message}</span>
              </button>
              {issue.at.length > 0 ? (
                <div className="issue-at">
                  {issue.at.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="chip chip-small"
                      onClick={() => {
                        if (id === doc.id) editor.openPanel({ type: "graph" });
                        else if (doc.nodes.some((n) => n.id === id)) editor.openPanel({ type: "node", id });
                        else if (doc.edges.some((e) => e.id === id)) editor.openPanel({ type: "edge", id });
                        else if (doc.loops.some((l) => l.id === id)) editor.openPanel({ type: "loop", id });
                      }}
                    >
                      Open {nameOf(id)}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {needs}
    </div>
  );
}
