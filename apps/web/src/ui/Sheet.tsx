import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

/** How far a press on the handle may move and still be a tap, in pixels. */
const TAP = 6;

/**
 * The inspector's container: a bottom sheet at phone width, a side panel on a
 * wide screen (CSS decides). Two heights on a phone, switched by the button in
 * its head, or by its handle: a tap on the handle switches them too, and a drag
 * moves the sheet's edge with the finger and lets it go at the nearer height,
 * or closes it when it is pulled most of the way down.
 *
 * With `rail` it holds the outline: the same sheet on a phone, and on a
 * desktop a panel on the other side of the canvas, so the outline and a
 * node's details can be read together.
 */
export function Sheet(props: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  rail?: boolean;
  children: ReactNode;
}) {
  const { rail, onClose } = props;
  const self = useRef<HTMLElement>(null);
  // Where a drag of the handle began: the finger's height on the screen, and the sheet's own height then.
  const drag = useRef<{ id: number; y: number; h: number } | null>(null);
  const grab = (e: PointerEvent<HTMLDivElement>): void => {
    if (!self.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    // No mouse events after it, so no field the finger passes over, or lets go above, takes the focus and the keyboard.
    e.preventDefault();
    drag.current = { id: e.pointerId, y: e.clientY, h: self.current.getBoundingClientRect().height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pull = (e: PointerEvent<HTMLDivElement>): void => {
    const at = drag.current;
    const sheet = self.current;
    if (!at || !sheet || e.pointerId !== at.id || Math.abs(e.clientY - at.y) < TAP) return;
    // Never past the height an expanded sheet has, so a strip of the canvas always stays in sight above it.
    const h = Math.round(Math.max(56, Math.min(innerHeight * 0.86, at.h - (e.clientY - at.y))));
    sheet.classList.add("is-dragged");
    sheet.style.height = sheet.style.maxHeight = `${h}px`;
  };
  const drop = (e: PointerEvent<HTMLDivElement>, canceled = false): void => {
    const at = drag.current;
    const sheet = self.current;
    if (!at || !sheet || e.pointerId !== at.id) return;
    drag.current = null;
    const moved = e.clientY - at.y;
    const h = sheet.getBoundingClientRect().height;
    sheet.classList.remove("is-dragged");
    sheet.style.removeProperty("height");
    sheet.style.removeProperty("max-height");
    if (canceled) return;
    if (Math.abs(moved) < TAP) return props.onToggle();
    // Pulled down to under half of where a folded sheet stands: put away.
    if (moved > 0 && h < Math.min(at.h, innerHeight * 0.52) / 2) return onClose();
    // Let go above the middle of the two heights (52% and 86% of the screen), it stays tall; below, it folds.
    if (h > innerHeight * 0.69 !== props.expanded) props.onToggle();
  };
  // Escape closes the panel. A form that keeps what was typed to itself (Insert, Save as template) is left first, then closed;
  // the outline's rail waits while another panel is open beside it, so one press closes one panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      if (rail && document.querySelector(".sheet:not(.sheet-rail)")) return;
      e.preventDefault();
      if (e.target instanceof HTMLElement && e.target.closest("[data-own-undo]")) e.target.blur();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <aside ref={self} className={rail ? "sheet sheet-rail" : "sheet"} aria-label={props.title}>
      <div className="sheet-head">
        {/* For a finger: the button beside the title does the same for a keyboard and a screen reader. */}
        <div className="sheet-grip" aria-hidden="true" onPointerDown={grab} onPointerMove={pull} onPointerUp={(e) => drop(e)} onPointerCancel={(e) => drop(e, true)} />
        <div className="sheet-title">
          <h2>{props.title}</h2>
          {/* An id is set in the id's type; a few words are words. */}
          {props.subtitle ? <span className={props.subtitle.includes(" ") ? "sheet-sub" : "sheet-sub mono"}>{props.subtitle}</span> : null}
        </div>
        <button
          type="button"
          className="icon-btn sheet-toggle"
          aria-label={props.expanded ? "Shrink panel" : "Expand panel"}
          aria-expanded={props.expanded}
          onClick={props.onToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={props.expanded ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
          </svg>
        </button>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="sheet-body">{props.children}</div>
    </aside>
  );
}
