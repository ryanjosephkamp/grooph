import { outline, type Graph, type Id, type OutlineSection } from "@grooph/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useUnitsDoor } from "./canvas/boxes.js";

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
  // A subgrooph is one box that holds its nodes' sections (handoff 0085), drawn by the piece the canvas fetched for
  // this document. Without it the sections are a list, each saying which subgrooph it is part of.
  const Unit = useUnitsDoor(sections.some((section) => section.kind === "Subgrooph"))?.OutlineUnit;
  const [opened, setOpened] = useState<ReadonlySet<Id>>(new Set());
  /** the boxes around a section, innermost first */
  const around = (id: Id | undefined): Id[] => {
    const inside = sections.find((section) => section.id === id)?.inside;
    return inside === undefined ? [] : [inside, ...around(inside)];
  };
  const held = around(current).join(" ");
  useEffect(() => {
    // The section a panel is about is in sight: its boxes open, and it is brought into view.
    if (held !== "") setOpened((now) => new Set([...now, ...held.split(" ")]));
    requestAnimationFrame(() => root.current?.querySelector(".is-current")?.scrollIntoView({ block: "nearest" }));
  }, [current, held]);

  const one = (section: OutlineSection, i: number) => (
    <section key={`${section.kind}-${section.id}`} className={i > 0 && section.id === current ? "outline-section is-current" : "outline-section"} data-outline-id={section.id}>
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
  /**
   * What is drawn directly inside `box` (at the top when undefined), in the outline's order: a section, or a box
   * of its own for a subgrooph, set where the first of its nodes comes and holding the rest.
   */
  const within = (box: Id | undefined): ReactNode[] => {
    if (!Unit) return sections.map(one);
    const drawn = new Set<Id>();
    return sections.flatMap((section, i) => {
      // The thing directly inside `box` that this section is, or is somewhere within.
      const chain = [section.id, ...around(section.id)];
      const at = box === undefined ? chain.length : chain.indexOf(box);
      const child = at > 0 ? chain[at - 1]! : undefined;
      if (child === undefined || drawn.has(child)) return [];
      drawn.add(child);
      const top = child === section.id ? section : sections.find((other) => other.id === child && other.kind === "Subgrooph");
      if (!top) return [];
      if (top.kind !== "Subgrooph") return [one(top, i)];
      const count = sections.filter((other) => other.kind !== "Subgrooph" && around(other.id).includes(top.id)).length;
      return [
        <Unit key={`unit-${top.id}`} section={top} count={count} open={opened.has(top.id)} onToggle={(open) => setOpened((now) => new Set(open ? [...now, top.id] : [...now].filter((id) => id !== top.id)))}>
          {one(top, sections.indexOf(top))}
          {within(top.id)}
        </Unit>,
      ];
    });
  };
  return (
    <div className="outline" ref={root}>
      {within(undefined)}
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
