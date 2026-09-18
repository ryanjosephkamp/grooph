import type { AgentNode, CheckNode, Graph, HumanGateNode, Id, MergeNode, Node, Role, StopNode } from "@grooph/core";

import {
  CAPABILITIES,
  CHECK_KINDS,
  EFFORTS,
  IRREVERSIBLE,
  KIND_LABEL,
  ROLES,
  TIERS,
} from "../../doc/catalog.js";
import { optList, optText, removeNode, setNodeName, updateNode, withField } from "../../doc/ops.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { ChipSet, ListInput, More, NumberInput, Segmented, Select, TextArea, TextInput, Toggle } from "../fields.js";
import { IdField } from "./IdField.js";
import { PinsField } from "./PinsField.js";

export function NodeInspector({ id }: { id: Id }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const node = doc.nodes.find((n) => n.id === id);
  if (!node) return <p className="empty">This node is no longer in the graph.</p>;

  const update = (fn: (n: Node) => Node) => editor.store.update((d) => updateNode(d, id, fn));
  const loops = doc.loops.filter((l) => l.members.includes(id));

  return (
    <div className="inspector">
      <div className="inspector-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            editor.setMode({ type: "connect", from: id });
          }}
        >
          Connect from here
        </button>
        {loops.map((loop) => (
          <button key={loop.id} type="button" className="btn btn-quiet" onClick={() => editor.openPanel({ type: "loop", id: loop.id })}>
            Loop: {loop.name}
          </button>
        ))}
      </div>

      <TextInput
        label="Name"
        value={node.name}
        onChange={(name) => {
          const result = editor.store.updateWith((d) => setNodeName(d, id, name));
          if (result.id !== id) editor.openPanel({ type: "node", id: result.id });
        }}
      />
      <IdField id={id} name={node.name} onRenamed={(next) => editor.openPanel({ type: "node", id: next })} />

      {node.kind === "agent" ? <AgentFields node={node} update={update} /> : null}
      {node.kind === "human-gate" ? <GateFields node={node} update={update} /> : null}
      {node.kind === "check" ? <CheckFields node={node} update={update} /> : null}
      {node.kind === "merge" ? <MergeFields node={node} update={update} /> : null}
      {node.kind === "stop" ? <StopFields node={node} update={update} /> : null}

      <More>
        <TextArea
          label="Description"
          value={node.description ?? ""}
          onChange={(v) => update((n) => withField(n, "description", optText(v)))}
        />
        <Toggle
          label="Coupled"
          checked={node.coupled === true}
          hint="Work that should not be fanned out."
          onChange={(v) => update((n) => withField(n, "coupled", v ? true : undefined))}
        />
        {node.kind === "agent" ? <PinsField node={node} update={update} /> : null}
      </More>

      <div className="danger-zone">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            editor.store.update((d: Graph) => removeNode(d, id));
            editor.openPanel(null);
          }}
        >
          Delete {KIND_LABEL[node.kind].toLowerCase()}
        </button>
        <p className="field-hint">Also removes its edges and its place in loops.</p>
      </div>
    </div>
  );
}

type Update = (fn: (n: Node) => Node) => void;
const as = <N extends Node>(fn: (n: N) => N) => (n: Node) => fn(n as N);

const CUSTOM = "__custom";

