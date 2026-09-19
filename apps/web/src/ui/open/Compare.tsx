import {
  estimateShape,
  formatIssue,
  shapeLine,
  tierLine,
  validate,
  type Candidate,
  type Graph,
  type Issue,
  type IssueLike,
  type ProposalSet,
} from "@grooph/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { copyText } from "../../doc/exportPackage.js";
import { countBySeverity } from "../../doc/issues.js";
import { ViewCanvas, miniHeight } from "../canvas/ViewCanvas.js";
import { ProfileChips } from "../templates/ProfileChips.js";
import { editorHref, useSaveFromLink } from "./save.js";

/** The line the owner pastes back into the chat (docs/executive.md §3). */
export const chooseLine = (set: ProposalSet, c: Candidate): string => `I pick "${c.label}" (${c.id}) from ${set.id}.`;

type Row = { c: Candidate; graph: Graph; issues: Issue[]; recommended: boolean; why?: string };

/**
 * The compare view (docs/executive.md §3): the brief, then one card per
 * candidate. On a phone the cards sit in a row the owner swipes through, with
 * Choose and Save for the card in view; wider, they stand side by side with
 * their rows aligned, so the differences read across.
 */
export function Compare({ set, setIssues, payload }: { set: ProposalSet; setIssues: IssueLike[]; payload: string }) {
  const rows: Row[] = useMemo(
    () =>
      set.candidates.map((c) => {
        const graph = c.graph as Graph;
        const recommended = set.recommendation?.candidate === c.id;
        return { c, graph, issues: validate(graph, { forExport: true }), recommended, ...(recommended ? { why: set.recommendation!.why } : {}) };
      }),
    [set],
  );
  const setLevel = setIssues.filter((i) => i.code !== "E_CANDIDATE_INVALID");

  const track = useRef<HTMLDivElement>(null);
  const recommendedIndex = Math.max(0, rows.findIndex((row) => row.recommended));
  const [active, setActive] = useState(recommendedIndex);
  const [briefOpen, setBriefOpen] = useState(false);
  const [copied, setCopied] = useState<{ id: string; ok: boolean; line: string } | null>(null);
  const [allSaved, setAllSaved] = useState<number | null>(null);
  const { saved, busy, save } = useSaveFromLink();

  // Which card is in view: the one whose centre is nearest the track's centre.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let distance = Infinity;
        [...el.children].forEach((child, i) => {
          const c = child as HTMLElement;
          const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (d < distance) [best, distance] = [i, d];
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Open on the recommended card (review 0006, finding 1): put it in view before the first paint.
  useLayoutEffect(() => {
    const el = track.current;
    const card = el?.children[recommendedIndex] as HTMLElement | undefined;
    if (!el || !card || recommendedIndex === 0) return;
    el.scrollLeft = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
  }, []);

  // Sideways only: the page stays where the reader left it.
  const show = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  const choose = async (c: Candidate) => {
    const line = chooseLine(set, c);
    setCopied({ id: c.id, ok: await copyText(line), line });
  };

  const saveAll = async () => {
    for (const row of rows) if (!saved[row.c.id]) await save(row.c.id, row.graph);
    setAllSaved(rows.length);
  };

  const current = rows[Math.min(active, rows.length - 1)]!;
  const briefLong = set.brief.length > 240;

  return (
    <div className="compare">
      <header className="compare-top">
        <a className="icon-btn" href="#/" aria-label="All graphs">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <div className="compare-heading">
          <span className="overline">
            {rows.length === 1 ? "One proposal" : `${rows.length} proposals`} · <span className="mono">{set.id}</span>
          </span>
          <h1>{set.title}</h1>
        </div>
        {rows.length > 1 ? (
          <button type="button" className="btn btn-small" disabled={busy !== null} onClick={() => void saveAll()}>
            Save all
          </button>
        ) : null}
      </header>

      <section className="compare-brief" aria-label="Brief">
        <p className={briefLong && !briefOpen ? "is-clamped" : undefined}>{set.brief}</p>
        {briefLong ? (
          <button type="button" className="link" aria-expanded={briefOpen} onClick={() => setBriefOpen((o) => !o)}>
            {briefOpen ? "Less" : "More"}
          </button>
        ) : null}
        {allSaved !== null ? (
          <p className="compare-saved" role="status">
            {allSaved} graphs are on this device. <a href="#/">Open the library</a>
          </p>
        ) : null}
        {setLevel.length > 0 ? (
          <div className="warnings">
            <p>Notes on the set itself</p>
            <pre className="issue-lines">{setLevel.map(formatIssue).join("\n")}</pre>
          </div>
        ) : null}
      </section>

      <div className="cards" ref={track} style={{ "--cards": rows.length } as CSSProperties} aria-label="Candidates">
        {rows.map((row, i) => (
          <Card
            key={row.c.id}
            row={row}
            index={i}
            total={rows.length}
            fullHref={`#/open?d=${payload}&c=${encodeURIComponent(row.c.id)}`}
            onChoose={() => void choose(row.c)}
            copied={copied?.id === row.c.id ? copied : null}
            onSave={() => void save(row.c.id, row.graph)}
            saved={saved[row.c.id]?.key}
            busy={busy === row.c.id}
          />
        ))}
      </div>

      {/* Phone: the actions follow the card in view. */}
      <footer className="compare-bar">
        {rows.length > 1 ? (
          <div className="pager" role="group" aria-label="Candidates">
            {rows.map((row, i) => (
              <button key={row.c.id} type="button" className="pager-dot" aria-label={`Show ${row.c.label}`} aria-current={i === active ? "true" : undefined} onClick={() => show(i)} />
            ))}
            <span className="pager-count" aria-live="polite">
              {current.c.label} · {active + 1} of {rows.length}
            </span>
          </div>
        ) : null}
        <Actions
          label={current.c.label}
          onChoose={() => void choose(current.c)}
          onSave={() => void save(current.c.id, current.graph)}
          saved={saved[current.c.id]?.key}
          busy={busy === current.c.id}
          copied={copied?.id === current.c.id ? copied : null}
        />
      </footer>
    </div>
  );
}

function Card(props: {
  row: Row;
  index: number;
  total: number;
  fullHref: string;
  onChoose: () => void;
  onSave: () => void;
  saved?: string;
  busy: boolean;
  copied: { ok: boolean; line: string } | null;
}) {
  const { c, graph, issues, recommended } = props.row;
  const shape = c.shape ?? estimateShape(graph);
  const { errors, warnings } = countBySeverity(issues);
  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";
  const headingId = `cand-${c.id}`;

  return (
    <article className={`ccard${recommended ? " is-recommended" : ""}`} aria-labelledby={headingId} data-candidate={c.id}>
      <div className="ccard-head">
        <div className="ccard-title">
          <h2 id={headingId}>{c.label}</h2>
          {recommended ? <span className="badge">Recommended</span> : null}
          <span className="ccard-index muted">
            {props.index + 1}/{props.total}
          </span>
        </div>
        {props.row.why ? <p className="ccard-why">{props.row.why}</p> : null}
        {c.basedOn ? <span className="ccard-based muted">from the {c.basedOn} template</span> : null}
      </div>

      <ProfileChips profile={c.profile} />

      <div className="ccard-shape">
        <p className="shape-line">{shapeLine(shape)}</p>
        {shape.agents > 0 ? <p className="tier-line muted">{tierLine(shape)}</p> : null}
      </div>

      <p className="ccard-rationale">{c.rationale}</p>

      <div className="ccard-status">
        <span className={`status ${statusClass}`}>{statusText}</span>
        {issues.length > 0 ? (
          <ul className="ccard-issues">
            {issues.map((issue, i) => (
              <li key={i}>
                <span className="mono">{issue.code}</span> {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted"> Ready to export.</span>
        )}
      </div>

      <section className="ccard-list" aria-label="Pros">
        <h3>Pros</h3>
        {c.pros.length > 0 ? (
          <ul className="pros">
            {c.pros.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">None given.</p>
        )}
      </section>

      <section className="ccard-list" aria-label="Cons">
        <h3>Cons</h3>
        {c.cons.length > 0 ? (
          <ul className="cons">
            {c.cons.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">None given.</p>
        )}
      </section>

      <div className="ccard-canvas">
        <div className="mini" style={{ height: miniHeight(graph) }} aria-label={`Graph of ${c.label}`} role="img">
          <ViewCanvas doc={graph} variant="mini" />
        </div>
        <a className="btn btn-small" href={props.fullHref}>
          Open full graph
        </a>
      </div>

      <div className="ccard-actions">
        <Actions label={c.label} onChoose={props.onChoose} onSave={props.onSave} saved={props.saved} busy={props.busy} copied={props.copied} />
      </div>
    </article>
  );
}

function Actions(props: {
  label: string;
  onChoose: () => void;
  onSave: () => void;
  saved?: string;
  busy: boolean;
  copied: { ok: boolean; line: string } | null;
}) {
  return (
    <div className="actions">
      <div className="actions-row">
        {props.saved ? (
          <a className="btn" href={editorHref(props.saved)}>
            Open saved copy
          </a>
        ) : (
          <button type="button" className="btn" disabled={props.busy} onClick={props.onSave}>
            Save to this device
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={props.onChoose} aria-label={`Choose ${props.label}`}>
          Choose {props.label}
        </button>
      </div>
      {props.copied ? (
        props.copied.ok ? (
          <p className="actions-note" role="status">
            Copied. Paste it into the chat: <span className="mono">{props.copied.line}</span>
          </p>
        ) : (
          <p className="actions-note" role="status">
            Copy this into the chat: <span className="mono selectable">{props.copied.line}</span>
          </p>
        )
      ) : props.saved ? (
        <p className="actions-note" role="status">
          Saved to this device. It is editable from the library.
        </p>
      ) : null}
    </div>
  );
}
