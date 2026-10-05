import { outline, type Graph, type Id, type OutlineSection } from "@grooph/core";
import { useEffect, useMemo, useRef } from "react";

import { unitsNow } from "./canvas/boxes.js";

/**
 * The outline (core's `outline`): the whole graph to read from top to bottom,
 * every node with its full brief, every edge as a sentence, every loop with
 * its bar and stops. For reviewing on a phone what an agent built without
 * opening each node. Read-only; in the editor a section opens its inspector.
 *
 * `current` is the node or loop whose details are open beside the outline
 * (on a desktop the two sit either side of the canvas): its section is marked
 * and brought into view.
 */
export function Outline({ doc, onOpen, current }: { doc: Graph; onOpen?: (id: Id, kind: string) => void; current?: Id }) {
  const sections = useMemo(() => outline(doc), [doc]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const one = (section: OutlineSection, i: number) => (
    <section
      key={`${section.kind}-${section.id}`}
      className={i > 0 && section.id === current ? "outline-section is-current" : "outline-section"}
      data-outline-id={section.id}
    >
      <p className="outline-kind">{section.kind}</p>
      <div className="outline-head">
        <h3>{section.title}</h3>
        {/* A policy and a subgrooph have no panel of their own to open. */}
        {onOpen && i > 0 && section.kind !== "Policy" && section.kind !== "Subgrooph" ? (
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
  );
  // A subgrooph's sections fold into one box (handoff 0085), drawn by the piece the canvas fetched for this document.
  const Fold = unitsNow()?.OutlineFold;
  return (
    <div className="outline" ref={root}>
      {Fold ? <Fold sections={sections} current={current} one={one} /> : sections.map(one)}
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
