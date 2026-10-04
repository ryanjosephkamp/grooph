import { instantiate, picture, type Graph } from "@grooph/core";
import { useState, type ReactNode } from "react";

import { copyText } from "../../doc/exportPackage.js";
import { builtInTemplate } from "../../doc/templates.js";
import { Glyph, hasLongGlyph } from "../Glyph.js";
import { templateHref } from "../templates/TemplatesScreen.js";
import { RunDemo } from "./RunDemo.js";

const SOURCE = "https://github.com/ryanjosephkamp/grooph";

/** The template the front page draws, and the one "Open a template" opens. */
const HERO = "review-gate";

/** The strip: six whole graphs whose shapes differ at a glance. */
const STRIP = ["grind-loop", "spec-then-loop", "metric-sandwich", "heterogeneous-critic", "tournament-then-judge", "patrol-pulse"];

/** The line to paste into Claude Code; the skill proposes graphs for it. */
const ASK = "/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging";

/** The site's own pages (handoff 0060), beside the app. */
const DOCS = `${import.meta.env.BASE_URL}docs/`;

/**
 * The hero: the review gate as a real graph, its slots filled with the
 * template's own examples, drawn by core's picture in the `auto` theme so it
 * follows the page's color scheme. Drawn once; the picture is deterministic.
 */
let heroSvg: string | undefined;
function hero(): string {
  if (heroSvg === undefined) {
    const template = builtInTemplate(HERO)!;
    const values = Object.fromEntries((template.template?.slots ?? []).map((slot) => [slot.key, slot.example ?? ""]).filter(([, v]) => v !== ""));
    values.task = "Add a slugify(text) function to src/strings.ts.";
    heroSvg = picture(instantiate(template, { name: "Add slugify, reviewed", values }), { theme: "auto" });
  }
  return heroSvg;
}

const strip = (): Graph[] => STRIP.map((id) => builtInTemplate(id)).filter((doc): doc is Graph => doc !== undefined);

/**
 * The front page (handoff 0055): what grooph is, a graph, what it is shown to
 * do, two ways to start, six templates, what it is not shown to do. On an
 * empty device `#/` is this page, with the library's own controls in
 * `device`; `#/about` is the same page from anywhere.
 */
