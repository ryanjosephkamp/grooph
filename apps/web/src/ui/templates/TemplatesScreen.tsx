import type { Graph, Profile, TemplateKind } from "@grooph/core";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EMPTY_BROWSE, SORT_LABEL, activeFilters, allTags, browse, isDefault, loadBrowse, saveBrowse, toggled, type Browse, type SortKey } from "../../doc/browse.js";
import { BUILT_IN_TEMPLATES, PROFILE_LEVEL, PROFILE_OPTIONS, PROFILE_TEXT, type TemplateSource } from "../../doc/templates.js";
import { listUserTemplates } from "../../store/templates.js";
import { Glyph } from "../Glyph.js";

export const templateHref = (source: TemplateSource, id: string, use = false): string =>
  `#/templates/${source}/${encodeURIComponent(id)}${use ? "/use" : ""}`;

/**
 * The template library (handoff 0007, criterion 2; browse and glyph in slice
 * 0015): the built-in patterns, bundled with the app, and the person's own
 * under "Yours". Search, filters (kind, each profile axis, tags) and sort work
 * over the index's own fields; the selection is kept per viewer in browser
 * storage, so it is still there after opening a template and coming back.
 * Each row shows the graph's glyph beside its title and when to use it;
 * tapping one opens it read-only.
 */
