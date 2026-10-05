/**
 * The built-in pattern library (handoff 0007): the repository's `patterns/` folder, bundled at build time, so the
 * template screens need no network once the app has been visited.
 *
 * A piece of the app fetched when a screen first needs it (slice 0093; decision 0021), through `loadBuiltIns` in
 * `templates.ts`: the list of templates, a template's own screens, and the editor's Insert panel. The twenty
 * documents are 23 KB compressed, and they were part of every address's first load, read and checked before
 * anything was drawn. The front page draws one of them and shows six glyphs: it carries those as they are drawn
 * (`ui/landing/front.generated.ts`), and a graph or a share link needs none.
 */
import { parseGraph, type Graph } from "@grooph/core";

import { sortTemplates } from "./templates.js";

// Vite reads these at build time; the files ship inside this piece. As JSON and not as the files' own text: the
// build then writes each without its indentation, which is a ninth of the piece (2.7 KB compressed), and the
// document read from it is the same.
const files = import.meta.glob<unknown>("../../../../patterns/*.grooph.json", { eager: true, import: "default" });

function load(): Graph[] {
  const docs: Graph[] = [];
  for (const [path, json] of Object.entries(files)) {
    const parsed = parseGraph(json);
    // A pattern that does not parse is a repo bug the core tests catch; the app skips it rather than failing to start.
    if (parsed.doc?.template) docs.push(parsed.doc);
    else console.warn(`grooph: skipped ${path}: not a template document`);
  }
  return sortTemplates(docs);
}

export const BUILT_IN_TEMPLATES: readonly Graph[] = load();
