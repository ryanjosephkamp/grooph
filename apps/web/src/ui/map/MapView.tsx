import {
  CARRIER_LABEL,
  CARRIER_STYLE,
  canonicalizeMap,
  endName,
  handoffCarrierText,
  handoffsOf,
  wakesItself,
  mapKit,
  mapPicture,
  mapShape,
  mapShapeLine,
  type Handoff,
  type Id,
  type IssueLike,
  type OperationMap,
  type Person,
  type Session,
} from "@grooph/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { download } from "../../doc/exportPackage.js";
import { useLook } from "../../doc/look.js";
import { piece } from "../../piece.js";
import { Keep } from "../Keep.js";
import { IssueList } from "../open/Details.js";
import { Sheet } from "../Sheet.js";
import "./map.css";

type Panel = { type: "session"; id: Id } | { type: "person"; id: Id } | { type: "handoff"; id: Id } | { type: "issues" } | { type: "about" } | null;

const HARNESS: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };

/**
 * From this width the handoff list and the details sit beside the picture, and the picture is the map's lanes side
 * by side (handoff 0080). Without the views, which is only when they could not be fetched, it is the phone's
 * picture this many units wide, as it was before.
 */
const WIDE = "(min-width: 1100px)";
const WIDE_UNITS = 600;

/**
 * A map's other views, the lanes side by side and the sequence, with the switch between them: a piece of the app
 * fetched when a map is drawn, so that an address that shows no map does not carry it (decision 0021; `views.tsx`).
 * This screen asks as it opens, and keeps as little of them here as it can. The service worker holds the piece from
 * the first visit, so a map opens in either view with no network.
 */
type Views = typeof import("./views.js");
let views: Views | undefined;

function useWide(): boolean {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const query = matchMedia(WIDE);
    const on = () => setWide(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);
  return wide;
}

/** A handoff on the picture: its line, and the ring and the number that sit on it in layers of their own. */
const arcOf = (id: Id): string => ["handoff", "plate", "number"].map((part) => `[data-${part}="${CSS.escape(id)}"]`).join(",");

/** A carrier's color in the picture, as the app's own token of the same color. */
const tone = (color: string): string => `var(--${{ gate: "kind-human-gate", check: "kind-check", merge: "kind-merge" }[color] ?? color})`;

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

/**
 * An operation map (docs/operation-map.md), read-only: the picture core
 * draws, laid out for a phone, so the page simply scrolls, or with its lanes
 * side by side where the screen has room; and, by the switch, the same map as
 * a sequence. Tap a session or a handoff for what the document says about it;
 * the validator's list is behind the status. Nothing here edits or stores the
 * map, and a map is never run.
 */
/** The handoffs that wait on a person: where work stalls when that person is away. Said, not warned about. */
function byHand(map: OperationMap) {
  const waiting = mapShape(map).byHand;
  if (waiting.length === 0) return undefined;
  return (
    <ul className="map-by-hand" data-testid="map-by-hand">
      {waiting.map((h) => (
        <li key={h.handoff}>
          <span className="mono">{h.from}</span> → <span className="mono">{h.to}</span>: moves only when {h.who === "" ? "a person" : h.who} {h.starts ? "does" : "carries"} it
        </li>
      ))}
    </ul>
  );
}

