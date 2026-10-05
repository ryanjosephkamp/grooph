import { useEffect, useState, type ReactNode } from "react";

import { copyText } from "../../doc/exportPackage.js";
import { piece } from "../../piece.js";
import { templateHref } from "../templates/TemplatesScreen.js";
import { Check, DOCS, SOURCE, SiteFooter, SiteHeader } from "./Chrome.js";
import { RunDemo } from "./RunDemo.js";

/** The template the front page draws, and the one "Open a template" opens. */
const HERO = "review-gate";

/** The line to paste into Claude Code; the skill proposes graphs for it. */
const ASK = "/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging";

/*
 * The hero is the review gate as a real graph, its slots filled with the template's own examples, drawn by core's
 * picture in the `auto` theme so it follows the page's color scheme; the strip is six whole graphs whose shapes
 * differ at a glance, each with its glyph. Both are drawn when the app is built and not when the page is opened
 * (`front.generated.ts`, written by scripts/front-page.mjs and held to the code by test/front.test.ts): the page
 * then needs no template to draw itself, and the built-in templates are fetched when a screen lists or opens one.
 *
 * They are a piece of their own (`front.ts`), so that only the front page carries them. Its address has asked for
 * the piece beside the app, and the app waits for it before the first screen there (`App.tsx`), so the page is
 * drawn with its picture in it. Reached from another screen it is here already, fetched once that screen was up.
 * If it cannot be had the page stands without its picture and its tiles, as it does without its poster.
 */
type Front = typeof import("./front.js");
let front: Front | undefined;
export const loadFront = (): Promise<Front> => piece("front", () => import("./front.js")).then((m) => (front = m));

function useFront(): Front | undefined {
  const [got, setGot] = useState(front);
  useEffect(() => {
    if (got) return;
    let live = true;
    loadFront().then(
      (m) => live && setGot(m),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [got]);
  return got;
}

/** What the README says of the app, as the hero's short list. */
const PROMISES = ["No account", "Works on a phone", "Opens offline after a first visit", "Graphs stay on your device"];

/** The poster of all twenty shapes, a file of the site beside the field guide (handoff 0060 copies it there). */
const POSTER = `${DOCS}field-guide/poster.svg`;

/**
 * The front page (handoff 0055): what grooph is, a graph, what it is shown to
 * do, two ways to start, six templates, what it is not shown to do. On an
 * empty device `#/` is this page, with the library's own controls in
 * `device`; `#/about` is the same page from anywhere.
 *
 * Since handoff 0077 it is laid out as the owner's Link Meteor site is: a night
 * header and hero, paper sections, his footer. The words are the ones it had.
 */
export function Landing({ device }: { device?: ReactNode }) {
  // The poster is a file of the documents, which the app's service worker does not keep: with no network it cannot be
  // fetched, and the card then stands without its picture rather than with a broken one.
  const [poster, setPoster] = useState(true);
  const drawn = useFront();
  return (
    <div className="land">
      <SiteHeader />

      <main>
        <section className="land-hero" aria-label="What grooph is">
          <div className="site-wrap">
            <div className="land-hero-title">
              <p className="land-chip">Free and open source</p>
              <h1 className="land-headline">
                Loop graphs <span>for coding agents.</span>
              </h1>
            </div>
            <div className="land-hero-text">
              <p className="land-lede">
                Draw who builds, who checks, where a person decides and when the work stops. grooph checks that every loop can end, then compiles the graph
                into a package a Claude Code session runs. Your harness runs it; grooph never does.
              </p>
              <div className="land-cta">
                <a className="btn btn-primary" href={templateHref("built-in", HERO)}>
                  Open the template
                </a>
                <a className="btn" href="#/templates">
                  See all twenty
                </a>
              </div>
              <ul className="land-promise" aria-label="About the app">
                {PROMISES.map((promise) => (
                  <li key={promise}>
                    <Check />
                    {promise}
                  </li>
                ))}
              </ul>
            </div>
            <figure className="land-figure">
              <RunDemo>
                <div className="land-picture" role="img" aria-label="The review gate template as a graph: a builder, a critic, a human merge approval and a stop, in one loop of at most four rounds" dangerouslySetInnerHTML={{ __html: drawn?.HERO_SVG ?? "" }} />
                <figcaption className="muted">
                  The <a href={templateHref("built-in", HERO)}>review gate</a> template, drawn by grooph.
                </figcaption>
              </RunDemo>
            </figure>
          </div>
        </section>

        <section className="land-section">
          <div className="site-wrap">
            <ul className="land-claims" aria-label="What grooph does">
              <li>
                <strong>Every loop can end.</strong> The validator refuses a loop without a stop, a critic that shares the builder&rsquo;s context, and an
                irreversible step without a human gate.
              </li>
              <li>
                <strong>The graph is the contract.</strong> The package drives the session as drawn: named subagents, stops checked in order, and gates that
                halt before anything irreversible.
              </li>
              <li>
                <strong>Every run leaves a record.</strong> Notes, rounds, dispatch counts and why it stopped, in a folder a monitor reads and a run id resumes.
              </li>
            </ul>
          </div>
        </section>

        <section className="land-section land-alt land-start" aria-labelledby="land-start-title">
          <div className="site-wrap">
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
          </div>
        </section>

        <section className="land-section land-strip" aria-labelledby="land-strip-title">
          <div className="site-wrap">
            <h2 id="land-strip-title" className="land-h2">
              Loop shapes
            </h2>
            <ul className="land-strip-list" aria-label="Templates">
              {(drawn?.TILES ?? []).map((tile) => (
                <li key={tile.id}>
                  <a className="land-tile" href={templateHref("built-in", tile.id)}>
                    {/* The glyph as `Glyph` (../Glyph.tsx) writes one, from a drawing already made. */}
                    <span className={`glyph land-tile-glyph${tile.long ? " is-wide is-long" : ""}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: tile.glyph }} />
                    <span className="land-tile-title">{tile.title}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="land-poster">
              {poster ? (
                <a href={POSTER} aria-label="Open the poster of the twenty loop shapes">
                  <img
                    src={POSTER}
                    width="1200"
                    height="800"
                    loading="lazy"
                    decoding="async"
                    alt="The poster: twenty loop shapes, each drawn with its name and when to reach for it"
                    onError={() => setPoster(false)}
                  />
                </a>
              ) : null}
              <div>
                <h3>Twenty shapes on one page</h3>
                <p className="land-guide-line">
                  All twenty, with what each one&rsquo;s recorded run showed: <a href={`${DOCS}field-guide/`}>the field guide</a>, and{" "}
                  <a href={POSTER}>a poster of the shapes</a>.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="land-section land-alt land-more" aria-labelledby="land-more-title">
          <div className="site-wrap">
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
                  Sessions, the people they work with, and what carries work between them, drawn and checked.{" "}
                  <a href={`${DOCS}operation-map/`}>Operation maps</a>.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="land-section land-honest" aria-labelledby="land-honest-title">
          <div className="site-wrap">
            <h2 id="land-honest-title" className="land-h2">
              What is shown, <mark>and what is not</mark>
            </h2>
            <p>
              In twenty proving runs and one paired comparison, grooph is shown to bound and record autonomous work and to hold a design as a runtime
              contract. It is not shown to raise quality over the same instructions given as a prompt, on small tasks. It does not run agents, host anything,
              or call a model. <a href={`${SOURCE}/blob/main/docs/decisions/0013-value-as-of-study-one.md`}>The evidence</a>.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
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
