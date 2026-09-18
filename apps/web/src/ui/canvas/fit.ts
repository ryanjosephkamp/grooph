import type { FitViewOptions } from "@xyflow/react";

/**
 * Room for what floats over the canvas: the loop legend or mode banner on top,
 * the toolbar at the bottom. Nodes fitted into view land clear of both.
 */
export const FIT: FitViewOptions = { padding: { top: "72px", bottom: "92px", x: "20px" }, maxZoom: 1 };
