import { formatIssue } from "@grooph/core";
import { useMemo, useState } from "react";

import {
  attemptExport,
  copyText,
  download,
  graphFileName,
  graphFileText,
  packageFileName,
  zipPackage,
} from "../doc/exportPackage.js";
import { useDoc } from "../doc/store.js";
import { useEditor } from "./editorContext.js";

/**
 * Export (spec §9): refused with the error list when the graph does not
 * validate, as the CLI refuses; otherwise the files `compile()` emits, as a
 * zip, plus the kickoff prompt on the clipboard in one tap.
 */
export function ExportPanel() {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const attempt = useMemo(() => attemptExport(doc), [doc]);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [open, setOpen] = useState<string | null>(null);

  const downloadGraph = (
    <button
      type="button"
      className="btn"
      onClick={() => download(graphFileName(doc), graphFileText(doc), "application/json")}
    >
      Download graph (.grooph.json)
    </button>
  );

  if (!attempt.ok) {
    const errors = attempt.issues.filter((i) => i.severity === "error");
    return (
      <div className="inspector">
        <div className="refusal" role="alert">
          <p>
            <strong>Cannot export for {attempt.target}: fix these first.</strong>
          </p>
          <p className="field-hint">
            {attempt.reason === "schema"
              ? "The document does not match the graph schema yet."
              : `${errors.length} validation error${errors.length === 1 ? "" : "s"} — ${errors.map((i) => i.code).join(", ")}`}
          </p>
          <pre className="issue-lines">{attempt.issues.map(formatIssue).join("\n")}</pre>
          <button type="button" className="btn" onClick={() => editor.openPanel({ type: "issues" })}>
            Show issues
          </button>
        </div>
        <div className="export-actions">{downloadGraph}</div>
      </div>
    );
  }

  const { files, kickoff, warnings } = attempt.result;
  const paths = Object.keys(files);
  return (
    <div className="inspector">
      <div className="export-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => download(packageFileName(doc, attempt.target), zipPackage(files), "application/zip")}
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
        {downloadGraph}
      </div>
      <p className="field-hint">
        Unzip at the root of the project the run works in, then paste the kickoff prompt into a Claude Code session opened there.
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