/** A session's pointer to its own loop graph. A web link opens (a share link opens the graph in this app); anything else is shown as written. */
function GraphPointer({ pointer }: { pointer: string }) {
  if (!/^https?:\/\//i.test(pointer)) return <span className="mono">{pointer}</span>;
  const here = pointer.startsWith(`${location.origin}${location.pathname}#`);
  return (
    <a className="mono map-graph-link" href={pointer} data-testid="map-graph-link" {...(here ? {} : { target: "_blank", rel: "noreferrer" })}>
      Open its graph
    </a>
  );
}

export function MapView({ map, issues, back = { href: "#/", label: "All graphs" } }: { map: OperationMap; issues: readonly IssueLike[]; back?: { href: string; label: string } }) {
  const wide = useWide();
  // `undefined` while the views are on their way, `null` when they could not be fetched.
  const [more, setMore] = useState<Views | null | undefined>(views);
  useEffect(() => {
    if (!more) piece("views", () => import("./views.js")).then((m) => setMore((views = m)), () => setMore(null));
  }, []);
  // What the views drew, when it is theirs to draw: the lanes side by side on a wide screen, and the sequence.
  const [theirs, setTheirs] = useState<ReturnType<Views["drawn"]>>();
  const main = useRef<HTMLElement>(null);
  const sequence = !!theirs?.sequence;
  // The phone's picture needs nothing fetched. A wide screen waits a moment for the views rather than draw one
  // picture and then another; if they cannot be had, it draws the phone's, wider.
  // In the theme chosen for pictures (docs/themes.md): Paper needs nothing; another is drawn once its values are here.
  const look = useLook();
  const svg = useMemo(() => theirs?.svg ?? (wide && more !== null ? "" : mapPicture(map, { ...(wide ? { width: WIDE_UNITS } : {}), ...(look ? { look } : {}) })), [map, wide, more, theirs, look]);
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";

  const nameOf = (id: Id): string => endName(map, id);
  const numberOf = (id: Id): number => map.handoffs.findIndex((h) => h.id === id) + 1;
  /** Open what a handoff's end is: the session, or the person. */
  const openEnd = (id: Id) => setPanel({ type: (map.people ?? []).some((p) => p.id === id) ? "person" : "session", id });
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
    for (const el of root.querySelectorAll<SVGGElement>("[data-person]")) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Person ${nameOf(el.dataset["person"]!)}`);
    }
    for (const el of root.querySelectorAll<SVGGElement>("[data-handoff], [data-handoff-row]")) {
      const id = el.dataset["handoff"] ?? el.dataset["handoffRow"]!;
      const h = map.handoffs.find((x) => x.id === id);
      // Beside the picture the handoffs are a list of their own, and the picture's lines of them are out of its frame.
      // A row of the sequence is the handoff itself, at any width.
      if (sequence || (el.dataset["handoffRow"] && !wide)) el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", h ? `Handoff ${numberOf(id)}: ${nameOf(h.from)} to ${nameOf(h.to)}` : `Handoff ${id}`);
    }
  }, [svg]);

  // On a wide screen the picture's frame ends where its lanes do: the handoffs are listed beside it. The picture itself is not changed.
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    // It is cut 22 units above the list's first line, which is 12 below the lowest lane, in either layout.
    const first = wide && !sequence ? root.querySelector<SVGRectElement>("[data-handoff-row] > rect") : null;
    root.style.aspectRatio = first ? `${root.querySelector("svg")!.viewBox.baseVal.width} / ${first.y.baseVal.value - 22}` : "";
  }, [svg]);

  // What is open in the sheet is marked on the picture, and brought into view where the picture scrolls on its own.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    // The line that was under the pointer may be gone with its list, so its mark goes too.
    for (const el of root.querySelectorAll(".is-on, .is-hot")) el.classList.remove("is-on", "is-hot");
    if (!panel || !("id" in panel)) return;
    const id = CSS.escape(panel.id);
    const marked = root.querySelectorAll(panel.type === "handoff" ? `${arcOf(panel.id)}, [data-handoff-row="${id}"]` : `[data-${panel.type}="${id}"]`);
    for (const el of marked) el.classList.add("is-on");
    if (!wide) return;
    ((panel.type === "handoff" && root.querySelector(`[data-number="${id}"]`)) || marked[0])?.scrollIntoView({ block: "nearest" });
    // A line of the list is gone once it has opened its handoff: the keyboard goes on from the same line, under the details.
    if (document.activeElement === document.body) document.querySelector<HTMLElement>(".map-list [aria-current]")?.focus({ preventScroll: true });
  }, [panel, svg]);

  /** A handoff under the pointer in the list is picked out on the picture. */
  const point = (id: Id | null) => {
    for (const el of stage.current?.querySelectorAll(".is-hot") ?? []) el.classList.remove("is-hot");
    if (id) for (const el of stage.current?.querySelectorAll(arcOf(id)) ?? []) el.classList.add("is-hot");
  };

  const pick = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const session = target.closest<SVGGElement>("[data-session]");
    if (session) {
      toggle({ type: "session", id: session.dataset["session"]! });
      return true;
    }
    const person = target.closest<SVGGElement>("[data-person]");
    if (person) {
      toggle({ type: "person", id: person.dataset["person"]! });
      return true;
    }
    // An arc's ring and its number are drawn in layers of their own (under and over the lines), and each opens the handoff too.
    const handoff = target.closest<SVGGElement>("[data-handoff], [data-handoff-row], [data-plate], [data-number]");
    if (handoff) {
      toggle({ type: "handoff", id: handoff.dataset["handoff"] ?? handoff.dataset["handoffRow"] ?? handoff.dataset["plate"] ?? handoff.dataset["number"]! });
      return true;
    }
    return false;
  };

  /** Every handoff in the order of its number: beside the picture on a wide screen, and there under an open handoff's details too. */
  const list = (current?: Id) => (
    <ul className="map-handoffs map-list" onMouseLeave={() => point(null)} onBlur={() => point(null)}>
      {map.handoffs.map((h) => (
        <HandoffLine key={h.id} map={map} handoff={h} current={h.id === current} onOpen={(id) => setPanel({ type: "handoff", id })} onPoint={point} />
      ))}
    </ul>
  );

  const sheet = (() => {
    if (!panel) return null;
    if (panel.type === "session") {
      const s = map.sessions.find((x) => x.id === panel.id);
      return s ? { title: "Session", subtitle: s.id, body: <SessionDetails map={map} session={s} onHandoff={(id) => setPanel({ type: "handoff", id })} /> } : null;
    }
    if (panel.type === "person") {
      const p = (map.people ?? []).find((x) => x.id === panel.id);
      return p ? { title: "Person", subtitle: p.id, body: <PersonDetails map={map} person={p} onHandoff={(id) => setPanel({ type: "handoff", id })} /> } : null;
    }
    if (panel.type === "handoff") {
      const h = map.handoffs.find((x) => x.id === panel.id);
      if (!h) return null;
      const all = wide ? (
        <>
          <h3 className="files-title">All handoffs</h3>
          {list(h.id)}
        </>
      ) : null;
      return { title: `Handoff ${numberOf(h.id)}`, subtitle: h.id, body: <HandoffDetails map={map} handoff={h} onSession={openEnd} after={all} /> };
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
              ["By hand", byHand(map)],
              ["About", map.description ? <p className="prose">{map.description}</p> : undefined],
            ]}
          />
          <p className="field-hint">A map shows sessions and what passes between them. It is drawn and checked, never run.</p>
          <div className="export-actions">
            <button type="button" className="btn" onClick={() => download(`${map.id}.grooph-map.json`, canonicalizeMap(map), "application/json")}>
              Download map (.grooph-map.json)
            </button>
          </div>
          <Keep doc={map} />
        </div>
      ),
    };
  })();
  // With nothing open, a wide screen lists the handoffs where the details would be.
  const side = wide && !sheet && map.handoffs.length > 0;

  return (
    <div className={`editor viewer map-view${sheet ? " has-sheet" : ""}${expanded && sheet ? " sheet-expanded" : ""}${wide ? " is-wide" : ""}${side ? " has-side" : ""}`}>
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

      <main ref={main} className="stage map-stage">
        {/* Where the switch goes is kept from the first paint, so nothing moves when it arrives. */}
        <div style={{ minHeight: 68 }}>{more ? <more.Views map={map} kit={mapKit} wide={wide} stage={main} onDrawn={setTheirs} {...(look ? { look } : {})} /> : null}</div>
        <div
          ref={stage}
          className={`map-picture${sequence ? " is-sequence" : ""}`}
          data-look={look?.name}
          hidden={svg === ""}
          style={theirs?.style}
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
      ) : side ? (
        <aside className="map-side" aria-label="Handoffs">
          <div className="map-side-head">
            <h2>Handoffs</h2>
            <p>{map.handoffs.length} on this map, numbered as on the picture. Pick one, or a session, for what the map says about it.</p>
          </div>
          {list()}
        </aside>
      ) : null}
    </div>
  );
}

/** One handoff as a line of a list: its number in a ring of its carrier's color and its carrier's line, as on the picture. */
function HandoffLine({ map, handoff, onOpen, onPoint, current }: { map: OperationMap; handoff: Handoff; onOpen: (id: Id) => void; onPoint?: (id: Id) => void; current?: boolean }) {
  const nameOf = (id: Id): string => endName(map, id);
  const n = map.handoffs.findIndex((h) => h.id === handoff.id) + 1;
  const style = CARRIER_STYLE[handoff.carrier?.kind ?? "none"];
  const over = onPoint && (() => onPoint(handoff.id));
  return (
    <li>
      <button type="button" className="map-handoff-line" aria-current={current || undefined} onClick={() => onOpen(handoff.id)} onMouseEnter={over} onFocus={over}>
        <span className="map-handoff-n" style={{ borderColor: tone(style.color) }}>
          {n}
        </span>
        <span>
          <strong>
            {handoff.from === handoff.to ? `${nameOf(handoff.from)} → itself` : `${nameOf(handoff.from)} → ${nameOf(handoff.to)}`}
          </strong>
          <br />
          <svg className="map-carrier" viewBox="0 0 22 8" aria-hidden="true">
            <path d="M2 4h18" strokeWidth={style.width} strokeDasharray={style.dash} style={{ stroke: tone(style.color) }} />
          </svg>
          {handoffCarrierText(map, handoff) || "no carrier named"}
        </span>
      </button>
    </li>
  );
}

/** What the map says about a person, and the handoffs that start and end with them. */
function PersonDetails({ map, person, onHandoff }: { map: OperationMap; person: Person; onHandoff: (id: Id) => void }) {
  const { out, in: inbound } = handoffsOf(map, person.id);
  return (
    <div className="inspector">
      <Rows
        rows={[
          ["Name", person.name],
          ["Role", person.role ? <p className="prose">{person.role}</p> : undefined],
          ["About", person.description ? <p className="prose">{person.description}</p> : undefined],
        ]}
      />
      <p className="field-hint">A person is not a session: on no machine, under no account, never run. What starts with them moves only when they do it.</p>
      <h3 className="files-title">Hands work to</h3>
      {out.length === 0 ? <p className="field-hint">Nothing starts with this person on the map.</p> : null}
      <ul className="map-handoffs">
        {out.map((h) => (
          <HandoffLine key={h.id} map={map} handoff={h} onOpen={onHandoff} />
        ))}
      </ul>
      <h3 className="files-title">Is handed work by</h3>
      {inbound.length === 0 ? <p className="field-hint">Nothing on the map reaches this person.</p> : null}
      <ul className="map-handoffs">
        {inbound.map((h) => (
          <HandoffLine key={h.id} map={map} handoff={h} onOpen={onHandoff} />
        ))}
      </ul>
    </div>
  );
}

function SessionDetails({ map, session, onHandoff }: { map: OperationMap; session: Session; onHandoff: (id: Id) => void }) {
  const lane = map.lanes.find((l) => l.id === session.lane);
  const wakes = wakesItself(map, session.id);
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
          ["Wakes itself", wakes === undefined ? undefined : wakes === "" ? "on a schedule" : wakes],
          ["Lane", lane ? `${lane.name} (${lane.machine}, ${lane.account})` : <span className="mono">{session.lane}</span>],
          ["Repository", session.repo],
          ["Its graph", session.graph ? <GraphPointer pointer={session.graph} /> : undefined],
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

function HandoffDetails({ map, handoff, onSession, after }: { map: OperationMap; handoff: Handoff; onSession: (id: Id) => void; after?: ReactNode }) {
  const session = (id: Id): ReactNode => {
    const s = map.sessions.find((x) => x.id === id) ?? (map.people ?? []).find((x) => x.id === id);
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
          ["Carried by", c ? handoffCarrierText(map, handoff) || `${CARRIER_LABEL[c.kind]} (not named)` : "no carrier named"],
          ["Carrier kind", c ? CARRIER_LABEL[c.kind] : undefined],
          ["What", handoff.what ? <p className="prose">{handoff.what}</p> : undefined],
          ["Label", handoff.label],
        ]}
      />
      {after}
    </div>
  );
}
