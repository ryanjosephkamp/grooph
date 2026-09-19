import { validate, type Graph } from "@grooph/core";
import { useEffect, useMemo, useState } from "react";

import { download } from "../../doc/exportPackage.js";
import { builtInTemplate, slotsOf, type TemplateSource } from "../../doc/templates.js";
import { deleteUserTemplate, getUserTemplate, templateFileName, templateFileText } from "../../store/templates.js";
import { GraphViewer } from "../open/GraphViewer.js";
import { ProfileChips } from "./ProfileChips.js";
import { templateHref } from "./TemplatesScreen.js";

/** A template by source and id: built-ins at once, yours from the device. `null` when there is none. */
export function useTemplate(source: TemplateSource, id: string): Graph | null | undefined {
  const [doc, setDoc] = useState<Graph | null | undefined>(() => (source === "built-in" ? (builtInTemplate(id) ?? null) : undefined));
  useEffect(() => {
    if (source === "built-in") return;
    let live = true;
    void getUserTemplate(id).then((found) => live && setDoc(found ?? null));
    return () => {
      live = false;
    };
  }, [source, id]);
  return doc;
}

export function TemplateMissing() {
  return (
    <div className="notfound">
      <p>This template is not on this device.</p>
      <a className="btn btn-primary" href="#/templates">
        Back to templates
      </a>
    </div>
  );
}

/** A template, read-only in the viewer, with what it is for and the slots it asks for (criterion 2). */
export function TemplateView({ source, id }: { source: TemplateSource; id: string }) {
  const doc = useTemplate(source, id);
  if (doc === undefined) return <div className="loading">Opening…</div>;
  if (doc === null) return <TemplateMissing />;
  return <TemplateViewer key={`${source}/${id}`} source={source} doc={doc} />;
}

function TemplateViewer({ source, doc }: { source: TemplateSource; doc: Graph }) {
  const t = doc.template!;
  // A template is checked as a document, not for export: the template block and its slots are what make it one.
  const issues = useMemo(() => validate(doc), [doc]);
  const fragment = t.kind === "fragment";

  const bar = (
    <div className="viewer-bar" role="region" aria-label="Use">
      {fragment ? (
        <span className="viewer-note">A fragment: open a graph, then Add → Insert a template.</span>
      ) : (
        <>
          <span className="viewer-note">Read-only. Use it to make a graph of your own.</span>
          <a className="btn btn-primary" href={templateHref(source, doc.id, true)}>
            Use
          </a>
        </>
      )}
    </div>
  );

  return (
    <GraphViewer
      doc={doc}
      back={{ href: "#/templates", label: "All templates" }}
      context={`${source === "yours" ? "your" : "built-in"} ${fragment ? "fragment" : "template"}`}
      issues={issues}
      about={{ title: t.title, subtitle: `${doc.id}@${doc.version}`, body: <TemplateDetails source={source} doc={doc} /> }}
      bar={bar}
    />
  );
}

function TemplateDetails({ source, doc }: { source: TemplateSource; doc: Graph }) {
  const t = doc.template!;
  const slots = slotsOf(doc);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="inspector template-details">
      <p className="prose">{t.summary}</p>
      {t.kind === "graph" ? (
        <a className="btn btn-primary template-use" href={templateHref(source, doc.id, true)}>
          Use this template
        </a>
      ) : (
        <p className="field-hint">A fragment: open a graph, then Add → Insert a template.</p>
      )}
      <ProfileChips profile={t.profile} />
      <dl className="readonly">
        <div className="readonly-row">
          <dt>Use when</dt>
          <dd>{t.whenToUse}</dd>
        </div>
        {t.notFor ? (
          <div className="readonly-row">
            <dt>Not for</dt>
            <dd>{t.notFor}</dd>
          </div>
        ) : null}
        {t.tags && t.tags.length > 0 ? (
          <div className="readonly-row">
            <dt>Tags</dt>
            <dd>{t.tags.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      <h3 className="files-title">{slots.length === 0 ? "No slots" : `${slots.length} slot${slots.length === 1 ? "" : "s"}`}</h3>
      {slots.length > 0 ? (
        <ul className="slot-list" aria-label="Slots">
          {slots.map((slot) => (
            <li key={slot.key}>
              <span className="slot-ask">{slot.ask}</span>
              <span className="mono slot-key">{`{{${slot.key}}}`}</span>
              {slot.example ? <span className="slot-example">e.g. {slot.example}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">It asks nothing: use it as it is.</p>
      )}

      {source === "yours" ? (
        <div className="export-actions">
          <button type="button" className="btn" onClick={() => download(templateFileName(doc), templateFileText(doc), "application/json")}>
            Download template (.grooph.json)
          </button>
          {confirm ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await deleteUserTemplate(doc.id);
                location.hash = "#/templates";
              }}
            >
              Delete for good
            </button>
          ) : (
            <button type="button" className="btn btn-danger-text" onClick={() => setConfirm(true)}>
              Delete template
            </button>
          )}
          <p className="field-hint">
            The same file a registry holds: put it in <span className="mono">.grooph/templates/</span>, or host it and run{" "}
            <span className="mono">grooph template add &lt;url&gt;</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
