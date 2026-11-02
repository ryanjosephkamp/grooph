import { useEffect, useState } from "react";

import { allIds, followsName, renameId, slugify, type Id } from "@grooph/core";

import { Field } from "../fields.js";
import { useEditor } from "../editorContext.js";

/**
 * The id, applied when the field loses focus. Typing is turned into a
 * kebab-case id; an id already in use is refused. Renaming rewrites every
 * reference in the document (edges, loops, stops, layout, policies).
 */
export function IdField({ id, name, graph, onRenamed }: { id: Id; name?: string; graph?: boolean; onRenamed?: (id: Id) => void }) {
  const editor = useEditor();
  const [text, setText] = useState(id);
  const [problem, setProblem] = useState<string | undefined>();
  useEffect(() => setText(id), [id]);

  const commit = () => {
    const next = slugify(text, "");
    if (next === "" || next === id) {
      setText(id);
      setProblem(undefined);
      return;
    }
    if (allIds(editor.store.get()).has(next)) {
      setText(id);
      setProblem(`"${next}" is already used in this graph.`);
      return;
    }
    setProblem(undefined);
    editor.store.update((d) => (graph ? { ...d, id: next } : renameId(d, id, next)));
    setText(next);
    onRenamed?.(next);
  };

  return (
    <Field
      label="Id"
      hint={
        problem ??
        (name !== undefined && followsName(id, name)
          ? "Follows the name until you change it here. References update with it."
          : "References to it update when you change it.")
      }
    >
      {(fieldId) => (
        <input
          id={fieldId}
          className="input mono"
          value={text}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
        />
      )}
    </Field>
  );
}
