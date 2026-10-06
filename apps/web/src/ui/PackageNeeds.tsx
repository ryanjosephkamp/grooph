import { KNOWN_TARGETS, targetTitle, type Graph } from "@grooph/core";

import { needInWords, packageNeeds } from "../doc/issues.js";

const TARGETS = KNOWN_TARGETS.map((id) => ({ id, title: targetTitle(id) ?? id }));

/**
 * What a package for a harness would still need of this graph, apart from the graph's own findings (`packageNeeds`):
 * a harness grooph has a compiler for, and a goal. A graph is a plan first (amendment A-020), so these
 * are said plainly, under the list, and not as errors of the graph. Nothing when a package needs nothing more.
 */
export function PackageNeeds({ doc, onOpen }: { doc: Graph; onOpen?: () => void }) {
  const needs = packageNeeds(doc);
  if (needs.length === 0) return null;
  return (
    <div className="keep" role="group" aria-label="For a package">
      <h3 className="files-title">For a package</h3>
      <p className="field-hint">This graph is whole as a plan. To write the files a coding harness runs it from, grooph would still need:</p>
      <ul className="files">
        {needs.map((need, i) => (
          <li key={`${need.code}-${i}`} className="field-hint">
            {needInWords(need, doc, TARGETS)}
          </li>
        ))}
      </ul>
      {onOpen ? (
        <button type="button" className="chip chip-small" onClick={onOpen}>
          Open graph
        </button>
      ) : null}
    </div>
  );
}
