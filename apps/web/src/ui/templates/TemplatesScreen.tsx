import type { Graph } from "@grooph/core";
import { useEffect, useState } from "react";

import { BUILT_IN_TEMPLATES, type TemplateSource } from "../../doc/templates.js";
import { listUserTemplates } from "../../store/templates.js";
import { ProfileChips } from "./ProfileChips.js";

export const templateHref = (source: TemplateSource, id: string, use = false): string =>
  `#/templates/${source}/${encodeURIComponent(id)}${use ? "/use" : ""}`;

/**
 * The template library (handoff 0007, criterion 2): the built-in patterns,
 * bundled with the app, and the person's own under "Yours". Each row says
 * when to reach for it, when not to, and its coarse profile; tapping one
 * opens it read-only.
 */
export function TemplatesScreen() {
  const [yours, setYours] = useState<Graph[] | null>(null);
  useEffect(() => {
    let live = true;
    void listUserTemplates().then((list) => live && setYours(list));
    return () => {
      live = false;
    };
  }, []);

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

      {yours && yours.length > 0 ? (
        <section aria-labelledby="yours-title">
          <h2 className="list-title" id="yours-title">
            Yours
          </h2>
          <TemplateList source="yours" docs={yours} />
        </section>
      ) : null}

      <section aria-labelledby="builtin-title">
        <h2 className="list-title" id="builtin-title">
          Built-in
        </h2>
        <TemplateList source="built-in" docs={BUILT_IN_TEMPLATES} />
      </section>

      {yours && yours.length === 0 ? (
        <p className="muted templates-hint">
          <strong>Yours</strong> is empty. Save a graph, or some of its nodes, as a template from the Graph panel of the editor, or import a template file from
          the graph list.
        </p>
      ) : null}
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
              <span className="template-title">
                {t.title}
                {t.kind === "fragment" ? <span className="badge badge-quiet">fragment</span> : null}
              </span>
              <span className="template-when">
                <span className="template-label">Use when</span> {t.whenToUse}
              </span>
              {t.notFor ? (
                <span className="template-not">
                  <span className="template-label">Not for</span> {t.notFor}
                </span>
              ) : null}
              <ProfileChips profile={t.profile} className="ccard-profile template-profile" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