function AgentFields({ node, update }: { node: AgentNode; update: Update }) {
  const set = (fn: (n: AgentNode) => AgentNode) => update(as(fn));
  const custom = typeof node.role !== "string";
  return (
    <>
      <Select
        label="Role"
        value={custom ? CUSTOM : (node.role as Role)}
        options={[...ROLES.map((r) => ({ value: r as string, label: r })), { value: CUSTOM, label: "custom…" }]}
        onChange={(v) => set((n) => ({ ...n, role: v === CUSTOM ? { custom: custom ? (n.role as { custom: string }).custom : "" } : (v as Role) }))}
      />
      {custom ? (
        <TextInput
          label="Custom role"
          value={(node.role as { custom: string }).custom}
          onChange={(v) => set((n) => ({ ...n, role: { custom: v } }))}
          hint="A custom role joins no family unless the node owns artifacts (then it is a writer)."
        />
      ) : null}
      <Segmented
        label="Model tier"
        value={node.model?.tier ?? "default"}
        options={[
          // A pin needs a tier beside it, so "default" is offered only when there is none.
          ...(node.model?.pin ? [] : [{ value: "default" as const, label: "default" }]),
          ...TIERS.map((t) => ({ value: t, label: t })),
        ]}
        onChange={(v) => set((n) => withField(n, "model", v === "default" ? undefined : { ...n.model, tier: v }))}
      />
      <Segmented
        label="Effort"
        value={node.effort ?? "default"}
        options={[{ value: "default", label: "default" }, ...EFFORTS.map((e) => ({ value: e, label: e }))]}
        onChange={(v) => set((n) => withField(n, "effort", v === "default" ? undefined : v))}
      />
      <TextArea
        label="Brief"
        value={node.brief}
        rows={4}
        placeholder="What this node may and may not do."
        onChange={(v) => set((n) => ({ ...n, brief: v }))}
      />
      <ListInput label="Inputs" value={node.inputs} onChange={(v) => set((n) => withField(n, "inputs", optList(v)))} />
      <ListInput
        label="Outputs"
        value={node.outputs}
        hint="One per line. At least one: what it must leave behind."
        onChange={(v) => set((n) => ({ ...n, outputs: v }))}
      />
      <ChipSet label="Allow" value={node.allow} catalog={CAPABILITIES} onChange={(v) => set((n) => withField(n, "allow", optList(v)))} />
      <ChipSet label="Deny" value={node.deny} catalog={CAPABILITIES} onChange={(v) => set((n) => withField(n, "deny", optList(v)))} />
      <ListInput
        label="Owns"
        value={node.owns}
        hint="One artifact id per line. Only this node writes them."
        onChange={(v) => set((n) => withField(n, "owns", optList(v)))}
      />
      <ChipSet
        label="Irreversible actions"
        value={node.irreversible}
        catalog={IRREVERSIBLE}
        onChange={(v) => set((n) => withField(n, "irreversible", optList(v)))}
      />
    </>
  );
}

function GateFields({ node, update }: { node: HumanGateNode; update: Update }) {
  const set = (fn: (n: HumanGateNode) => HumanGateNode) => update(as(fn));
  return (
    <>
      <TextArea
        label="Prompt"
        value={node.prompt}
        placeholder="What the human is asked."
        onChange={(v) => set((n) => ({ ...n, prompt: v }))}
      />
      <ListInput label="Options" value={node.options} onChange={(v) => set((n) => withField(n, "options", optList(v)))} />
    </>
  );
}

function CheckFields({ node, update }: { node: CheckNode; update: Update }) {
  const set = (fn: (n: CheckNode) => CheckNode) => update(as(fn));
  const check = node.check;
  const setCheck = (fn: (c: CheckNode["check"]) => CheckNode["check"]) => set((n) => ({ ...n, check: fn(n.check) }));
  return (
    <>
      <Segmented
        label="Check kind"
        value={check.kind}
        options={CHECK_KINDS.map((k) => ({ value: k, label: k }))}
        onChange={(v) => setCheck((c) => ({ ...c, kind: v }))}
      />
      <TextInput label="Run" value={check.run ?? ""} mono onChange={(v) => setCheck((c) => withField(c, "run", optText(v)))} />
      <TextInput label="Pass when" value={check.pass} onChange={(v) => setCheck((c) => ({ ...c, pass: v }))} />
      <NumberInput label="Threshold" value={check.threshold} onChange={(v) => setCheck((c) => withField(c, "threshold", v))} />
    </>
  );
}

function MergeFields({ node, update }: { node: MergeNode; update: Update }) {
  const set = (fn: (n: MergeNode) => MergeNode) => update(as(fn));
  return (
    <>
      <ListInput label="Merges" value={node.merges} hint="One artifact id per line." onChange={(v) => set((n) => ({ ...n, merges: v }))} />
      <TextInput label="Strategy" value={node.strategy ?? ""} onChange={(v) => set((n) => withField(n, "strategy", optText(v)))} />
    </>
  );
}

function StopFields({ node, update }: { node: StopNode; update: Update }) {
  const set = (fn: (n: StopNode) => StopNode) => update(as(fn));
  return (
    <Segmented
      label="Outcome"
      value={node.outcome ?? "none"}
      options={[
        { value: "none", label: "unset" },
        { value: "success", label: "success" },
        { value: "halt", label: "halt" },
      ]}
      onChange={(v) => set((n) => withField(n, "outcome", v === "none" ? undefined : v))}
    />
  );
}

