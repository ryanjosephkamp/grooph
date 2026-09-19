import { TemplateError, extractTemplate, formatIssue, slugify, type Graph, type Id, type Profile, type TemplateKind } from "@grooph/core";
import { useMemo, useState } from "react";

import { download } from "../../doc/exportPackage.js";
import { useDoc } from "../../doc/store.js";
import { PROFILE_OPTIONS, templateRefusal, type TemplateRefusal } from "../../doc/templates.js";
import { saveUserTemplate, templateFileName, templateFileText } from "../../store/templates.js";
import { useEditor } from "../editorContext.js";
import { Segmented, TextArea, TextInput } from "../fields.js";
import { templateHref } from "./TemplatesScreen.js";

type Meta = { id: string; title: string; summary: string; whenToUse: string; notFor: string };

/**
 * What core would make, or why it cannot. The profile is core's estimate unless one is given.
 * A template that core makes but that carries errors is refused, as `grooph template save` refuses it.
 */
function preview(
  doc: Graph,
  kind: TemplateKind,
  nodeIds: Id[],
  meta: Meta,
  profile?: Profile,
): { template: Graph; refusal: TemplateRefusal | null } | { problem: string } {
  try {
    const template = extractTemplate(doc, {
      kind,
      ...(kind === "fragment" ? { nodeIds } : {}),
      meta: {
        id: meta.id,
        title: meta.title.trim() || "Untitled",
        summary: meta.summary.trim(),
        whenToUse: meta.whenToUse.trim(),
        ...(meta.notFor.trim() !== "" ? { notFor: meta.notFor.trim() } : {}),
        ...(profile ? { profile } : {}),
      },
    });
    return { template, refusal: templateRefusal(template, doc) };
  } catch (err) {
    if (err instanceof TemplateError) return { problem: err.message };
    throw err;
  }
}

/**
 * Save as template (handoff 0007, criterion 5), through core's
 * `extractTemplate`: the whole graph, or chosen nodes as a fragment. The
 * profile starts as core's estimate and is the person's to correct.
 */
