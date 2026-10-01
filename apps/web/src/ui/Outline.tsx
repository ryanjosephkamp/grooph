import { outline, type Graph, type Id } from "@grooph/core";
import { useMemo } from "react";

/**
 * The outline (core's `outline`): the whole graph to read from top to bottom,
 * every node with its full brief, every edge as a sentence, every loop with
 * its bar and stops. For reviewing on a phone what an agent built without
 * opening each node. Read-only; in the editor a section opens its inspector.
 */
export function Outline({ doc, onOpen }: { doc: Graph; onOpen?: (id: Id, kind: string) => void }) {
  const sections = useMemo(() => outline(doc), [doc]);
  return (
    <div className="outline">
      {sections.map((section, i) => (
        <section key={`${section.kind}-${section.id}`} className="outline-section" data-outline-id={section.id}>
          <p className="outline-kind">{section.kind}</p>
          <div className="outline-head">
            <h3>{section.title}</h3>
            {onOpen && i > 0 && section.kind !== "Policy" ? (
              <button type="button" className="chip chip-small" onClick={() => onOpen(section.id, section.kind)}>
                Edit
              </button>
            ) : null}
          </div>
          <dl className="outline-items">
            {section.items.map((item) => (
              <div key={item.label} className="outline-item">
                <dt>{item.label}</dt>
                <dd>
                  {item.list ? (
                    <ul className="plain-list">
                      {item.list.map((entry, k) => (
                        <li key={k}>{entry}</li>
                      ))}
                    </ul>
                  ) : (
                    item.text
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** The top bar's way in: three lines, as a list is drawn. */
export function OutlineButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label="Outline" aria-pressed={on} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7h11M9 12h11M9 17h11" />
        <circle cx="4.5" cy="7" r="1.2" />
        <circle cx="4.5" cy="12" r="1.2" />
        <circle cx="4.5" cy="17" r="1.2" />
      </svg>
    </button>
  );
}
