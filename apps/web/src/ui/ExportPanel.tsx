import { KNOWN_TARGETS, formatIssue, targetTitle, type Graph, type Issue } from "@grooph/core";
import type { PlanBundle } from "@grooph/core/plan";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  attemptExport,
  compilerHere,
  copyText,
  download,
  graphFileName,
  graphFileText,
  loadCompiler,
  packageFileName,
  zipPackage,
  type ExportAttempt,
} from "../doc/exportPackage.js";
import { computeIssues, needInWords, packageNeeds } from "../doc/issues.js";
import { planFileType, planOf, planZipName } from "../doc/plan.js";
import { useDoc } from "../doc/store.js";
import { useEditor } from "./editorContext.js";
import { Keep } from "./Keep.js";

const TARGETS = KNOWN_TARGETS.map((id) => ({ id, title: targetTitle(id) ?? id }));

/**
 * Export (spec §9, amendment A-020). A graph is a plan first, and a plan can always be kept: its three files, for
 * any document that reads as a graph, whatever the validator found. Under it, a package for a harness: what it
 * still needs, said plainly, and then the files `compile()` emits, as a zip, with the kickoff prompt on the
 * clipboard in one tap. A package is refused with the error list when the graph has errors, as the CLI refuses.
 *
 * The panel is a piece of the app, fetched through `ExportDoor.tsx` when Export is pressed (the editor asks for it
 * soon after it opens): a canvas that only draws a graph does not carry it. The plan's maker comes with it.
 */
export function ExportPanel() {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  // The compiler arrives once (the editor asks for it soon after it opens); after that this is as it always was.
  const [compiler, setCompiler] = useState<"here" | "coming" | "failed">(compilerHere() ? "here" : "coming");
  useEffect(() => {
    if (compiler !== "coming") return;
    let gone = false;
    loadCompiler().then(
      () => !gone && setCompiler("here"),
      () => !gone && setCompiler("failed"),
    );
    return () => {
      gone = true;
    };
  }, [compiler]);
  const attempt = useMemo(() => attemptExport(doc), [doc, compiler]);
  const own = useMemo(() => computeIssues(doc), [doc]);
  const needs = useMemo(() => packageNeeds(doc), [doc]);
  // A document that does not match the schema yet cannot be drawn or outlined, so there is no plan of it.
  const reads = !own.some((issue) => issue.code === "E_SCHEMA");
  const plan = useMemo(() => (reads ? planOf(doc) : undefined), [doc, reads]);

  const downloadGraph = (
    <button type="button" className="btn" onClick={() => download(graphFileName(doc), graphFileText(doc), "application/json")}>
      Download graph (.grooph.json)
    </button>
  );

  if (!reads) {
    return (
      <div className="inspector">
        <div className="refusal" role="alert">
          <p>
            <strong>This does not read as a graph yet: fix these first.</strong>
          </p>
          <p className="field-hint">The document does not match the graph schema yet, so it has no plan and no package. The file itself can be kept.</p>
          <pre className="issue-lines">{own.map(formatIssue).join("\n")}</pre>
          <button type="button" className="btn" onClick={() => editor.openPanel({ type: "issues" })}>
            Show issues
          </button>
        </div>
        <div className="export-actions">{downloadGraph}</div>
        <Keep doc={doc} />
      </div>
    );
  }

  return (
    <div className="inspector">
      {plan ? <ThePlan doc={doc} plan={plan} graph={downloadGraph} /> : null}
      <Keep doc={doc} />
      <ThePackage doc={doc} attempt={attempt} compiler={compiler} own={own} needs={needs} />
    </div>
  );
}

/**
 * The plan: `PLAN.md`, the picture and the document, one by one and together. Always offered for a graph that
 * reads; what the validator found is written in `PLAN.md`, and said here in one line.
 */
