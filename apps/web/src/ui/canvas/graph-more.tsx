/**
 * A graph's kinds of view in three dimensions that are not in the stage's own piece (handoff 0096): Rings, and
 * Columns with it. One piece, fetched when either is chosen, beside the stage it is drawn on (`graph-stage.tsx`), and
 * named by the page so the service worker holds it. It is apart because the stage's piece has a budget line that
 * all the kinds together would pass. What is here for each kind: how it places the graph (`stage/rings.ts`), where
 * it is first seen from, its sentence, and what it says under itself. The stage hands it the shapes it is drawn
 * with: a thing both pieces imported would be a third file for a browser to fetch.
 */
import type { Kind, Tools } from "./graph-stage.js";
import { rings } from "./stage/rings.js";

export const MORE = (tools: Tools): Record<string, Kind> => ({
  rings: {
    view: rings(tools),
    start: { yaw: -0.5, pitch: 0.86 },
    as: "a ring for each loop",
    apart: 7,
    says: "Each loop is a ring, with its own nodes around it in the order of a first pass. A loop inside another is a ring standing on the outer one; a node two loops share stands on one of them. A way back from a loop's last node to its first is the rest of the ring.",
    // The round the run is in, loop by loop, as far as the slider has come: in the drawing it is beside each ring,
    // where a card can stand over it.
    under: (model, shown) =>
      model.run && model.loops.length ? (
        <ul className="s3-key" aria-label="The round the run is in, loop by loop">
          {model.loops.map((loop, n) => {
            const now = shown.until?.[loop.id];
            return (
              <li key={loop.id}>
                <b style={{ color: `var(--loop-${n % 4})` }}>{loop.name}</b> {now ? `round ${Math.floor(now.now)}` : "not entered"}
              </li>
            );
          })}
        </ul>
      ) : null,
  },
});
