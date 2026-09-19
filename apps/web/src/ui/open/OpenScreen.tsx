import { useMemo } from "react";

import { openPayload } from "../../doc/share.js";
import { Compare } from "./Compare.js";
import { GraphViewer } from "./GraphViewer.js";

/**
 * `#/open?d=…` (docs/executive.md §2–3). A link is untrusted input: core checks
 * it as an import would, and nothing here stores anything until the person
 * taps Save to this device. There is no export from a link.
 */
export function OpenScreen({ payload, candidate }: { payload: string; candidate?: string }) {
  const opened = useMemo(() => openPayload(payload), [payload]);

  if (!opened.ok) return <LinkProblem message={opened.message} details={opened.details} />;

  const { envelope } = opened;
  if (envelope.kind === "graph") return <GraphViewer doc={envelope.doc} back={{ href: "#/", label: "All graphs" }} />;

  const set = envelope.doc;
  if (candidate !== undefined) {
    const chosen = set.candidates.find((c) => c.id === candidate);
    if (chosen && "grooph" in chosen.graph) {
      return (
        <GraphViewer
          key={chosen.id}
          doc={chosen.graph}
          back={{ href: `#/open?d=${payload}`, label: "Back to the comparison" }}
          context={`${chosen.label} · from ${set.title}`}
        />
      );
    }
  }
  return <Compare set={set} setIssues={opened.issues} payload={payload} />;
}

function LinkProblem({ message, details }: { message: string; details: string[] }) {
  return (
    <main className="link-problem" role="alert">
      <h1>This link could not be opened</h1>
      <p>{message}</p>
      {details.length > 0 ? (
        <details className="more">
          <summary>What is wrong with it</summary>
          <pre className="issue-lines">{details.join("\n")}</pre>
        </details>
      ) : null}
      <p className="muted">Nothing from it was stored on this device.</p>
      <a className="btn btn-primary btn-large" href="#/">
        Back to your graphs
      </a>
    </main>
  );
}
