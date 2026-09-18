import { createContext, useContext } from "react";

import type { Id } from "@grooph/core";

import type { Highlight } from "../doc/issues.js";
import type { DocStore } from "../doc/store.js";

/** What the bottom sheet (or side panel, on a wide screen) shows. */
export type Panel =
  | { type: "node"; id: Id }
  | { type: "edge"; id: Id }
  | { type: "loop"; id: Id }
  | { type: "graph" }
  | { type: "issues" }
  | { type: "export" }
  | { type: "add" }
  | null;

/** How a tap on the canvas is read. */
export type Mode = { type: "idle" } | { type: "connect"; from?: Id } | { type: "pick"; loopId: Id };

export type Editor = {
  store: DocStore;
  panel: Panel;
  openPanel: (panel: Panel) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  highlight: Highlight;
  setHighlight: (highlight: Highlight) => void;
  /** Bring these nodes into view. */
  reveal: (nodeIds: Id[]) => void;
  /** A tap on an edge (its path or its label), read according to the mode. */
  onEdgeTap: (edgeId: Id) => void;
};

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("useEditor outside the editor");
  return editor;
}
