import { TemplateError, insertFragment, type Graph, type Id } from "@grooph/core";
import { useEffect, useState } from "react";

import { emptyHighlight } from "../../doc/issues.js";
import { BUILT_IN_TEMPLATES, filledValues, slotsOf, type TemplateEntry } from "../../doc/templates.js";
import { listUserTemplates } from "../../store/templates.js";
import { useEditor } from "../editorContext.js";
import { TextArea, TextInput } from "../fields.js";

type Inserted = { title: string; ids: Record<Id, Id>; nodes: Id[]; edges: number; loops: number };

/** Fragments first (they are made for inserting), then whole-graph templates; yours before the built-ins in each. */
function insertable(yours: Graph[]): TemplateEntry[] {
  const all: TemplateEntry[] = [
    ...yours.map((doc) => ({ source: "yours" as const, doc })),
    ...BUILT_IN_TEMPLATES.map((doc) => ({ source: "built-in" as const, doc })),
  ];
  const rank = (e: TemplateEntry): number => (e.doc.template?.kind === "fragment" ? 0 : 1);
  return all.sort((a, b) => rank(a) - rank(b));
}

/**
 * Insert a template into the open graph (handoff 0007, criterion 4), through
 * core's `insertFragment`: fragments, and whole graphs as a subgraph. Its
 * slots may be answered or left for later. Afterwards the id map is shown
 * once, and the new nodes are selected and brought into view.
 */
export function InsertPanel() {
  const editor = useEditor();
  const [yours, setYours] = useState<Graph[] | null>(null);
  const [chosen, setChosen] = useState<TemplateEntry | null>(null);
  const [inserted, setInserted] = useState<Inserted | null>(null);

  useEffect(() => {
    let live = true;
    void listUserTemplates().then((list) => live && setYours(list));
    return () => {
      live = false;
    };
  }, []);

  if (inserted) return <InsertedMap inserted={inserted} onDone={() => editor.openPanel(null)} />;

  if (chosen) {
    return (
      <InsertForm
        entry={chosen}
        onBack={() => setChosen(null)}
        onInsert={(values, prefix) => {
          const template = chosen.doc;
          const result = editor.store.updateWith((d) => insertFragment(d, template, { values, prefix }));
          const nodes = template.nodes.map((n) => result.ids[n.id]!).filter(Boolean);
          const h = emptyHighlight();
          for (const id of nodes) h.nodes.add(id);
          editor.setHighlight(h);
          editor.setSelection(nodes);
          editor.reveal(nodes);
          setInserted({ title: template.template!.title, ids: result.ids, nodes, edges: template.edges.length, loops: template.loops.length });
        }}
      />
    );
  }

  if (yours === null) return <div className="inspector" />;
  return (
    <div className="inspector">
      <p className="field-hint">Its nodes join this graph unconnected; ids that are taken here get a number. Connect them where they belong.</p>
      <ul className="insert-list" aria-label="Templates to insert">
        {insertable(yours).map((entry) => {
          const t = entry.doc.template!;
          return (
            <li key={`${entry.source}/${entry.doc.id}`}>
              <button type="button" className="insert-row" onClick={() => setChosen(entry)}>
                <span className="template-title">
                  {t.title}
                  <span className="badge badge-quiet">{t.kind === "fragment" ? "fragment" : `graph · ${entry.doc.nodes.length} nodes`}</span>
                  {entry.source === "yours" ? <span className="badge badge-quiet">yours</span> : null}
                </span>
                <span className="insert-summary">{t.summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InsertForm({ entry, onBack, onInsert }: { entry: TemplateEntry; onBack: () => void; onInsert: (values: Record<string, string>, prefix?: string) => void }) {
  const t = entry.doc.template!;
  const slots = slotsOf(entry.doc);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prefix, setPrefix] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="inspector"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onInsert(filledValues(values), prefix.trim() === "" ? undefined : prefix.trim());
        } catch (err) {
          if (!(err instanceof TemplateError)) throw err;
          setProblem(err.message);
        }
      }}
    >
      <p className="insert-chosen">
        <strong>{t.title}</strong> — {t.summary}
      </p>
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
      <TextInput label="Id prefix (optional)" value={prefix} mono placeholder="ship" onChange={setPrefix} hint="Prefix every id it brings in, as ship-gate." />
      {problem ? (
        <p className="refusal" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="export-actions">
        <button type="submit" className="btn btn-primary">
          Insert {t.kind === "fragment" ? "fragment" : "as a subgraph"}
        </button>
        <button type="button" className="btn" onClick={onBack}>
          Choose another
        </button>
      </div>
    </form>
  );
}

function InsertedMap({ inserted, onDone }: { inserted: Inserted; onDone: () => void }) {
  const entries = Object.entries(inserted.ids);
  const renamed = entries.filter(([from, to]) => from !== to).length;
  return (
    <div className="inspector" role="status">
      <p className="all-clear">
        Inserted {inserted.title}: {inserted.nodes.length} node{inserted.nodes.length === 1 ? "" : "s"}, {inserted.edges} edge{inserted.edges === 1 ? "" : "s"},{" "}
        {inserted.loops} loop{inserted.loops === 1 ? "" : "s"}. {renamed === 0 ? "Every id kept its name." : `${renamed} id${renamed === 1 ? "" : "s"} changed to fit this graph.`}
      </p>
      <h3 className="files-title">Where each id landed</h3>
      <ul className="id-map" aria-label="Id map">
        {entries.map(([from, to]) => (
          <li key={from} className={from === to ? undefined : "is-renamed"}>
            <span className="mono">{from}</span> → <span className="mono">{to}</span>
          </li>
        ))}
      </ul>
      <p className="field-hint">The new nodes are highlighted on the canvas. This list is not kept.</p>
      <div className="export-actions">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