export function Landing({ device }: { device?: ReactNode }) {
  return (
    <div className="land">
      <header className="land-bar">
        <h1 className="wordmark">grooph</h1>
        <nav className="land-nav" aria-label="grooph">
          <a href={DOCS}>Docs</a>
          <a href={`${DOCS}field-guide/`}>Field guide</a>
          <a href={SOURCE} rel="noopener">
            GitHub
          </a>
        </nav>
      </header>

      <section className="land-hero" aria-label="What grooph is">
        <div className="land-hero-text">
          <p className="land-headline">Loop graphs for coding agents.</p>
          <p className="land-lede">
            Draw who builds, who checks, where a person decides and when the work stops. grooph checks that every loop can end, then compiles the graph into
            a package a Claude Code session runs. Your harness runs it; grooph never does.
          </p>
          <div className="land-cta">
            <a className="btn btn-primary btn-large" href={templateHref("built-in", HERO)}>
              Open the template
            </a>
            <a className="btn btn-large" href="#/templates">
              See all twenty
            </a>
          </div>
        </div>
        <figure className="land-figure">
          <RunDemo>
            <div className="land-picture" role="img" aria-label="The review gate template as a graph: a builder, a critic, a human merge approval and a stop, in one loop of at most four rounds" dangerouslySetInnerHTML={{ __html: hero() }} />
            <figcaption className="muted">
              The <a href={templateHref("built-in", HERO)}>review gate</a> template, drawn by grooph.
            </figcaption>
          </RunDemo>
        </figure>
      </section>

      <ul className="land-claims" aria-label="What grooph does">
        <li>
          <strong>Every loop can end.</strong> The validator refuses a loop without a stop, a critic that shares the builder&rsquo;s context, and an
          irreversible step without a human gate.
        </li>
        <li>
          <strong>The graph is the contract.</strong> The package drives the session as drawn: named subagents, stops checked in order, and gates that halt
          before anything irreversible.
        </li>
        <li>
          <strong>Every run leaves a record.</strong> Notes, rounds, dispatch counts and why it stopped, in a folder a monitor reads and a run id resumes.
        </li>
      </ul>

      <section className="land-start" aria-labelledby="land-start-title">
        <h2 id="land-start-title" className="land-h2">
          Two ways to start
        </h2>
        <div className="land-ways">
          <div className="land-way">
            <h3>Ask your agent</h3>
            <p>
              In Claude Code, with grooph <a href={`${DOCS}quickstart/`}>installed</a>, describe the work. The session proposes one to three graphs,
              sends a link to compare them on your phone, and places the package you pick.
            </p>
            <CopyLine text={ASK} />
          </div>
          <div className="land-way">
            <h3>Open a template</h3>
            <p>Twenty templates, each with a recorded run of its own. Open one, fill in its blanks, and export the package or the graph.</p>
            <div className="land-way-actions">
              <a className="btn btn-primary" href={templateHref("built-in", HERO)}>
                Open the review gate
              </a>
              <a className="btn" href="#/templates">
                Browse all
              </a>
            </div>
          </div>
        </div>
        <div className="land-device">{device ?? <AboutDevice />}</div>
      </section>

      <section className="land-strip" aria-labelledby="land-strip-title">
        <h2 id="land-strip-title" className="land-h2">
          Loop shapes
        </h2>
        <ul className="land-strip-list" aria-label="Templates">
          {strip().map((doc) => (
            <li key={doc.id}>
              <a className="land-tile" href={templateHref("built-in", doc.id)}>
                <Glyph doc={doc} className={`land-tile-glyph${hasLongGlyph(doc) ? " is-wide" : ""}`} decorative />
                <span className="land-tile-title">{doc.template!.title}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="land-guide-line muted">
          All twenty, with what each one&rsquo;s recorded run showed: <a href={`${DOCS}field-guide/`}>the field guide</a>, and{" "}
          <a href={`${DOCS}field-guide/poster.svg`}>a poster of the shapes</a>.
        </p>
      </section>

      <section className="land-more" aria-labelledby="land-more-title">
        <h2 id="land-more-title" className="land-h2">
          More than a drawing
        </h2>
        <ul className="land-more-list">
          <li>
            <h3>Put a graph on any page</h3>
            <p>
              One line of HTML shows a live graph a reader can pan, zoom and tap, or a recorded run that plays. <a href={`${DOCS}exports/`}>How to embed</a>.
            </p>
          </li>
          <li>
            <h3>See what is running</h3>
            <p>
              A hook records when each session and subagent starts and stops, and nothing they say. A screen shows it live.{" "}
              <a href={`${DOCS}subagents/`}>How it works</a>.
            </p>
          </li>
          <li>
            <h3>Map work across sessions</h3>
            <p>
              Sessions, the people they work with, and what carries work between them, drawn and checked. <a href={`${DOCS}operation-map/`}>Operation maps</a>.
            </p>
          </li>
        </ul>
      </section>

      <section className="land-honest" aria-labelledby="land-honest-title">
        <h2 id="land-honest-title" className="land-h2">
          What is shown, and what is not
        </h2>
        <p>
          In twenty proving runs and one paired comparison, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract.
          It is not shown to raise quality over the same instructions given as a prompt, on small tasks. It does not run agents, host anything, or call a
          model. <a href={`${SOURCE}/blob/main/docs/decisions/0013-value-as-of-study-one.md`}>The evidence</a>.
        </p>
      </section>

      <footer className="land-foot muted">
        <span>Graphs live in this browser on this device. Nothing is sent anywhere.</span>
        <span>
          <a href={SOURCE} rel="noopener">
            Source
          </a>{" "}
          · MIT
        </span>
      </footer>
    </div>
  );
}

/** On `#/about`, the way back to the graphs on this device. */
function AboutDevice() {
  return (
    <p className="land-device-line">
      <a className="btn" href="#/">
        Your graphs
      </a>
    </p>
  );
}

/** A line to copy, with its button; the result is said, not only shown. */
function CopyLine({ text }: { text: string }) {
  const [said, setSaid] = useState<string | null>(null);
  return (
    <div className="copy-line">
      <code className="copy-line-text">{text}</code>
      <button
        type="button"
        className="btn btn-small"
        aria-label="Copy the line for Claude Code"
        onClick={async () => setSaid((await copyText(text)) ? "Copied. Paste it into Claude Code." : "Could not copy. Select the line and copy it.")}
      >
        Copy
      </button>
      <span className="copy-line-said muted" role="status">
        {said}
      </span>
    </div>
  );
}
