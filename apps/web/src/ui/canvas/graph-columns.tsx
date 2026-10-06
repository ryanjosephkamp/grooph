/**
 * Columns, a graph's fourth other kind of view in three dimensions (handoff 0096), as a piece of its own: fetched
 * when Columns is chosen, beside the stage it is drawn on (`graph-stage.tsx`), and named by the page so the service
 * worker holds it. It is apart because the stage's piece has a budget line that the four kinds together would pass,
 * and this is the one kind that says something only a run's page has. What is here: how it places the graph
 * (`stage/columns.ts`), where it is first seen from, its sentence, and the list it says under itself.
 */
import type { Kind } from "./graph-stage.js";
import { blocks, columns, type Tools } from "./stage/columns.js";

export const COLUMNS = (tools: Tools): Kind => ({
  view: columns(tools),
  start: { yaw: -0.18, pitch: 0.44 },
  as: "columns",
  apart: 7,
  says: "Every node stands where the picture has it. On a template an agent's column is taller for a higher tier, frontier over strong over fast: the order the document asks for, not a price and not a model (a profile can give two tiers one model, and a pin names a model whatever the tier). A check, a gate or a stop is a slab. On a run a column is a block for each dispatch, as tall as the minutes between its own start and end stamps, and a faint line where they do not say.",
  // Each column's blocks in words, from the ground up, as far as the slider has come.
  under: (model, shown) =>
    model.run ? (
      <ul className="s3-key" aria-label="Each node's dispatches so far">
        {blocks(model, shown).map((x) => (
          <li key={x.id}>
            <b>{x.name}</b> {x.words.join("; ")}
          </li>
        ))}
      </ul>
    ) : null,
});
