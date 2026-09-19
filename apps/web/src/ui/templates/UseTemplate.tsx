import { TemplateError, instantiate, type Graph } from "@grooph/core";
import { useState } from "react";

import { filledValues, graphIdFor, slotsOf, type TemplateSource } from "../../doc/templates.js";
import { importGraph, listGraphs } from "../../store/library.js";
import { TextArea, TextInput } from "../fields.js";
import { TemplateMissing, useTemplate } from "./TemplateView.js";
import { templateHref } from "./TemplatesScreen.js";

/**
 * "Use" (handoff 0007, criterion 3): a name for the graph and an answer per
 * slot, each optional. Core's `instantiate` makes the graph; a slot left
 * empty stays as `{{key}}`, and the editor's validation panel shows it as
 * `E_UNFILLED_SLOT` until it is filled.
 */
export function UseTemplate({ source, id }: { source: TemplateSource; id: string }) {
  const doc = useTemplate(source, id);
  if (doc === undefined) return <div className="loading">Opening…</div>;
  if (doc === null) return <TemplateMissing />;
  return <UseForm source={source} template={doc} />;
}

function UseForm({ source, template }: { source: TemplateSource; template: Graph }) {
  const t = template.template!;
  const slots = slotsOf(template);
  const [name, setName] = useState(t.title);
  const [values, setValues] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const empty = slots.filter((slot) => (values[slot.key] ?? "").trim() === "").length;

  const create = async () => {
    setBusy(true);
    try {
      const graphName = name.trim() || t.title;
      const ids = new Set((await listGraphs()).map((r) => r.doc.id));
      const doc = instantiate(template, { name: graphName, values: filledValues(values), id: graphIdFor(graphName, template, ids) });
      const record = await importGraph(doc);
      location.hash = `#/g/${encodeURIComponent(record.key)}`;
    } catch (err) {
      if (!(err instanceof TemplateError)) throw err;
      setProblem(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="library use-template">
      <header className="screen-head">
        <a className="icon-btn" href={templateHref(source, template.id)} aria-label={`Back to ${t.title}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <div>
          <span className="overline">Use a template</span>
          <h1>{t.title}</h1>
        </div>
      </header>

      <form
        className="use-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void create();
        }}
      >
        <TextInput label="Graph name" value={name} onChange={setName} hint="The graph's id follows it." />

        {slots.length > 0 ? (
          <fieldset className="slots">
            <legend className="list-title">What it needs to know</legend>
            <p className="field-hint">Any of these can wait: an empty one stays marked in the graph, and export waits until it is filled.</p>
            {slots.map((slot) => (
              <TextArea
                key={slot.key}
                label={slot.ask}
                value={values[slot.key] ?? ""}
                rows={2}
                placeholder={slot.example}
                hint={<span className="mono">{`{{${slot.key}}}`}</span>}
                onChange={(v) => setValues((prev) => ({ ...prev, [slot.key]: v }))}
              />
            ))}
          </fieldset>
        ) : (
          <p className="field-hint">This template asks nothing more.</p>
        )}

        {problem ? (
          <p className="refusal" role="alert">
            {problem}
          </p>
        ) : null}

        <div className="use-actions">
          <button type="submit" className="btn btn-primary btn-large" disabled={busy}>
            Create graph
          </button>
          <p className="field-hint" role="status">
            {empty === 0 ? "Every slot is filled." : `${empty} slot${empty === 1 ? "" : "s"} left empty, to fill in the editor.`}
          </p>
        </div>
      </form>
    </div>
  );
}
