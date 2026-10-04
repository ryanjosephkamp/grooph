import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";

/**
 * The picture, held so a reader can move it: drag or one finger to pan, a
 * pinch or ctrl/⌘ + wheel to zoom, a tap to open what is under the finger.
 * The picture is core's SVG (docs/exports.md), so the embed draws exactly
 * what `grooph image` draws and needs no canvas library.
 *
 * A host page scrolls past an embed: while the whole picture is in view,
 * a vertical swipe or a plain wheel goes to the page, not to the picture.
 */

type View = { x: number; y: number; s: number };

export type StageHandle = {
  /** zoom about the middle of the stage */
  zoom(factor: number): void;
  /** back to the picture as it opened */
  fit(): void;
  /** move just enough that an element of the picture is in view */
  reveal(el: Element): void;
};

const TAP_SLOP = 6;
const MIN = 0.35;
const MAX = 4;

export function Stage({
  ref,
  svg,
  width,
  height,
  baseScale,
  label,
  onTap,
  decorate,
  onMoved,
}: {
  ref?: Ref<StageHandle>;
  /** core's picture markup */
  svg: string;
  /** the picture's size in its own units */
  width: number;
  height: number;
  /** pixels per unit when the picture is fitted to the width */
  baseScale: number;
  label: string;
  /** a tap or Enter on the picture; return true when it opened something */
  onTap: (target: Element) => boolean;
  /** called with the picture's root after it is drawn, and again whenever this function changes */
  decorate?: (root: SVGSVGElement) => void;
  /** whether the reader has moved away from the fitted view */
  onMoved?: (moved: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, s: baseScale });
  const fitted = useRef<View>({ x: 0, y: 0, s: baseScale });
  const moved = useRef(false);
  const onMovedRef = useRef(onMoved);
  onMovedRef.current = onMoved;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const size = () => ({ w: stage.current?.clientWidth ?? 0, h: stage.current?.clientHeight ?? 0 });

  /** Keep some of the picture on screen, whatever the reader does. */
  const clamp = useCallback(
    (v: View): View => {
      const { w, h } = size();
      const cw = width * v.s;
      const ch = height * v.s;
      const slack = 24;
      const x = Math.min(Math.max(v.x, Math.min(0, w - cw) - slack), Math.max(0, w - cw) + slack);
      const y = Math.min(Math.max(v.y, Math.min(0, h - ch) - slack), Math.max(0, h - ch) + slack);
      return { x, y, s: v.s };
    },
    [width, height],
  );

  const apply = useCallback(
    (v: View, byReader: boolean) => {
      view.current = v;
      const el = canvas.current;
      const st = stage.current;
      if (!el || !st) return;
      el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
      const { w, h } = size();
      // While the whole picture is in view, vertical swipes belong to the host page.
      st.dataset["overflow"] = width * v.s > w + 1 || height * v.s > h + 1 ? "1" : "0";
      if (byReader !== moved.current) {
        moved.current = byReader;
        onMovedRef.current?.(byReader);
      }
    },
    [width, height],
  );

  const fit = useCallback(() => {
    const { w, h } = size();
    let s = baseScale;
    // A frame of fixed height shorter than the picture: shrink to show it whole, but not below what can still be read.
    if (h > 0 && height * s > h) s = Math.max(h / height, baseScale * 0.55);
    const v = { x: (w - width * s) / 2, y: height * s <= h ? (h - height * s) / 2 : 0, s };
    fitted.current = v;
    apply(v, false);
  }, [apply, baseScale, width, height]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current;
      const s = Math.min(Math.max(v.s * factor, baseScale * MIN), baseScale * MAX);
      const k = s / v.s;
      apply(clamp({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, s }), true);
    },
    [apply, clamp, baseScale],
  );

  const reveal = useCallback(
    (el: Element) => {
      if (!(el instanceof SVGGraphicsElement)) return;
      const box = el.getBBox();
      if (box.width === 0) return;
      const v = view.current;
      const { w, h } = size();
      const left = v.x + box.x * v.s;
      const top = v.y + box.y * v.s;
      const right = left + box.width * v.s;
      const bottom = top + box.height * v.s;
      let { x, y } = v;
      if (left < 8) x += 8 - left;
      else if (right > w - 8) x -= Math.min(right - (w - 8), left - 8);
      if (top < 8) y += 8 - top;
      else if (bottom > h - 8) y -= Math.min(bottom - (h - 8), top - 8);
      if (x !== v.x || y !== v.y) apply(clamp({ x, y, s: v.s }), true);
    },
    [apply, clamp],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoom: (factor) => {
        const { w, h } = size();
        zoomAt(factor, w / 2, h / 2);
      },
      fit,
      reveal,
    }),
    [fit, reveal, zoomAt],
  );

  // Draw, then fit; refit when the stage changes size, unless the reader has moved the picture.
  useLayoutEffect(() => {
    moved.current = false;
    fit();
  }, [svg, fit]);
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const observer = new ResizeObserver(() => (moved.current ? apply(clamp(view.current), true) : fit()));
    observer.observe(st);
    return () => observer.disconnect();
  }, [apply, clamp, fit]);

  useLayoutEffect(() => {
    const root = canvas.current?.querySelector("svg");
    if (root && decorate) decorate(root);
  }, [svg, decorate]);

  // Pointers: one pans, two pinch; a press that does not move is a tap.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let press: { x: number; y: number; target: Element | null; moved: boolean; from: View } | null = null;
    let pinch: { d: number; from: View; mx: number; my: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = st.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.target instanceof Element && e.target.closest("a, button, input")) return;
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) {
        press = { ...local(e), target: e.target instanceof Element ? e.target : null, moved: false, from: view.current };
        pinch = null;
      } else if (pointers.size === 2) {
        press = null;
        pinch = { ...spread(), from: view.current };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      if (pinch && pointers.size >= 2) {
        const now = spread();
        const s = Math.min(Math.max((pinch.from.s * now.d) / Math.max(pinch.d, 1), baseScale * MIN), baseScale * MAX);
        const k = s / pinch.from.s;
        apply(clamp({ x: now.mx - (pinch.mx - pinch.from.x) * k, y: now.my - (pinch.my - pinch.from.y) * k, s }), true);
        return;
      }
      if (!press) return;
      const p = local(e);
      const dx = p.x - press.x;
      const dy = p.y - press.y;
      if (!press.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
      if (!press.moved) {
        press.moved = true;
        st.setPointerCapture(e.pointerId);
        st.dataset["dragging"] = "1";
      }
      apply(clamp({ x: press.from.x + dx, y: press.from.y + dy, s: press.from.s }), true);
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (press && !press.moved && e.type === "pointerup" && press.target) onTapRef.current(press.target);
      if (pointers.size < 2) pinch = null;
      press = null;
      delete st.dataset["dragging"];
    };
    const wheel = (e: WheelEvent) => {
      const p = local(e);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(-e.deltaY * 0.01), p.x, p.y);
        return;
      }
      // A plain wheel moves the picture only when there is more of it that way; otherwise the host page scrolls.
      const v = view.current;
      const next = clamp({ x: v.x - e.deltaX, y: v.y - e.deltaY, s: v.s });
      if (Math.abs(next.x - v.x) < 0.5 && Math.abs(next.y - v.y) < 0.5) return;
      if (st.dataset["overflow"] !== "1") return;
      e.preventDefault();
      apply(next, true);
    };
    st.addEventListener("pointerdown", down);
    st.addEventListener("pointermove", move);
    st.addEventListener("pointerup", up);
    st.addEventListener("pointercancel", up);
    st.addEventListener("wheel", wheel, { passive: false });
    return () => {
      st.removeEventListener("pointerdown", down);
      st.removeEventListener("pointermove", move);
      st.removeEventListener("pointerup", up);
      st.removeEventListener("pointercancel", up);
      st.removeEventListener("wheel", wheel);
    };
  }, [apply, clamp, zoomAt, baseScale]);

  return (
    <div
      ref={stage}
      className="gx-stage"
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target instanceof Element && e.target !== stage.current) {
          if (onTap(e.target)) e.preventDefault();
        }
      }}
      onFocus={(e) => reveal(e.target)}
    >
      <div ref={canvas} className="gx-canvas" aria-label={label} role="group" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
