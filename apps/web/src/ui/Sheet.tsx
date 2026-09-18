import type { ReactNode } from "react";

/**
 * The inspector's container: a bottom sheet at phone width, a side panel on a
 * wide screen (CSS decides). Two heights on a phone, switched by a button —
 * no drag gesture to get wrong.
 */
export function Sheet(props: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="sheet" aria-label={props.title}>
      <div className="sheet-head">
        <div className="sheet-title">
          <h2>{props.title}</h2>
          {props.subtitle ? <span className="sheet-sub mono">{props.subtitle}</span> : null}
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
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={props.onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="sheet-body">{props.children}</div>
    </aside>
  );
}
