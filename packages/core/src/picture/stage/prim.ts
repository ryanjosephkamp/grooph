/**
 * What a view of a graph in three dimensions is made of: things in space, each a polygon, a line, a
 * dot, some words or a node's card, by the names of the colors they are drawn in. A view (`panes.ts` and its
 * fellows) says where they are. The app turns and draws them on a canvas, with the cards as elements over it
 * (`apps/web/src/ui/canvas/stage/draw.ts`); `still.ts` draws them once, as an SVG, from where the app's view starts.
 */
import type { Id } from "../../types.js";

export type V = [number, number, number];
type Common = { key?: string; alpha?: number; hide?: boolean; lift?: number; /** not there when the view first comes: grown, or faded in, once the cards have landed */ grow?: boolean };
export type Prim =
  | (Common & { t: "poly"; pts: V[]; fill?: string; fa?: number; stroke?: string; w?: number; dash?: number[] })
  | (Common & { t: "line"; pts: V[]; stroke?: string; w?: number; dash?: number[]; arrow?: boolean; inset?: [number, number]; /** the nodes it runs between: it is drawn from the edge of the one's card to the edge of the other's, where it passes through them */ from?: Id; to?: Id })
  | (Common & { t: "dot"; at: V; r?: number; fill?: string; stroke?: string; w?: number; /** over the cards, as an element: what travels from one card to another */ over?: boolean })
  | (Common & { t: "text"; at: V; text: string; size?: number; fill?: string; bold?: boolean; align?: "left" | "center" | "right"; max?: number; up?: boolean; heads?: number; headFill?: string; /** other places it may stand: it stands at the first, of its own and these, where no card and no such word before it is over it */ or?: { at: V; align?: "left" | "center" | "right" }[] })
  | (Common & { t: "card"; at: V; id: Id; stand?: boolean; side?: boolean; /** its name only: a node the view is not about */ small?: boolean; /** where its point goes for one unit of the picture across and one down: a view that stands the node where the picture has it lets a person move it */ moves?: [V, V] });

/** Where a view is seen from: turned about the upright, and tipped to look down. */
export type Look = { yaw: number; pitch: number };
