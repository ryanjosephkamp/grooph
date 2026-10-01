import {
  CARRIER_LABEL,
  canonicalizeMap,
  carrierText,
  handoffsOf,
  mapPicture,
  mapShape,
  mapShapeLine,
  type Handoff,
  type Id,
  type IssueLike,
  type OperationMap,
  type Session,
} from "@grooph/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { IssueList } from "../open/Details.js";
import { Sheet } from "../Sheet.js";

type Panel = { type: "session"; id: Id } | { type: "handoff"; id: Id } | { type: "issues" } | { type: "about" } | null;

const HARNESS: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="readonly">
      {rows
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([label, value]) => (
          <div key={label} className="readonly-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * An operation map (docs/operation-map.md), read-only: the picture core
 * draws, laid out for a phone, so the page simply scrolls. Tap a session or a
 * handoff for what the document says about it; the validator's list is behind
 * the status. Nothing here edits or stores the map, and a map is never run.
 */
export function MapView({ map, issues, back = { href: "#/", label: "All graphs" } }: { map: OperationMap; issues: readonly IssueLike[]; back?: { href: string; label: string } }) {
  const svg = useMemo(() => mapPicture(map), [map]);
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";

  const nameOf = (id: Id): string => map.sessions.find((s) => s.id === id)?.name || id;
  const numberOf = (id: Id): number => map.handoffs.findIndex((h) => h.id === id) + 1;
  const toggle = (next: Exclude<Panel, null>) =>
    setPanel((p) => (p && p.type === next.type && ("id" in p ? p.id === (next as { id: Id }).id : true) ? null : next));

  // The picture is markup from core; its sessions and handoffs become things a finger or a keyboard can reach.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    for (const el of root.querySelectorAll<SVGGElement>("[data-session]")) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Session ${nameOf(el.dataset["session"]!)}`);
    }
    for (const el of root.querySelectorAll<SVGGElement>("[data-handoff], [data-handoff-row]")) {
      const id = el.dataset["handoff"] ?? el.dataset["handoffRow"]!;
      const h = map.handoffs.find((x) => x.id === id);
      if (el.dataset["handoffRow"]) el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", h ? `Handoff ${numberOf(id)}: ${nameOf(h.from)} to ${nameOf(h.to)}` : `Handoff ${id}`);
    }
  }, [svg]);

  // What is open in the sheet is marked on the picture.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    for (const el of root.querySelectorAll(".is-on")) el.classList.remove("is-on");
    if (panel?.type === "session") root.querySelector(`[data-session="${CSS.escape(panel.id)}"]`)?.classList.add("is-on");
    if (panel?.type === "handoff") {
      for (const el of root.querySelectorAll(`[data-handoff="${CSS.escape(panel.id)}"], [data-handoff-row="${CSS.escape(panel.id)}"]`)) el.classList.add("is-on");
    }
  }, [panel, svg]);

  const pick = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const session = target.closest<SVGGElement>("[data-session]");
    if (session) {
      toggle({ type: "session", id: session.dataset["session"]! });
      return true;
    }
    const handoff = target.closest<SVGGElement>("[data-handoff], [data-handoff-row]");
    if (handoff) {
      toggle({ type: "handoff", id: handoff.dataset["handoff"] ?? handoff.dataset["handoffRow"]! });
      return true;
    }
    return false;
  };

  const sheet = (() => {
    if (!panel) return null;
    if (panel.type === "session") {
      const s = map.sessions.find((x) => x.id === panel.id);
      return s ? { title: "Session", subtitle: s.id, body: <SessionDetails map={map} session={s} onHandoff={(id) => setPanel({ type: "handoff", id })} /> } : null;
    }
    if (panel.type === "handoff") {
      const h = map.handoffs.find((x) => x.id === panel.id);
      return h ? { title: `Handoff ${numberOf(h.id)}`, subtitle: h.id, body: <HandoffDetails map={map} handoff={h} onSession={(id) => setPanel({ type: "session", id })} /> } : null;
    }
    if (panel.type === "issues") {
      return {
        title: "Validation",
        subtitle: "the map's own rules",
        body: issues.length === 0 ? (
          <div className="inspector">
            <p className="all-clear">No issues. Every handoff names its carrier.</p>
          </div>
        ) : (
          <IssueList issues={issues} />
        ),
      };
    }
    return {
      title: "Operation map",
      subtitle: map.id,
      body: (
        <div className="inspector">
          <Rows
            rows={[
              ["Name", map.name],
              ["As of", map.asOf],
              ["Shape", mapShapeLine(mapShape(map))],
              ["About", map.description ? <p className="prose">{map.description}</p> : undefined],
            ]}
          />
          <p className="field-hint">A map shows sessions and what passes between them. It is drawn and checked, never run.</p>
          <div className="export-actions">
            <button type="button" className="btn" onClick={() => download(`${map.id}.light.svg`, mapPicture(map, { theme: "light" }), "image/svg+xml")}>
              Save picture, light (SVG)
            </button>
            <button type="button" className="btn" onClick={() => download(`${map.id}.dark.svg`, mapPicture(map, { theme: "dark" }), "image/svg+xml")}>
              Save picture, dark (SVG)
            </button>
            <button type="button" className="btn" onClick={() => download(`${map.id}.grooph-map.json`, canonicalizeMap(map), "application/json")}>
              Download map (.grooph-map.json)
            </button>
          </div>
        </div>
      ),
    };
  })();

  return (
    <div className={`editor viewer map-view${sheet ? " has-sheet" : ""}${expanded && sheet ? " sheet-expanded" : ""}`}>
      <header className="topbar">
        <a className="icon-btn" href={back.href} aria-label={back.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <button type="button" className="title-btn" onClick={() => toggle({ type: "about" })}>
          <span className="title-name">{map.name || map.id}</span>
          <span className="title-sub">operation map · read-only{map.asOf ? ` · as of ${map.asOf}` : ""}</span>
        </button>
        <button type="button" className={`status ${statusClass}`} aria-label={`Validation: ${statusText}`} onClick={() => toggle({ type: "issues" })}>
          {statusText}
        </button>
      </header>

      <main className="stage map-stage">
        <div
          ref={stage}
          className="map-picture"
          onClick={(e) => {
            if (!pick(e.target)) setPanel(null);
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && pick(e.target)) e.preventDefault();
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </main>

      {sheet ? (
        <Sheet title={sheet.title} subtitle={sheet.subtitle} expanded={expanded} onToggle={() => setExpanded((x) => !x)} onClose={() => setPanel(null)}>
          {sheet.body}
        </Sheet>
      ) : null}
    </div>
  );
}

function HandoffLine({ map, handoff, onOpen }: { map: OperationMap; handoff: Handoff; onOpen: (id: Id) => void }) {
  const nameOf = (id: Id): string => map.sessions.find((s) => s.id === id)?.name || id;
  const n = map.handoffs.findIndex((h) => h.id === handoff.id) + 1;
  return (
    <li>
      <button type="button" className="map-handoff-line" onClick={() => onOpen(handoff.id)}>
        <span className="map-handoff-n">{n}</span>
        <span>
          <strong>
            {handoff.from === handoff.to ? `${nameOf(handoff.from)} → itself` : `${nameOf(handoff.from)} → ${nameOf(handoff.to)}`}
          </strong>
          <br />
          {carrierText(handoff.carrier) || "no carrier named"}
        </span>
      </button>
    </li>
  );
}

function SessionDetails({ map, session, onHandoff }: { map: OperationMap; session: Session; onHandoff: (id: Id) => void }) {
  const lane = map.lanes.find((l) => l.id === session.lane);
  const { out, in: inbound } = handoffsOf(map, session.id);
  return (
    <div className="inspector">
      <Rows
        rows={[
          ["Name", session.name],
          ["Role", <p className="prose">{session.role}</p>],
          ["Harness", HARNESS[session.harness] ?? session.harness],
          ["Model", session.model],
          ["How many", session.count && session.count > 1 ? `${session.count} like sessions, drawn as one` : undefined],
          ["Lifetime", session.lifetime === "per-task" ? "per task" : session.lifetime],
          ["Lane", lane ? `${lane.name} (${lane.machine}, ${lane.account})` : <span className="mono">{session.lane}</span>],
          ["Repository", session.repo],
          ["Its graph", session.graph ? <span className="mono">{session.graph}</span> : undefined],
          ["About", session.description ? <p className="prose">{session.description}</p> : undefined],
        ]}
      />
      <h3 className="files-title">Hands work to</h3>
      {out.length === 0 ? <p className="field-hint">Nothing leaves this session by a named carrier.</p> : null}
      <ul className="map-handoffs">
        {out.map((h) => (
          <HandoffLine key={h.id} map={map} handoff={h} onOpen={onHandoff} />
        ))}
      </ul>
      <h3 className="files-title">Is handed work by</h3>
      {inbound.length === 0 ? <p className="field-hint">Nothing reaches this session by a named carrier.</p> : null}
      <ul className="map-handoffs">
        {inbound.map((h) => (
          <HandoffLine key={h.id} map={map} handoff={h} onOpen={onHandoff} />
        ))}
      </ul>
    </div>
  );
}

function HandoffDetails({ map, handoff, onSession }: { map: OperationMap; handoff: Handoff; onSession: (id: Id) => void }) {
  const session = (id: Id): ReactNode => {
    const s = map.sessions.find((x) => x.id === id);
    return s ? (
      <button type="button" className="chip chip-small" onClick={() => onSession(id)}>
        {s.name || s.id}
      </button>
    ) : (
      <span className="mono">{id} (unknown)</span>
    );
  };
  const c = handoff.carrier;
  return (
    <div className="inspector">
      <Rows
        rows={[
          ["From", session(handoff.from)],
          ["To", session(handoff.to)],
          ["Carried by", c ? carrierText(c) || `${CARRIER_LABEL[c.kind]} (not named)` : "no carrier named"],
          ["Carrier kind", c ? CARRIER_LABEL[c.kind] : undefined],
          ["What", handoff.what ? <p className="prose">{handoff.what}</p> : undefined],
          ["Label", handoff.label],
        ]}
      />
    </div>
  );
}