export function TemplatesScreen() {
  const [yours, setYours] = useState<Graph[] | null>(null);
  const [state, setState] = useState<Browse>(loadBrowse);
  useEffect(() => saveBrowse(state), [state]);
  useEffect(() => {
    let live = true;
    void listUserTemplates().then((list) => live && setYours(list));
    return () => {
      live = false;
    };
  }, []);

  const all = useMemo(() => [...(yours ?? []), ...BUILT_IN_TEMPLATES], [yours]);
  const tags = useMemo(() => allTags(all), [all]);
  const shownYours = useMemo(() => browse(yours ?? [], state), [yours, state]);
  const shownBuiltIn = useMemo(() => browse(BUILT_IN_TEMPLATES, state), [state]);
  const shown = shownYours.length + shownBuiltIn.length;
  const total = all.length;
  const filters = activeFilters(state);

  const [moreTags, setMoreTags] = useState(false);
  // The first few tags (most used first) unless asked for all; a tag that is on always shows.
  const shownTags = moreTags ? tags : tags.filter((tag, i) => i < TAGS_FIRST || state.tags.includes(tag));

  const set = <K extends keyof Browse>(key: K, value: Browse[K]) => setState((s) => ({ ...s, [key]: value }));

  return (
    <div className="library templates">
      <header className="screen-head">
        <a className="icon-btn" href="#/" aria-label="All graphs">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <div>
          <h1>Templates</h1>
          <p className="muted">Start a graph from one, or insert one into a graph you have open.</p>
        </div>
      </header>

      <div className="browse" role="search">
        <div className="browse-row">
          <input
            type="search"
            className="input browse-q"
            placeholder="Search templates"
            aria-label="Search templates"
            value={state.q}
            onChange={(e) => set("q", e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="button" className={`btn browse-toggle${filters > 0 ? " is-on" : ""}`} aria-expanded={state.open} aria-controls="browse-filters" onClick={() => set("open", !state.open)}>
            Filters{filters > 0 ? <span className="browse-count">{filters}</span> : null}
          </button>
        </div>
        <div className="browse-row browse-meta">
          <span className="muted browse-shown" role="status" aria-live="polite">
            {shown === total ? `${total} templates` : `${shown} of ${total}`}
          </span>
          <label className="browse-sort">
            <span className="muted">Sort</span>
            <select className="input" aria-label="Sort by" value={state.sort} onChange={(e) => set("sort", e.target.value as SortKey)}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
          {isDefault(state) ? null : (
            <button type="button" className="link browse-clear" onClick={() => setState({ ...EMPTY_BROWSE, open: state.open })}>
              Clear
            </button>
          )}
        </div>
        {state.open ? (
          <div className="browse-filters" id="browse-filters">
            <Chips<TemplateKind> label="Kind" options={["graph", "fragment"]} text={(k) => (k === "graph" ? "Whole graph" : "Fragment")} on={state.kind} onToggle={(k) => set("kind", toggled(state.kind, k))} />
            {(["cost", "speed", "rigor"] as const).map((axis) => (
              <Chips<Profile[typeof axis]>
                key={axis}
                label={axis[0]!.toUpperCase() + axis.slice(1)}
                options={PROFILE_OPTIONS[axis]}
                text={(v) => v[0]!.toUpperCase() + v.slice(1)}
                title={(v) => PROFILE_TEXT[axis][v as never]}
                level={(v) => PROFILE_LEVEL[axis][v as never]}
                on={state[axis]}
                onToggle={(v) => set(axis, toggled(state[axis] as string[], v) as never)}
              />
            ))}
            {tags.length > 0 ? (
              <Chips<string>
                label="Tags"
                options={shownTags}
                text={(t) => t}
                on={state.tags}
                onToggle={(t) => set("tags", toggled(state.tags, t))}
                more={
                  tags.length > TAGS_FIRST ? (
                    <button type="button" className="chip chip-small chip-more" aria-expanded={moreTags} onClick={() => setMoreTags((m) => !m)}>
                      {moreTags ? "Fewer tags" : `All ${tags.length} tags`}
                    </button>
                  ) : null
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {yours && yours.length > 0 && shownYours.length > 0 ? (
        <section aria-labelledby="yours-title">
          <h2 className="list-title" id="yours-title">
            Yours
          </h2>
          <TemplateList source="yours" docs={shownYours} />
        </section>
      ) : null}

      {shownBuiltIn.length > 0 ? (
        <section aria-labelledby="builtin-title">
          <h2 className="list-title" id="builtin-title">
            Built-in
          </h2>
          <TemplateList source="built-in" docs={shownBuiltIn} />
        </section>
      ) : null}

      {shown === 0 ? (
        <p className="muted templates-hint browse-none" role="status">
          No template matches.{" "}
          <button type="button" className="link" onClick={() => setState({ ...EMPTY_BROWSE, open: state.open })}>
            Clear the search and filters
          </button>
        </p>
      ) : null}

      {yours && yours.length === 0 ? (
        <p className="muted templates-hint">
          <strong>Yours</strong> is empty. Save a graph, or some of its nodes, as a template from the Graph panel of the editor, or import a template file from
          the graph list.
        </p>
      ) : null}
    </div>
  );
}

/** How many tags the panel shows before "All tags": the ones used most. */
const TAGS_FIRST = 8;

/** One filter group: toggle chips, any number on. */
function Chips<T extends string>({
  label,
  options,
  text,
  title,
  level,
  on,
  onToggle,
  more,
}: {
  label: string;
  options: readonly T[];
  text: (value: T) => string;
  /** the accessible name, when the chip's text is short for its group */
  title?: (value: T) => string;
  level?: (value: T) => number;
  on: readonly T[];
  onToggle: (value: T) => void;
  more?: ReactNode;
}) {
  return (
    <div className="browse-group" role="group" aria-label={label}>
      <span className="browse-group-label">{label}</span>
      <div className="chips browse-chips">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip chip-small${on.includes(value) ? " chip-on" : ""}`}
            aria-pressed={on.includes(value)}
            aria-label={title ? title(value) : undefined}
            onClick={() => onToggle(value)}
          >
            {level ? (
              <span className="meter" aria-hidden="true" data-level={level(value)}>
                <i />
                <i />
                <i />
              </span>
            ) : null}
            {text(value)}
          </button>
        ))}
        {more}
      </div>
    </div>
  );
}

function TemplateList({ source, docs }: { source: TemplateSource; docs: readonly Graph[] }) {
  return (
    <ul className="template-list" aria-label={source === "yours" ? "Your templates" : "Built-in templates"}>
      {docs.map((doc) => {
        const t = doc.template!;
        return (
          <li key={doc.id}>
            <a className="template-row" href={templateHref(source, doc.id)} data-template={doc.id}>
              <Glyph doc={doc} className="template-glyph" decorative />
              <span className="template-text">
                <span className="template-title">
                  {t.title}
                  {t.kind === "fragment" ? <span className="badge badge-quiet">fragment</span> : null}
                </span>
                <span className="template-when">
                  <span className="template-label">Use when</span> {t.whenToUse}
                </span>
                <ProfileMeters profile={t.profile} />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** The profile as three small meters, the words in the accessible name only: a row to scan, not to read. */
function ProfileMeters({ profile }: { profile: Profile }) {
  return (
    <ul className="template-meters" aria-label="Profile">
      {(["cost", "speed", "rigor"] as const).map((k) => (
        <li key={k} className="template-meter" aria-label={PROFILE_TEXT[k][profile[k] as never]} title={PROFILE_TEXT[k][profile[k] as never]}>
          <span className="meter" aria-hidden="true" data-level={PROFILE_LEVEL[k][profile[k] as never]}>
            <i />
            <i />
            <i />
          </span>
          <span className="template-meter-word" aria-hidden="true">
            {k}
          </span>
        </li>
      ))}
    </ul>
  );
}
