import { KNOWN_TARGETS, optText, setConstraint, setGraphField, setGraphName, setPositions, setTarget } from "@grooph/core";
import { useState } from "react";

import { resolvePositions } from "../../doc/layout.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { Section, Select, TextArea, TextInput } from "../fields.js";
import { IdField } from "./IdField.js";

const OTHER = "__other";

/** Graph-level fields (criterion 3), plus a read-only account of what this view cannot edit yet. */
export function GraphInspector({ autoFocusName }: { autoFocusName?: boolean }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const harness = doc.target?.harness;
  const known = harness === undefined || KNOWN_TARGETS.includes(harness) || harness === "codex";
  const [other, setOther] = useState(!known);
  const { unplaced } = resolvePositions(doc);

  return (
    <div className="inspector">
      <TextInput
        label="Name"
        value={doc.name}
        autoFocus={autoFocusName}
        onChange={(v) => editor.store.update((d) => setGraphName(d, v))}
      />
      <IdField id={doc.id} name={doc.name} graph />
      <TextArea
        label="Goal"
        value={doc.goal ?? ""}
        rows={3}
        placeholder="What the run must achieve. Required for export."
        onChange={(v) => editor.store.update((d) => setGraphField(d, "goal", optText(v)))}
      />
      <Select
        label="Target harness"
        value={other ? OTHER : (harness ?? "")}
        options={[
          { value: "", label: "(choose)" },
          { value: "claude-code", label: "Claude Code" },
          { value: "codex", label: "Codex (no compiler yet)" },
          { value: OTHER, label: "other…" },
        ]}
        hint="Export compiles for this harness. Claude Code is the one compile target today."
        onChange={(v) => {
          setOther(v === OTHER);
          if (v !== OTHER) editor.store.update((d) => setTarget(d, v === "" ? undefined : v));
        }}
      />
      {other ? (
        <TextInput
          label="Harness id"
          value={harness ?? ""}
          mono
          onChange={(v) => editor.store.update((d) => setTarget(d, optText(v)))}
        />
      ) : null}

      <Section title="Constraints">
        <TextInput
          label="Budget"
          value={doc.constraints?.budget ?? ""}
          placeholder="about 40 lead turns"
          onChange={(v) => editor.store.update((d) => setConstraint(d, "budget", optText(v)))}
        />
        <TextInput
          label="Time"
          value={doc.constraints?.time ?? ""}
          onChange={(v) => editor.store.update((d) => setConstraint(d, "time", optText(v)))}
        />
        <TextArea
          label="Other"
          value={doc.constraints?.other ?? ""}
          rows={2}
          onChange={(v) => editor.store.update((d) => setConstraint(d, "other", optText(v)))}
        />
      </Section>

      <TextArea
        label="Description"
        value={doc.description ?? ""}
        rows={3}
        placeholder="One paragraph a human or an executive can read."
        onChange={(v) => editor.store.update((d) => setGraphField(d, "description", optText(v)))}
      />

      <Section title="Loops">
        {doc.loops.length === 0 ? <p className="field-hint">No loops yet. Use Loop in the toolbar.</p> : null}
        <div className="chips">
          {doc.loops.map((loop) => (
            <button key={loop.id} type="button" className="chip" onClick={() => editor.openPanel({ type: "loop", id: loop.id })}>
              {loop.name || loop.id}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Layout">
        <p className="field-hint">
          {unplaced.length === 0
            ? "Every node's position is saved in the document."
            : doc.layout
              ? `${unplaced.length} node${unplaced.length === 1 ? " is" : "s are"} placed automatically and not saved yet.`
              : "Placed automatically. Positions are saved when you move a node, or now:"}
        </p>
        {unplaced.length > 0 ? (
          <button
            type="button"
            className="btn"
            onClick={() => editor.store.update((d) => setPositions(d, resolvePositions(d).positions))}
          >
            Save layout
          </button>
        ) : null}
      </Section>

      <Section title="In the document, not editable here yet">
        <dl className="readonly">
          <dt>Version</dt>
          <dd>{doc.version}</dd>
          {doc.lineage?.pattern ? (
            <>
              <dt>Pattern</dt>
              <dd className="mono">{doc.lineage.pattern}</dd>
            </>
          ) : null}
          {doc.lineage?.from ? (
            <>
              <dt>Derived from</dt>
              <dd className="mono">{doc.lineage.from}</dd>
            </>
          ) : null}
          <dt>Policies</dt>
          <dd>
            {(doc.policies ?? []).length === 0
              ? "none"
              : (doc.policies ?? []).map((p) => (
                  <span key={p.id} className="mono readonly-item">
                    {typeof p.kind === "string" ? p.kind : `custom: ${p.kind.custom}`} ({p.scope})
                  </span>
                ))}
          </dd>
          <dt>Groups</dt>
          <dd>{(doc.groups ?? []).length === 0 ? "none" : (doc.groups ?? []).map((g) => g.name).join(", ")}</dd>
          <dt>Run notes</dt>
          <dd>{(doc.notes ?? []).length}</dd>
        </dl>
      </Section>
    </div>
  );
}
