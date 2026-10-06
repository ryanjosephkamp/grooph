/**
 * The stage of a graph's other views in three dimensions (handoff 0096): a list of things in space, drawn on a 2D
 * canvas, with the graph's cards as real elements placed over it each time it is drawn. A view (`panes.ts` and its
 * fellows) says where things are; this turns, fits and draws them. No library.
 *
 * A card is an element and not a drawing so that it can be tapped, focused and named, and so that the picture can
 * become the view the way it becomes the stairs: the browser carries each node to its card (`ui/become.ts`), and a
 * canvas would give it nothing to carry to. A card always faces the reader and is always in front of what the canvas
 * draws.
 */
import type { Id, V } from "./model.js";

type Common = { key?: string; alpha?: number; hide?: boolean; lift?: number; /** not there when the view first comes: grown, or faded in, once the cards have landed */ grow?: boolean };
export type Prim =
  | (Common & { t: "poly"; pts: V[]; fill?: string; fa?: number; stroke?: string; w?: number; dash?: number[] })
  | (Common & { t: "line"; pts: V[]; stroke?: string; w?: number; dash?: number[]; arrow?: boolean; inset?: [number, number]; /** the nodes it runs between: it is drawn from the edge of the one's card to the edge of the other's, where it passes through them */ from?: Id; to?: Id })
  | (Common & { t: "dot"; at: V; r?: number; fill?: string; stroke?: string; w?: number; /** over the cards, as an element: what travels from one card to another */ over?: boolean })
  | (Common & { t: "text"; at: V; text: string; size?: number; fill?: string; bold?: boolean; align?: "left" | "center" | "right"; max?: number; up?: boolean; heads?: number; headFill?: string; /** other places it may stand: it stands at the first, of its own and these, where no card and no such word before it is over it */ or?: { at: V; align?: "left" | "center" | "right" }[] })
  | (Common & { t: "card"; at: V; id: Id; stand?: boolean; side?: boolean; /** its name only: a node the view is not about */ small?: boolean });

export type Look = { yaw: number; pitch: number };
export type Stage = {
  /** what a step lights: the keys of the things it is about; null when nothing is picked out */
  lit: Set<string> | null;
  /** how much of what grows is there, from 0 to 1: a line is drawn so far along, anything else so strongly */
  grown: number;
  set(prims: Prim[]): void;
  /** draw now, and not at the next frame: a card must be in its place before the browser is told the page has changed */
  draw(): void;
  ask(): void;
  reset(): void;
  zoom(by: number): void;
  /** whether the last press was a drag, which turned the view and is not a tap on what it ended on */
  dragged(): boolean;
  off(): void;
};

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** The app's own colors, by the short names the views use. A stage is Paper in every theme (docs/themes.md). */
const TOKENS: Record<string, string> = { ink: "--ink", "ink-2": "--ink-2", "ink-3": "--ink-3", line: "--line", "line-strong": "--line-strong", card: "--surface", ground: "--bg", floor: "--surface-2", accent: "--accent", "accent-soft": "--accent-soft", "loop-0": "--loop-0", "loop-1": "--loop-1", "loop-2": "--loop-2", "loop-3": "--loop-3", "k-agent": "--kind-agent", "k-check": "--kind-check", "k-gate": "--kind-human-gate", "k-stop": "--kind-stop", ok: "--ok", bad: "--warning", brake: "--error" };

/** How tall a frame may be made, of the height of what scrolls it (the stage over the canvas, which a panel or a
 *  sheet can make short): a drag on the frame turns the view, so the page is scrolled from outside the frame, and a
 *  fifth of that height is left outside it to scroll from. (The frame's own floor, 180 px in its style sheet, is
 *  more than that where the stage is under 225 px tall: a phone on its side with a sheet open.) */
export const TALLEST = 0.8;
/** The size a frame is made taller to reach, where its width has room for it: at it a card's name is ten pixels. */
const READABLE = 0.9;

/**
 * `roomy`: where the scene's cards would lie over each other in the room the frame has, the frame is made as tall as
 * they need to be clear, up to `TALLEST` of what scrolls it, and the page scrolls. The height is asked of the
 * frame's parent, whose row it is, as `--s3-tall`; what scrolls is that parent's parent.
 */
