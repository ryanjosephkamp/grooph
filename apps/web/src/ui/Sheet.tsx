import { useEffect, type ReactNode } from "react";

/**
 * The inspector's container: a bottom sheet at phone width, a side panel on a
 * wide screen (CSS decides). Two heights on a phone, switched by a button —
 * no drag gesture to get wrong.
 *
 * With `rail` it holds the outline: the same sheet on a phone, and on a
 * desktop a panel on the other side of the canvas, so the outline and a
 * node's details can be read together (handoff 0061).
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
    <aside className={rail ? "sheet sheet-rail" : "sheet"} aria-label={props.title}>
      <div className="sheet-head">
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