function ThePlan({ doc, plan, graph }: { doc: Graph; plan: PlanBundle; graph: ReactNode }) {
  const errors = plan.toFix.filter((issue) => issue.severity === "error").length;
  const picture = `${doc.id}.svg`;
  return (
    <div role="group" aria-label="The plan">
      <h3 className="files-title">The plan</h3>
      <p className="field-hint">This graph for people to read and follow: who does what, the picture, and the file. It can always be kept, whatever the validator found.</p>
      <div className="export-actions">
        <button type="button" className="btn btn-primary" onClick={() => download(planZipName(doc), zipPackage(plan.files), "application/zip")}>
          The plan, all three (.zip)
        </button>
        <button type="button" className="btn" onClick={() => download("PLAN.md", plan.files["PLAN.md"]!, planFileType("PLAN.md"))}>
          Plan (PLAN.md)
        </button>
        <button type="button" className="btn" onClick={() => download(picture, plan.files[picture]!, planFileType(picture))}>
          Its picture (.svg)
        </button>
        {graph}
      </div>
      {errors > 0 ? (
        <p className="field-hint">
          PLAN.md lists {errors} thing{errors === 1 ? "" : "s"} to fix before a harness can run this. They do not stop the plan.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A package for a harness. What it still needs is said plainly: a harness grooph has a compiler for, a goal, and a
 * graph with no errors. None of those is a fault of a plan, and only the graph's own errors are shown as errors.
 */
function ThePackage({ doc, attempt, compiler, own, needs }: { doc: Graph; attempt: ExportAttempt | undefined; compiler: "here" | "coming" | "failed"; own: Issue[]; needs: Issue[] }) {
  const editor = useEditor();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [open, setOpen] = useState<string | null>(null);
  const errors = own.filter((issue) => issue.severity === "error");
  const title = <h3 className="files-title">A package for a harness</h3>;

  if (errors.length > 0 || needs.length > 0) {
    const named = doc.target?.harness?.trim();
    return (
      <div className="keep" role="group" aria-label="A package for a harness">
        {title}
        <p className="field-hint">The files a coding harness runs this graph from. To write them, grooph still needs:</p>
        <ul className="files">
          {needs.map((need, i) => (
            <li key={`${need.code}-${i}`} className="field-hint">
              {needInWords(need, doc, TARGETS)}
            </li>
          ))}
          {errors.length > 0 ? (
            <li className="field-hint">
              A graph with no errors: this one has {errors.length}.
            </li>
          ) : null}
        </ul>
        {needs.length > 0 ? (
          <button type="button" className="btn" onClick={() => editor.openPanel({ type: "graph" })}>
            Open the graph's details
          </button>
        ) : null}
        {errors.length > 0 ? (
          <div className="refusal" role="alert">
            <p>
              <strong>Cannot export for {named || "a harness"}: fix these first.</strong>
            </p>
            <p className="field-hint">{`${errors.length} validation error${errors.length === 1 ? "" : "s"} — ${errors.map((i) => i.code).join(", ")}`}</p>
            <pre className="issue-lines">{own.map(formatIssue).join("\n")}</pre>
            <button type="button" className="btn" onClick={() => editor.openPanel({ type: "issues" })}>
              Show issues
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="keep" role="group" aria-label="A package for a harness">
        {title}
        {compiler === "failed" ? (
          <div className="refusal" role="alert">
            <p>
              <strong>The exporter could not be fetched.</strong> It needs a connection the first time.
            </p>
            <button type="button" className="btn" onClick={() => location.reload()}>
              Load the page again
            </button>
          </div>
        ) : (
          <p className="field-hint" role="status">
            Preparing the package…
          </p>
        )}
      </div>
    );
  }

  if (!attempt.ok) {
    // The compiler's own refusal, for what the validator's two lists did not say (a harness named by a document
    // made elsewhere, say). Said in its words, as the CLI prints them.
    return (
      <div className="keep" role="group" aria-label="A package for a harness">
        {title}
        <div className="refusal" role="alert">
          <p>
            <strong>Cannot export for {attempt.target}: fix these first.</strong>
          </p>
          <pre className="issue-lines">{attempt.issues.map(formatIssue).join("\n")}</pre>
          <button type="button" className="btn" onClick={() => editor.openPanel({ type: "issues" })}>
            Show issues
          </button>
        </div>
      </div>
    );
  }

  const { files, kickoff, warnings } = attempt.result;
  const paths = Object.keys(files);
  return (
    <div className="keep" role="group" aria-label="A package for a harness">
      {title}
      <div className="export-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            download(packageFileName(doc, attempt.target), zipPackage(files), "application/zip");
            // Remembered so a later rename can warn that the package folder name changes (criterion 9).
            editor.markExported();
          }}
        >
          Download package (.zip)
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            setCopied((await copyText(kickoff)) ? "done" : "failed");
            setTimeout(() => setCopied("idle"), 2500);
          }}
        >
          {copied === "done" ? "Kickoff copied" : copied === "failed" ? "Copy failed" : "Copy kickoff prompt"}
        </button>
      </div>
      <p className="field-hint">
        Unzip at the root of the project the run works in, then paste the kickoff prompt into a {targetTitle(attempt.target)} session opened there.
      </p>

      {warnings.length > 0 ? (
        <div className="warnings">
          <p>
            {warnings.length} warning{warnings.length === 1 ? "" : "s"}, carried into the lead brief:
          </p>
          <pre className="issue-lines">{warnings.map(formatIssue).join("\n")}</pre>
        </div>
      ) : null}

      <h3 className="files-title">
        {paths.length} files for {attempt.target}
      </h3>
      <ul className="files">
        {paths.map((path) => (
          <li key={path}>
            <button type="button" className="file" aria-expanded={open === path} onClick={() => setOpen(open === path ? null : path)}>
              <span className="mono file-path">{path}</span>
              <span className="file-size">{bytes(files[path]!)}</span>
            </button>
            {open === path ? <pre className="file-body">{files[path]}</pre> : null}
          </li>
        ))}
      </ul>

      <details className="more">
        <summary>Kickoff prompt</summary>
        <pre className="file-body">{kickoff}</pre>
      </details>
    </div>
  );
}

const bytes = (text: string): string => {
  const n = new TextEncoder().encode(text).length;
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
};