export function makeStage(frame: HTMLElement, canvas: HTMLCanvasElement, cards: HTMLElement, start: Look, roomy = 0): Stage {
  // A browser that gives no drawing surface (it can refuse one, or have none left) cannot show this view: said, so
  // that what holds the view can fall back to what it showed before, and not left to fail at the first line drawn.
  const surface = canvas.getContext("2d");
  if (!surface) throw new Error("no 2D context");
  const g: CanvasRenderingContext2D = surface;
  const view = { ...start, zoom: 1 };
  let prims: Prim[] = [];
  let fitted = 1;
  let center: V = [0, 0, 0];
  let shift: [number, number] = [0, 0];
  const colors: Record<string, string> = {};
  let font = "system-ui, sans-serif";
  let [w, h] = [0, 0];
  let ratio = 0;
  let asked = 0;
  let moved = false;
  // What the frame's height was last worked out for (its width, the room it is scrolled in, its own height where
  // nothing is asked of it, where the cards are), a working out put off to the next frame, and whether this is
  // the observer's own call: a size changed there is reported as a loop.
  let tallFor = "";
  // Whether cards touch from where the view starts, and where each word that has other places was last put.
  let tight = false;
  const put = new Map<string, number>();
  let later = 0;
  let observing = false;
  // What travels between cards is seen over them: an element, as they are, where the canvas is under them all.
  const token = frame.appendChild(document.createElement("i"));
  token.className = "s3-token";
  token.hidden = true;

  const points = (p: Prim): V[] => ("pts" in p ? p.pts : [p.at]);
  const turned = (p: V): V => {
    const [x, y, z] = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
    const [cy, sy, cp, sp] = [Math.cos(view.yaw), Math.sin(view.yaw), Math.cos(view.pitch), Math.sin(view.pitch)];
    const [x1, z1] = [x * cy + z * sy, -x * sy + z * cy];
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  // Far things are a little smaller: enough to read depth by, not enough to bend a ring out of shape.
  const near = (z: number, f: number): number => (f * 2600) / (2600 - z * f);
  const seen = (p: V): [number, number, number, number] => {
    const [x, y, z] = turned(p);
    const k = near(z, fitted * view.zoom);
    return [w / 2 + (x - shift[0]) * k, h / 2 - (y - shift[1]) * k, z, k];
  };
  const color = (name: string, alpha = 1): string => {
    const c = colors[name] ?? name;
    return alpha >= 1 ? c : `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
  };

  const cardOf = (id: Id): HTMLElement | null => cards.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
  /** Where a card's box is, given where its point is seen and how large things are there: left, top, width, height, and its own scale. */
  const boxOf = (p: Extract<Prim, { t: "card" }>, el: HTMLElement, x: number, y: number, k: number): [number, number, number, number, number] => {
    const s = clamp(k, 0.72, 1.15);
    const [cw, ch] = [el.offsetWidth * s, el.offsetHeight * s];
    return [p.side ? x + 9 : x - cw / 2, p.stand && !p.side ? y - ch - 13 : y - ch / 2, cw, ch, s];
  };

  /** The largest the scene can be and still be whole in the frame from where it starts, cards and words included. */
  function fit(): void {
    if (!prims.length || !w || !h) return;
    const all = prims.flatMap(points);
    center = [0, 1, 2].map((k) => (Math.min(...all.map((p) => p[k]!)) + Math.max(...all.map((p) => p[k]!))) / 2) as V;
    const was = { ...view };
    Object.assign(view, start, { zoom: 1 });
    // Each thing takes room round its point that does not shrink with the scene: a card its box, words their lines.
    const room = (p: Prim): [number, number, number, number] => {
      // A card that is its name alone is as wide as its name.
      const half = (p.t === "card" && p.small ? (cardOf(p.id)?.offsetWidth ?? 88) : 106) / 2 + 5;
      if (p.t === "card") return p.side ? (p.small ? [8, half * 2, 14, 14] : [8, 128, 22, 22]) : p.stand ? [half, half, 60, 8] : [58, 58, 24, 24];
      if (p.t === "text") return [8, 8, p.up ? 16 * p.text.split("\n").length * 1.6 : 12, 12];
      return [3, 3, 3, 3];
    };
    const each = prims.flatMap((p) => points(p).map((q) => [turned(q), room(p)] as const));
    const box = (f: number): [number, number, number, number] => [
      Math.min(...each.map(([t, r]) => t[0] * near(t[2], f) - r[0])),
      Math.max(...each.map(([t, r]) => t[0] * near(t[2], f) + r[1])),
      Math.min(...each.map(([t, r]) => -t[1] * near(t[2], f) - r[2])),
      Math.max(...each.map(([t, r]) => -t[1] * near(t[2], f) + r[3])),
    ];
    const largest = (wide: number, tall: number): number => {
      let [lo, hi] = [0.05, 1.5];
      for (let n = 0; n < 18; n += 1) {
        const f = (lo + hi) / 2;
        const [x0, x1, y0, y1] = box(f);
        if (x1 - x0 <= wide - 16 && y1 - y0 <= tall - 16) lo = f;
        else hi = f;
      }
      return lo;
    };
    const host = frame.parentElement;
    const scroller = host?.parentElement;
    if (roomy && host && scroller) {
      const placed = prims.flatMap((p) => (p.t === "card" && cardOf(p.id) ? [[p, cardOf(p.id)!, turned(p.at)] as const] : []));
      // A frame that is asked for nothing is as tall as the room and the words under it leave: its height is part
      // of what it was worked out for, and so is how tall each card is (a name on two lines). One held to a height
      // is not made shorter by longer words.
      const what = (): string => `${w}|${scroller.clientHeight}|${host.style.getPropertyValue("--s3-tall") ? "held" : h}|${placed.map(([p, el, t]) => `${p.id}:${el.offsetHeight}:${t.map(Math.round).join(",")}`).join("|")}`;
      // Put off when this is the observer's call: the working out changes the size the observer watches.
      if (what() !== tallFor && observing) later ||= requestAnimationFrame(() => ((later = 0), fit(), draw()));
      else if (what() !== tallFor) {
        // At a size, whether no two cards lie over each other, placed as they are drawn: two pixels clear, so that
        // their edges are not one line.
        const clear = (f: number, gap = roomy): boolean => {
          const [x0, x1, y0, y1] = box(f);
          const [sx, sy] = [(x0 + x1) / 2 / f, -(y0 + y1) / 2 / f];
          const boxes = placed.map(([p, el, t]) => boxOf(p, el, (t[0] - sx) * near(t[2], f), -(t[1] - sy) * near(t[2], f), near(t[2], f)));
          return boxes.every((a, i) => boxes.every((b, j) => j <= i || a[0] >= b[0] + b[2] + gap || b[0] >= a[0] + a[2] + gap || a[1] >= b[1] + b[3] + gap || b[1] >= a[1] + a[3] + gap));
        };
        const measure = (): number => {
          h = Math.round(canvas.getBoundingClientRect().height);
          canvas.height = h * ratio;
          return largest(w, h);
        };
        // The height the frame has when it is asked for nothing. Taking the request away can make the page shorter
        // than it is scrolled: where it was scrolled to is kept, and given back.
        const scrolled = scroller.scrollTop;
        host.style.removeProperty("--s3-tall");
        delete host.dataset["tight"];
        const fits = measure();
        // Clear of each other, and large enough to read: under nine tenths a card's name is under ten pixels.
        if (h && (!clear(fits) || fits < READABLE)) {
          // The smallest size at which they are clear, of those the frame's width has room for: the first clear one
          // of twenty-four steps up, and then, by halving, the one nearest the last that was not. If none is, the
          // largest. A frame that would pass the cap is at the cap.
          const widest = largest(w, 1e6);
          let f = clear(fits) ? fits : widest;
          for (let n = 1; n <= 24 && !clear(fits); n += 1) {
            let [not, yes] = [fits + ((widest - fits) * (n - 1)) / 24, fits + ((widest - fits) * n) / 24];
            if (!clear(yes)) continue;
            for (let k = 0; k < 10; k += 1) clear((not + yes) / 2) ? (yes = (not + yes) / 2) : (not = (not + yes) / 2);
            f = yes;
            break;
          }
          const high = (at: number): number => Math.ceil(box(at)[3] - box(at)[2]) + 18;
          // To be clear of each other the cards may take the frame to its cap. To be read they may take it only as
          // far as leaves the slider and its sentence in sight without scrolling: the words under those are then
          // scrolled to. (What is under the frame: the slider's row and the sentence's, a gap above each; and the
          // room the page keeps at its foot.)
          const under = (el: Element | null, n: number): number => (n && el instanceof HTMLElement ? el.offsetHeight + 10 + under(el.nextElementSibling, n - 1) : 0);
          const sight = scroller.clientHeight - frame.offsetTop - under(frame.nextElementSibling, 2) - parseFloat(getComputedStyle(scroller).paddingBottom);
          const need = clear(fits) ? h : high(f);
          const tall = Math.min(Math.max(need, Math.min(high(Math.max(f, Math.min(widest, READABLE))), sight)), Math.round(scroller.clientHeight * TALLEST));
          // Where the cap leaves cards over each other (touching, not merely nearer than a hair), the view says so
          // (`graph-stage.tsx` has the words).
          if (tall > h) {
            host.style.setProperty("--s3-tall", `${tall}px`);
            if (!clear(measure(), 0)) host.dataset["tight"] = "";
          } else if (!clear(fits, 0)) host.dataset["tight"] = "";
        }
        // The words that say so can make the bar over the frame taller, and a frame that is not held is then
        // shorter: the canvas is the frame's height as it is with them.
        if ("tight" in host.dataset) measure();
        tight = "tight" in host.dataset;
        scroller.scrollTop = scrolled;
        tallFor = what();
      }
    }
    fitted = largest(w, h);
    const [x0, x1, y0, y1] = box(fitted);
    shift = [(x0 + x1) / 2 / fitted, -(y0 + y1) / 2 / fitted];
    Object.assign(view, was);
  }

  /** A line drawn short of its ends by so many pixels of the screen, so that its head is seen. */
  function inset(pts: number[][], head: number, tail: number): number[][] {
    const cut = (list: number[][], by: number): number[][] => {
      const out = [...list];
      let left = by;
      while (out.length > 2 && left > 0) {
        const d = Math.hypot(out[1]![0]! - out[0]![0]!, out[1]![1]! - out[0]![1]!);
        if (d > left) break;
        left -= d;
        out.shift();
      }
      const d = Math.hypot(out[1]![0]! - out[0]![0]!, out[1]![1]! - out[0]![1]!);
      if (d > left + 1) out[0] = [out[0]![0]! + ((out[1]![0]! - out[0]![0]!) * left) / d, out[0]![1]! + ((out[1]![1]! - out[0]![1]!) * left) / d];
      return out;
    };
    return cut(cut(pts, head).reverse(), tail).reverse();
  }
  /** A line from where it last leaves a box to its end, a little clear of the box: null if it does not end in the box. */
  const outside = (pts: number[][], [x, y, bw, bh]: [number, number, number, number]): number[][] | null => {
    const inside = (q: number[]): boolean => q[0]! > x && q[0]! < x + bw && q[1]! > y && q[1]! < y + bh;
    if (pts.length < 2 || !inside(pts[pts.length - 1]!)) return null;
    let n = pts.length - 1;
    while (n > 0 && inside(pts[n - 1]!)) n -= 1;
    if (n === 0) return null;
    // Between the last point outside and the first inside, the place where the line crosses the box's edge.
    const [a, b] = [pts[n - 1]!, pts[n]!];
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 12; k += 1) inside([a[0]! + (b[0]! - a[0]!) * ((lo + hi) / 2), a[1]! + (b[1]! - a[1]!) * ((lo + hi) / 2)]) ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2);
    return [...pts.slice(0, n), [a[0]! + (b[0]! - a[0]!) * lo, a[1]! + (b[1]! - a[1]!) * lo]];
  };
  const trace = (pts: number[][]): void => {
    g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(p[0]!, p[1]!) : g.moveTo(p[0]!, p[1]!)));
  };

  function draw(): void {
    // The line that says cards touch is about the view as it starts: moved in, the reader has done what it asks.
    frame.parentElement?.toggleAttribute("data-tight", tight && view.zoom <= 1);
    cancelAnimationFrame(asked);
    asked = 0;
    if (!w || !h) return;
    const style = getComputedStyle(frame);
    for (const [name, token] of Object.entries(TOKENS)) colors[name] = style.getPropertyValue(token).trim();
    font = style.fontFamily;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const lit = stage.lit;
    // At a step, what the step is about stands out: the other nodes, edges and loops step back. What belongs to
    // none of them (a lid, the faint rounds, a floor, a word) stays as it is.
    const dim = (p: Prim): number => (lit && p.key && !lit.has(p.key) ? 0.42 : 1);
    const grown = stage.grown;
    const items = prims
      .filter((p) => !p.hide && !(p.grow && grown <= 0))
      .map((p) => {
        const pts = points(p).map(seen);
        const depth = pts.reduce((a, q) => a + q[2], 0) / pts.length + (p.t === "poly" ? -90 : p.t === "line" ? -20 : p.t === "dot" ? 4000 : p.t === "text" ? 60 : 0) + (p.lift ?? 0);
        return { p, pts, depth };
      })
      .sort((a, b) => a.depth - b.depth);
    // The cards first: an edge is drawn up to the card it runs to, and a word stands where no card is over it.
    const boxes = new Map<Id, [number, number, number, number]>();
    token.hidden = true;
    items.forEach(({ p, pts: at }, order) => {
      if (p.t !== "card") return;
      // A card is an element: it is put where its point is seen, as large as that depth makes it.
      const el = cardOf(p.id);
      if (!el) return;
      const on = !!(lit && p.key && lit.has(p.key));
      const [x, y, cw, ch, s] = boxOf(p, el, at[0]![0], at[0]![1], at[0]![3]);
      boxes.set(p.id, [x, y, cw, ch]);
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      el.style.zIndex = String(order);
      el.hidden = false;
      el.classList.toggle("is-lit", on);
      el.classList.toggle("is-dim", !!lit && !on);
    });
    // The words that have chosen a place, so that the next does not choose the same.
    const said: [number, number, number, number][] = [];
    const over = (a: [number, number, number, number], b: [number, number, number, number]): number => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    items.forEach(({ p, pts: at }) => {
      if (p.t === "card") return;
      const on = !!(lit && p.key && lit.has(p.key));
      let pts: number[][] = at;
      g.globalAlpha = dim(p) * (p.alpha ?? 1) * (p.grow && p.t !== "line" ? grown : 1);
      g.setLineDash("dash" in p && p.dash ? p.dash : []);
      g.lineJoin = g.lineCap = "round";
      if (p.t === "poly") {
        trace(pts);
        g.closePath();
        if (p.fill) ((g.fillStyle = color(p.fill, on ? Math.min(1, (p.fa ?? 1) * 1.8) : (p.fa ?? 1))), g.fill());
        if (p.stroke) ((g.strokeStyle = color(on ? "accent" : p.stroke)), (g.lineWidth = (p.w ?? 1) * (on ? 2 : 1)), g.stroke());
      } else if (p.t === "line") {
        // Up to the edge of the card it leaves and of the card it reaches, where it runs through them: its head is
        // at the card, not under it.
        const [left, reached] = [p.from ? boxes.get(p.from) : undefined, p.to ? boxes.get(p.to) : undefined];
        const cut = [reached ? outside(pts, reached) : null, left ? outside([...pts].reverse(), left) : null];
        if (cut[0]) pts = cut[0];
        if (cut[1]) pts = outside([...pts].reverse(), left!)?.reverse() ?? pts;
        if (p.inset) pts = inset(pts, cut[1] ? 2 : p.inset[0], cut[0] ? 1 : p.inset[1]);
        // A line that grows is drawn from its start, so far along.
        if (p.grow && grown < 1) pts = pts.slice(0, Math.max(2, Math.ceil(pts.length * grown)));
        trace(pts);
        g.strokeStyle = color(p.stroke ?? "ink-2");
        g.lineWidth = (p.w ?? 1.4) * (on ? 2.1 : 1);
        g.stroke();
        if (p.arrow && pts.length > 1 && !(p.grow && grown < 1)) {
          const [a, b] = [pts[pts.length - 2]!, pts[pts.length - 1]!];
          const ang = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!);
          g.setLineDash([]);
          g.beginPath();
          g.moveTo(b[0]!, b[1]!);
          g.lineTo(b[0]! - 9 * Math.cos(ang - 0.42), b[1]! - 9 * Math.sin(ang - 0.42));
          g.lineTo(b[0]! - 9 * Math.cos(ang + 0.42), b[1]! - 9 * Math.sin(ang + 0.42));
          g.closePath();
          g.fillStyle = color(p.stroke ?? "ink-2");
          g.fill();
        }
      } else if (p.t === "dot" && p.over) {
        const r = p.r ?? 5;
        token.style.cssText = `width:${r * 2}px;height:${r * 2}px;transform:translate(${(pts[0]![0]! - r).toFixed(1)}px,${(pts[0]![1]! - r).toFixed(1)}px)`;
        token.hidden = false;
      } else if (p.t === "dot") {
        g.beginPath();
        g.arc(pts[0]![0]!, pts[0]![1]!, p.r ?? 5, 0, TAU);
        if (p.fill) ((g.fillStyle = color(p.fill)), g.fill());
        if (p.stroke) ((g.strokeStyle = color(p.stroke)), (g.lineWidth = p.w ?? 2), g.stroke());
      } else {
        const size = p.size ?? 11;
        g.font = `${p.bold ? 600 : 400} ${size}px ${font}`;
        g.textBaseline = "middle";
        g.textAlign = "left";
        // Words that would run past the frame are put on a line of their own, and a line is moved to stay in it.
        const room = Math.min(p.max ?? 220, w - 12);
        const lines = p.text.split("\n").flatMap((line, n) => {
          const out = [""];
          for (const word of line.split(" ")) {
            const next = out[out.length - 1] ? `${out[out.length - 1]} ${word}` : word;
            if (g.measureText(next).width > room && out[out.length - 1]) out.push(word);
            else out[out.length - 1] = next;
          }
          return out.map((text) => ({ text, head: n < (p.heads ?? 0) }));
        });
        // Where it stands: at its own place, or at the first of the others it may stand at where no card and no
        // word placed before it is over it; if all are covered, where the least of it is.
        const widest = Math.max(...lines.map(({ text }) => g.measureText(text).width));
        const places = [{ at: pts[0]!, align: p.align }, ...(p.or ?? []).map((o) => ({ at: seen(o.at) as number[], align: o.align }))].map((o) => {
          const x = clamp(o.at[0]! - (o.align === "center" ? widest / 2 : o.align === "right" ? widest : 0), 4, Math.max(4, w - 4 - widest));
          const tall = lines.length * (size + 3);
          const at: [number, number, number, number] = [x, o.at[1]! - (p.up ? tall - (size + 3) / 2 : tall / 2), widest, tall];
          return { ...o, box: at, under: [...boxes.values(), ...said].reduce((sum, b) => sum + over(at, b), 0) };
        });
        // It stays where it was last put while no more than a tenth of it is under a card there: a name that moved
        // at every turn of the view could not be read.
        const last = places[put.get(p.text) ?? -1];
        const here = p.or ? (last && last.under <= 0.1 * last.box[2] * last.box[3] ? last : (places.find((o) => o.under === 0) ?? [...places].sort((a, b) => a.under - b.under)[0]!)) : places[0]!;
        if (p.or) (said.push(here.box), put.set(p.text, places.indexOf(here)));
        lines.forEach(({ text, head }, k) => {
          const wide = g.measureText(text).width;
          const left = clamp(here.at[0]! - (here.align === "center" ? wide / 2 : here.align === "right" ? wide : 0), 4, Math.max(4, w - 4 - wide));
          // A block stands on its point and grows upward, or is centered on it.
          const y = here.at[1]! + (p.up ? k - (lines.length - 1) : k - (lines.length - 1) / 2) * (size + 3);
          g.strokeStyle = color("ground", 0.9);
          g.lineWidth = 3.5;
          g.setLineDash([]);
          g.strokeText(text, left, y);
          g.fillStyle = color(head && p.headFill ? p.headFill : (p.fill ?? "ink-2"));
          g.fillText(text, left, y);
        });
      }
    });
    g.globalAlpha = 1;
    g.setLineDash([]);
    // A card the view has no place for (none today) is not left where it last was.
    for (const el of cards.querySelectorAll<HTMLElement>("[data-node]")) if (!boxes.has(el.dataset["node"]!)) el.hidden = true;
  }
  const ask = (): void => {
    if (!asked) asked = requestAnimationFrame(draw);
  };
  function size(): void {
    const box = canvas.getBoundingClientRect();
    const [nw, nh] = [Math.round(box.width), Math.round(box.height)];
    // A window moved to another screen is as large and has other pixels.
    if (nw === w && nh === h && ratio === (devicePixelRatio || 1)) return;
    [w, h] = [nw, nh];
    ratio = devicePixelRatio || 1;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    fit();
  }

  // A finger turns it; two move it in and out. The page scrolls from outside the picture, as with the stairs.
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(name: K, fn: (e: HTMLElementEventMap[K]) => void, more?: AddEventListenerOptions): void => {
    frame.addEventListener(name, fn as EventListener, more);
    off.push(() => frame.removeEventListener(name, fn as EventListener, more));
  };
  const fingers = new Map<number, [number, number]>();
  let apart = 0;
  let from: [number, number] = [0, 0];
  on("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
    from = [e.clientX, e.clientY];
    apart = 0;
    moved = false;
  });
  on("pointermove", (e) => {
    const was = fingers.get(e.pointerId);
    if (!was || (e.pointerType === "mouse" && !(e.buttons & 1))) return void fingers.delete(e.pointerId);
    // A press that has not gone anywhere yet is still a tap on what is under it.
    if (!moved && fingers.size === 1 && Math.hypot(e.clientX - from[0], e.clientY - from[1]) < 6) return;
    if (!moved) frame.setPointerCapture(e.pointerId);
    moved = true;
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
    if (fingers.size === 1) {
      view.yaw = clamp(view.yaw + (e.clientX - was[0]) * 0.009, -1.9, 1.9);
      view.pitch = clamp(view.pitch + (e.clientY - was[1]) * 0.007, -0.15, 1.45);
    } else if (fingers.size === 2) {
      const [a, b] = [...fingers.values()] as [[number, number], [number, number]];
      const now = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (apart) view.zoom = clamp((view.zoom * now) / apart, 0.5, 3.2);
      apart = now;
    }
    ask();
  });
  const up = (e: PointerEvent): void => void (fingers.delete(e.pointerId), (apart = 0));
  on("pointerup", up);
  on("pointercancel", up);
  on(
    "wheel",
    (e) => {
      // A pinch on a trackpad arrives as a wheel with the control key; a plain wheel is the page's.
      if (!e.ctrlKey) return;
      e.preventDefault();
      view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.01), 0.5, 3.2);
      ask();
    },
    { passive: false },
  );
  on("keydown", (e) => {
    if (e.target !== frame || e.altKey || e.ctrlKey || e.metaKey) return;
    const turn = ({ ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] } as Record<string, [number, number]>)[e.key];
    if (turn) ((view.yaw = clamp(view.yaw + turn[0], -1.9, 1.9)), (view.pitch = clamp(view.pitch + turn[1], -0.15, 1.45)));
    else if (e.key === "+" || e.key === "=") view.zoom = clamp(view.zoom * 1.2, 0.5, 3.2);
    else if (e.key === "-") view.zoom = clamp(view.zoom / 1.2, 0.5, 3.2);
    else if (e.key === "0" || e.key === "Home") Object.assign(view, start, { zoom: 1 });
    else return;
    e.preventDefault();
    ask();
  });
  if (typeof ResizeObserver === "function") {
    // Drawn at once: a canvas given a new size is blank, and the cards would stand over nothing for a frame.
    const sized = new ResizeObserver(() => {
      observing = true;
      size();
      // The room the frame is scrolled in may have changed and the frame not (a panel opened beside a frame that
      // is held to a height): the height is worked out again.
      if (roomy) fit();
      observing = false;
      draw();
    });
    sized.observe(canvas);
    if (roomy && frame.parentElement?.parentElement) sized.observe(frame.parentElement.parentElement);
    off.push(() => sized.disconnect());
  }
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", ask);
  const themed = new MutationObserver(ask);
  themed.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  off.push(() => scheme.removeEventListener("change", ask), () => themed.disconnect(), () => cancelAnimationFrame(asked), () => cancelAnimationFrame(later), () => token.remove());

  const stage: Stage = {
    lit: null,
    grown: 1,
    set(list) {
      prims = list;
      // A card that is its name alone is so before anything is measured: the frame's height is worked out from it.
      for (const p of prims) if (p.t === "card") cardOf(p.id)?.classList.toggle("is-small", !!p.small);
      size();
      fit();
    },
    draw() {
      size();
      draw();
    },
    ask,
    reset: () => (Object.assign(view, start, { zoom: 1 }), ask()),
    zoom: (by) => ((view.zoom = clamp(view.zoom * by, 0.5, 3.2)), ask()),
    dragged: () => moved,
    off: () => off.forEach((f) => f()),
  };
  return stage;
}