export function SaveTemplatePanel() {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const [kind, setKind] = useState<TemplateKind>(editor.selection.length > 0 ? "fragment" : "graph");
  const [nodeIds, setNodeIds] = useState<Id[]>(() => editor.selection.filter((id) => doc.nodes.some((n) => n.id === id)));
  const [meta, setMeta] = useState<Meta>(() => ({ id: slugify(doc.name, "template"), title: doc.name, summary: "", whenToUse: "", notFor: "" }));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outcome, setOutcome] = useState<{ saved: Graph; replaced: boolean } | { exists: Graph } | null>(null);

  const estimate = useMemo(() => {
    const p = preview(doc, kind, nodeIds, { ...meta, id: meta.id || "template" });
    return "template" in p ? p.template.template!.profile : null;
  }, [doc, kind, nodeIds, meta]);
  const shown = profile ?? estimate ?? { cost: "medium", speed: "medium", rigor: "standard" };
  const missing = (["title", "summary", "whenToUse"] as const).filter((k) => meta[k].trim() === "");
  const check = preview(doc, kind, nodeIds, meta, shown);
  const ready = missing.length === 0 && "template" in check && check.refusal === null;

  const set = (key: keyof Meta) => (value: string) => {
    setMeta((m) => ({ ...m, [key]: key === "id" ? value.toLowerCase().replace(/[^a-z0-9-]/g, "-") : value }));
    if (outcome && "exists" in outcome) setOutcome(null);
  };

  const save = async (replace: boolean) => {
    if (!("template" in check) || check.refusal !== null) return;
    const result = await saveUserTemplate(check.template, { replace });
    setOutcome("exists" in result ? result : { saved: result.saved.doc, replaced: result.replaced });
  };

  if (outcome && "saved" in outcome) {
    const saved = outcome.saved;
    return (
      <div className="inspector" role="status">
        <p className="all-clear">
          {outcome.replaced ? "Replaced" : "Saved"} <strong>{saved.template!.title}</strong> in Yours as <span className="mono">{saved.id}</span>, version {saved.version}.
        </p>
        <div className="export-actions">
          <a className="btn btn-primary" href={templateHref("yours", saved.id)}>
            Open in Templates
          </a>
          <button type="button" className="btn" onClick={() => download(templateFileName(saved), templateFileText(saved), "application/json")}>
            Download template (.grooph.json)
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => editor.openPanel({ type: "graph" })}>
            Back to the graph
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="inspector"
      data-own-undo
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void save(false);
      }}
    >
      <Segmented
        label="Save"
        value={kind}
        options={[
          { value: "graph", label: "Whole graph" },
          { value: "fragment", label: "Selected nodes" },
        ]}
        onChange={setKind}
        hint={
          kind === "graph"
            ? "Keeps the goal, target and layout; drops run notes."
            : "A fragment: these nodes, the edges and loops wholly among them. Graph-level fields stay behind."
        }
      />
      {kind === "fragment" ? (
        <div className="field">
          <div className="field-label" id="fragment-nodes">
            Nodes ({nodeIds.length} selected)
          </div>
          <div className="chips" role="group" aria-labelledby="fragment-nodes">
            {doc.nodes.map((n) => {
              const on = nodeIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={on}
                  className={on ? "chip chip-on" : "chip"}
                  onClick={() => setNodeIds((ids) => (on ? ids.filter((id) => id !== n.id) : doc.nodes.map((x) => x.id).filter((id) => id === n.id || ids.includes(id))))}
                >
                  {n.name || n.id}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Right under what decides it: the kind and the nodes the person just tapped. */}
      {"template" in check && check.refusal ? (
        <div className="refusal" role="alert">
          <p>
            <strong>Not saved: the template would carry these errors.</strong> Yours keeps only templates that validate, as <span className="mono">grooph template save</span> does.
          </p>
          {check.refusal.hints.map((hint) => (
            <p key={hint} className="refusal-hint">
              {hint}
            </p>
          ))}
          <pre className="issue-lines">{check.refusal.issues.map(formatIssue).join("\n")}</pre>
        </div>
      ) : null}

      <TextInput label="Template id" value={meta.id} mono onChange={set("id")} hint="Its name in Templates and in a registry, kebab-case." />
      <TextInput label="Title" value={meta.title} onChange={set("title")} />
      <TextArea label="Summary" value={meta.summary} rows={2} placeholder="One sentence: what it does." onChange={set("summary")} />
      <TextArea label="When to use" value={meta.whenToUse} rows={2} placeholder="The situation it fits." onChange={set("whenToUse")} />
      <TextArea label="Not for (optional)" value={meta.notFor} rows={2} placeholder="Where people wrongly reach for it." onChange={set("notFor")} />

      <div className="field">
        <div className="field-label">Profile</div>
        <div className="field-hint">{profile ? "Corrected by you." : "Estimated from the graph. Correct it if it reads wrong."}</div>
      </div>
      {(["cost", "speed", "rigor"] as const).map((k) => (
        <Segmented
          key={k}
          label={k[0]!.toUpperCase() + k.slice(1)}
          value={shown[k] as string}
          options={PROFILE_OPTIONS[k].map((v) => ({ value: v as string, label: v }))}
          onChange={(v) => setProfile({ ...shown, [k]: v } as Profile)}
        />
      ))}
      {profile ? (
        <button type="button" className="btn btn-quiet" onClick={() => setProfile(null)}>
          Use the estimate again
        </button>
      ) : null}

      {"problem" in check ? (
        <p className="refusal" role="alert">
          {check.problem}
        </p>
      ) : null}

      {outcome && "exists" in outcome ? (
        <div className="rename-warning" role="alert">
          <p>
            Yours already has <span className="mono">{meta.id}</span> ({outcome.exists.template?.title}, version {outcome.exists.version}). Replace it, or choose another
            id.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void save(true)}>
            Replace it (version {outcome.exists.version + 1})
          </button>
        </div>
      ) : null}

      <div className="export-actions">
        <button type="submit" className="btn btn-primary" disabled={!ready}>
          Save to Yours
        </button>
        {missing.length > 0 ? <p className="field-hint">Needs {missing.map((k) => (k === "whenToUse" ? "when to use" : k)).join(", ")}.</p> : null}
      </div>
    </form>
  );
}
