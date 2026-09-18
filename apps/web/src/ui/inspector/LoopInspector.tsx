import { indexGraph, loopMode, type Bar, type Evidence, type Graph, type Id, type Loop, type Stop, type StopKind } from "@grooph/core";
import { useState } from "react";

import { BUDGET_MEASURES, EVIDENCE_KINDS, STOP_KINDS, STOP_LABEL } from "../../doc/catalog.js";
import {
  addStop,
  moveStop,
  newStop,
  optText,
  removeLoop,
  removeStop,
  setBar,
  setLoopName,
  setStop,
  toggleLoopBack,
  toggleLoopMember,
  updateLoop,
  withField,
} from "../../doc/ops.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { NumberInput, Section, Segmented, Select, TextArea, TextInput } from "../fields.js";
import { IdField } from "./IdField.js";

export function LoopInspector({ id }: { id: Id }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const loop = doc.loops.find((l) => l.id === id);
  if (!loop) return <p className="empty">This loop is no longer in the graph.</p>;

  const set = (fn: (l: Loop) => Loop) => editor.store.update((d) => updateLoop(d, id, fn));
  const picking = editor.mode.type === "pick" && editor.mode.loopId === id;
  const inferred = loopMode(indexGraph(doc), { ...loop, mode: undefined });
  const members = new Set(loop.members);
  const candidateBack = doc.edges.filter((e) => (members.has(e.from) && members.has(e.to)) || loop.back.includes(e.id));
  const nameOf = (nodeId: Id) => doc.nodes.find((n) => n.id === nodeId)?.name ?? nodeId;

  return (
    <div className="inspector">
      <TextInput
        label="Name"
        value={loop.name}
        onChange={(name) => {
          const result = editor.store.updateWith((d) => setLoopName(d, id, name));
          if (result.id !== id) {
            editor.openPanel({ type: "loop", id: result.id });
            if (picking) editor.setMode({ type: "pick", loopId: result.id });
          }
        }}
      />
      <IdField id={id} name={loop.name} onRenamed={(next) => editor.openPanel({ type: "loop", id: next })} />

      <Section
        title="Members and back edges"
        aside={
          <button
            type="button"
            className={picking ? "btn btn-primary" : "btn"}
            aria-pressed={picking}
            onClick={() => editor.setMode(picking ? { type: "idle" } : { type: "pick", loopId: id })}
          >
            {picking ? "Done picking" : "Pick on canvas"}
          </button>
        }
      >
        <p className="field-hint">
          {picking
            ? "Tap nodes to add or remove members. Tap an edge's label to mark it as a back edge."
            : "The cycle lives inside the members; a back edge returns work to an earlier member."}
        </p>
        <div className="field">
          <div className="field-label">Members</div>
          <div className="chips">
            {doc.nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-pressed={members.has(n.id)}
                className={members.has(n.id) ? "chip chip-on" : "chip"}
                onClick={() => editor.store.update((d) => toggleLoopMember(d, id, n.id))}
              >
                {n.name || n.id}
              </button>
            ))}
            {doc.nodes.length === 0 ? <span className="field-hint">No nodes yet.</span> : null}
          </div>
        </div>
        <div className="field">
          <div className="field-label">Back edges</div>
          <div className="chips">
            {candidateBack.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={loop.back.includes(e.id)}
                className={loop.back.includes(e.id) ? "chip chip-on" : "chip"}
                onClick={() => editor.store.update((d) => toggleLoopBack(d, id, e.id))}
              >
                {nameOf(e.from)} → {nameOf(e.to)}
              </button>
            ))}
            {candidateBack.length === 0 ? <span className="field-hint">Add members first; edges between them appear here.</span> : null}
          </div>
        </div>
      </Section>

      <Segmented
        label="Mode"
        value={loop.mode ?? "auto"}
        options={[
          { value: "auto", label: `auto (${inferred})` },
          { value: "judgment", label: "judgment" },
          { value: "grind", label: "grind" },
        ]}
        hint="Judgment loops need a bar. Auto: grind when every back edge starts at a check node."
        onChange={(v) => set((l) => withField(l, "mode", v === "auto" ? undefined : v))}
      />

      <BarSection doc={doc} loop={loop} />
      <StopsSection doc={doc} loop={loop} />

      <div className="danger-zone">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            editor.store.update((d) => removeLoop(d, id));
            editor.setMode({ type: "idle" });
            editor.openPanel(null);
          }}
        >
          Delete loop
        </button>
        <p className="field-hint">The nodes and edges stay; only the loop goes.</p>
      </div>
    </div>
  );
}

