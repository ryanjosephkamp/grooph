import type { Edge, EdgeWhen, Id } from "@grooph/core";

import { optList, optText, removeEdge, updateEdge, withField } from "../../doc/ops.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { ListInput, More, NumberInput, Segmented, TextInput, Toggle } from "../fields.js";
import { IdField } from "./IdField.js";

type WhenChoice = "always" | "pass" | "fail" | "verdict";

export function EdgeInspector({ id }: { id: Id }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const edge = doc.edges.find((e) => e.id === id);
  if (!edge) return <p className="empty">This edge is no longer in the graph.</p>;

  const set = (fn: (e: Edge) => Edge) => editor.store.update((d) => updateEdge(d, id, fn));
  const nameOf = (nodeId: Id) => doc.nodes.find((n) => n.id === nodeId)?.name ?? nodeId;
  const when: EdgeWhen = edge.when ?? "always";
  const whenChoice: WhenChoice = typeof when === "string" ? when : "verdict";
  const backOf = doc.loops.filter((l) => l.back.includes(id));

  return (
    <div className="inspector">
      <p className="edge-route">
        <button type="button" className="link" onClick={() => editor.openPanel({ type: "node", id: edge.from })}>
          {nameOf(edge.from)}
        </button>
        <span aria-hidden="true"> → </span>
        <span className="sr-only"> to </span>
        <button type="button" className="link" onClick={() => editor.openPanel({ type: "node", id: edge.to })}>
          {nameOf(edge.to)}
        </button>
      </p>
      {backOf.length > 0 ? (
        <div className="inspector-actions">
          {backOf.map((loop) => (
            <button key={loop.id} type="button" className="btn btn-quiet" onClick={() => editor.openPanel({ type: "loop", id: loop.id })}>
              Back edge of {loop.name}
            </button>
          ))}
        </div>
      ) : null}

      <Segmented<WhenChoice>
        label="When"
        value={whenChoice}
        options={[
          { value: "always", label: "always" },
          { value: "pass", label: "pass" },
          { value: "fail", label: "fail" },
          { value: "verdict", label: "verdict…" },
        ]}
        hint={whenChoice === "always" && edge.when === undefined ? "Default: always." : undefined}
        onChange={(v) =>
          set((e) =>
            withField(e, "when", v === "verdict" ? { verdict: typeof e.when === "object" ? e.when.verdict : "" } : v),
          )
        }
      />
      {typeof when === "object" ? (
        <TextInput
          label="Verdict label"
          value={when.verdict}
          mono
          placeholder="needs-evidence"
          onChange={(v) => set((e) => ({ ...e, when: { verdict: v } }))}
        />
      ) : null}
      <Segmented
        label="Isolation"
        value={edge.isolation ?? "default"}
        options={[
          { value: "default", label: "default" },
          { value: "fresh", label: "fresh" },
          { value: "shared", label: "shared" },
        ]}
        hint="Fresh (the default): the next worker sees only its brief, its inputs and the evidence below."
        onChange={(v) => set((e) => withField(e, "isolation", v === "default" ? undefined : v))}
      />
      <ListInput
        label="Evidence"
        value={edge.evidence}
        hint="One per line. What the downstream node may inspect; everything else is hidden."
        onChange={(v) => set((e) => withField(e, "evidence", optList(v)))}
      />
      <Toggle
        label="Needs human approval"
        checked={edge.approval === true}
        onChange={(v) => set((e) => withField(e, "approval", v ? true : undefined))}
      />

      <More>
        <IdField id={id} onRenamed={(next) => editor.openPanel({ type: "edge", id: next })} />
        <TextInput label="Label" value={edge.label ?? ""} onChange={(v) => set((e) => withField(e, "label", optText(v)))} />
        <NumberInput
          label="Concurrency cap"
          integer
          value={edge.concurrency?.max}
          onChange={(v) => set((e) => withField(e, "concurrency", v === undefined ? undefined : { max: v }))}
        />
        <NumberInput
          label="Retries"
          integer
          value={edge.retry?.max}
          onChange={(v) => set((e) => withField(e, "retry", v === undefined ? undefined : { max: v }))}
        />
      </More>

      <div className="danger-zone">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            editor.store.update((d) => removeEdge(d, id));
            editor.openPanel(null);
          }}
        >
          Delete edge
        </button>
      </div>
    </div>
  );
}