function BarSection({ doc, loop }: { doc: Graph; loop: Loop }) {
  const editor = useEditor();
  const bar = loop.bar;
  const put = (next: Bar | undefined) => editor.store.update((d) => setBar(d, loop.id, next));
  if (!bar) {
    return (
      <Section title="Bar">
        <p className="field-hint">What “good enough to stop” is, and what a critic inspects to decide it.</p>
        <button type="button" className="btn" onClick={() => put({ name: "", inspects: [], acceptance: "" })}>
          Add bar
        </button>
      </Section>
    );
  }
  const setInspect = (i: number, fn: (e: Evidence) => Evidence) =>
    put({ ...bar, inspects: bar.inspects.map((e, j) => (j === i ? fn(e) : e)) });
  return (
    <Section
      title="Bar"
      aside={
        <button type="button" className="btn btn-quiet" onClick={() => put(undefined)}>
          Remove bar
        </button>
      }
    >
      <TextInput label="Bar name" value={bar.name} onChange={(v) => put({ ...bar, name: v })} />
      <div className="field">
        <div className="field-label">Inspects</div>
        {bar.inspects.map((entry, i) => (
          <div className="card" key={i} role="group" aria-label={`Evidence ${i + 1}`}>
            <Select
              label="Kind"
              value={entry.kind}
              options={EVIDENCE_KINDS.map((k) => ({ value: k, label: k }))}
              onChange={(v) => setInspect(i, (e) => ({ ...e, kind: v }))}
            />
            <TextInput label="Ref" value={entry.ref} mono onChange={(v) => setInspect(i, (e) => ({ ...e, ref: v }))} />
            <TextInput label="Note" value={entry.note ?? ""} onChange={(v) => setInspect(i, (e) => withField(e, "note", optText(v)))} />
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => put({ ...bar, inspects: bar.inspects.filter((_, j) => j !== i) })}
            >
              Remove evidence
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => put({ ...bar, inspects: [...bar.inspects, { kind: "file", ref: "" }] })}>
          Add evidence
        </button>
        <div className="field-hint">An adjective is not a bar: name a file, url, metric, checklist or artifact.</div>
      </div>
      <TextArea
        label="Acceptance"
        value={bar.acceptance}
        placeholder="Reachable “good enough to stop”."
        onChange={(v) => put({ ...bar, acceptance: v })}
      />
      <TextArea
        label="Aspiration"
        value={bar.aspiration ?? ""}
        placeholder="Optional. Directional; never the stop condition."
        onChange={(v) => put(withField(bar, "aspiration", optText(v)))}
      />
      <Select
        label="Answer key from"
        value={bar.answerKeyFrom ?? ""}
        options={[{ value: "", label: "(none)" }, ...doc.nodes.map((n) => ({ value: n.id, label: n.name || n.id }))]}
        onChange={(v) => put(withField(bar, "answerKeyFrom", v === "" ? undefined : v))}
      />
    </Section>
  );
}

function StopsSection({ doc, loop }: { doc: Graph; loop: Loop }) {
  const editor = useEditor();
  const [adding, setAdding] = useState<StopKind>(loop.stops.some((s) => s.kind === "bar-passed") ? "max-iterations" : "bar-passed");
  const put = (i: number, stop: Stop) => editor.store.update((d) => setStop(d, loop.id, i, stop));
  const nodeOptions = [{ value: "", label: "(default)" }, ...doc.nodes.map((n) => ({ value: n.id, label: n.name || n.id }))];

  return (
    <Section title="Stops">
      <p className="field-hint">Checked after every pass, in this order; the first that fires wins.</p>
      {loop.stops.map((stop, i) => (
        <div className="card" key={i} role="group" aria-label={`Stop ${i + 1}`} data-stop-kind={stop.kind}>
          <div className="card-head">
            <span className="card-index">{i + 1}</span>
            <Select
              label="Stop"
              value={stop.kind}
              options={STOP_KINDS.map((k) => ({ value: k, label: STOP_LABEL[k] }))}
              onChange={(v) => put(i, newStop(v, stop))}
            />
          </div>
          <StopFields stop={stop} onChange={(s) => put(i, s)} />
          <Select
            label="Then continue at"
            value={stop.then ?? ""}
            options={nodeOptions}
            onChange={(v) => put(i, withField(stop, "then", v === "" ? undefined : v))}
          />
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-quiet"
              disabled={i === 0}
              aria-label={`Move stop ${i + 1} up`}
              onClick={() => editor.store.update((d) => moveStop(d, loop.id, i, -1))}
            >
              Up
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={i === loop.stops.length - 1}
              aria-label={`Move stop ${i + 1} down`}
              onClick={() => editor.store.update((d) => moveStop(d, loop.id, i, 1))}
            >
              Down
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-danger-text"
              aria-label={`Remove stop ${i + 1}`}
              onClick={() => editor.store.update((d) => removeStop(d, loop.id, i))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="inline-add">
        <select
          className="input select"
          aria-label="Stop kind to add"
          value={adding}
          onChange={(e) => setAdding(e.target.value as StopKind)}
        >
          {STOP_KINDS.map((k) => (
            <option key={k} value={k}>
              {STOP_LABEL[k]}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => editor.store.update((d) => addStop(d, loop.id, adding))}>
          Add stop
        </button>
      </div>
    </Section>
  );
}

function StopFields({ stop, onChange }: { stop: Stop; onChange: (stop: Stop) => void }) {
  switch (stop.kind) {
    case "human":
      return (
        <NumberInput
          label="Ask every N rounds"
          integer
          value={stop.every}
          placeholder="only at the end"
          onChange={(v) => onChange(withField(stop, "every", v))}
        />
      );
    case "budget":
      return (
        <>
          <Segmented
            label="Measure"
            value={stop.measure}
            options={BUDGET_MEASURES.map((m) => ({ value: m, label: m }))}
            onChange={(v) => onChange({ ...stop, measure: v })}
          />
          <NumberInput label="Limit" value={stop.limit} onChange={(v) => onChange(v === undefined ? omit(stop, "limit") : { ...stop, limit: v })} />
        </>
      );
    case "bar-passed":
      return <p className="field-hint">Fires when the bar's acceptance is met; then the loop's pass edges are followed.</p>;
    case "diminishing-returns":
      return (
        <>
          <NumberInput label="Rounds" integer value={stop.rounds} onChange={(v) => onChange(v === undefined ? omit(stop, "rounds") : { ...stop, rounds: v })} />
          <TextInput label="Metric" value={stop.metric ?? ""} onChange={(v) => onChange(withField(stop, "metric", optText(v)))} />
          <NumberInput label="Threshold" value={stop.threshold} onChange={(v) => onChange(withField(stop, "threshold", v))} />
        </>
      );
    case "evidence-invalid":
      return <NumberInput label="Rounds" integer value={stop.rounds} onChange={(v) => onChange(v === undefined ? omit(stop, "rounds") : { ...stop, rounds: v })} />;
    case "max-iterations":
      return <NumberInput label="Rounds at most" integer value={stop.n} onChange={(v) => onChange(v === undefined ? omit(stop, "n") : { ...stop, n: v })} />;
  }
}

/**
 * Clearing a required number removes the key, so the schema reports it rather
 * than the app inventing a value.
 */
const omit = <S extends Stop>(stop: S, key: string): Stop => {
  const next = { ...stop } as Record<string, unknown>;
  delete next[key];
  return next as Stop;
};
