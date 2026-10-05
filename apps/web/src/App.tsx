import { sharePayloadFrom } from "@grooph/core";
import { Suspense, lazy, useEffect, useRef, useState } from "react";

import { builtIns, loadBuiltIns, type TemplateSource } from "./doc/templates.js";
import { BUILT_INS, FRONT } from "./doors.js";
import { piece } from "./piece.js";
import "./store/persist.js";
import { Landing, loadFront } from "./ui/landing/Landing.js";
import { Library } from "./ui/Library.js";
import { TemplatesScreen } from "./ui/templates/TemplatesScreen.js";

/** The embed, fetched only when a route asks for it (slice 0056 keeps it out of the app's own load). */
const EmbedApp = lazy(() => piece("EmbedApp", () => import("./ui/embed/EmbedApp.js")).then((m) => ({ default: m.EmbedApp })));

/**
 * The screens that draw on the canvas (slice 0069): one module, fetched when an address first shows one. The front
 * page, the library and the template list above are all the app loads to begin with.
 *
 * Held here and not behind `lazy`: main.tsx fetches the module before the first render when the address opens on
 * one of these screens, so such an address never shows a fallback first, and React has none to hold content behind.
 */
type Screens = typeof import("./ui/screens.js");
let screens: Screens | undefined;

/**
 * Fetch the canvas screens, once they have come. A fetch that fails is tried again there and then (`piece.ts`), and
 * if the screens still cannot be had the next call asks afresh: the next screen opened, or the page loaded again.
 */
export function loadScreens(): Promise<Screens> {
  return piece("screens", () => import("./ui/screens.js")).then((m) => (screens = m));
}

/** Whether an address opens on a screen that draws on the canvas. */
function needsScreens(hash: string): boolean {
  return !LIGHT.has(parse(hash).name);
}
const LIGHT = new Set<Route["name"]>(["library", "about", "templates", "embed"]);

/**
 * Whether a screen cannot be drawn without the built-in templates, which are a piece of their own (slice 0093,
 * `doc/builtins.ts`): a built-in template's view and its Use form. The list of templates waits for them itself,
 * and without them lists a person's own (`ui/templates/TemplatesScreen.tsx`).
 */
const opensBuiltIn = (route: Route): boolean => route.name === "template" && route.source === "built-in";

/**
 * How long a first screen waits for the front page's picture before it is drawn without it. The picture comes in
 * the round the app does, so this is not met unless that one request is held up; and then the library is not kept
 * from a device that has graphs, nor the front page from saying it is opening, by a file that may not come.
 */
const FRONT_WAIT = 300;

/**
 * What an address must have before its first screen is drawn: the canvas's screens, the built-in templates, the
 * front page's own picture, or none of them. They are asked for together, and index.html has already asked for
 * them beside the app, by the same rules (`doors.ts`), so this costs no round of its own. It never fails: a piece
 * that could not be had is said by the screen that needed it.
 *
 * The library's address waits for the front page's picture too, though a device with graphs will not draw it: what
 * is on the device is not known until the screen has read it, and the piece comes in the same round as the app.
 * That wait has an end (`FRONT_WAIT`).
 */
export function ready(hash: string): Promise<unknown> {
  const wanted: Promise<unknown>[] = [];
  if (needsScreens(hash)) wanted.push(loadScreens());
  if (new RegExp(BUILT_INS).test(hash)) wanted.push(loadBuiltIns());
  if (new RegExp(FRONT).test(hash)) wanted.push(Promise.race([loadFront(), new Promise((soon) => setTimeout(soon, FRONT_WAIT))]));
  return Promise.all(wanted.map((piece) => piece.catch(() => undefined)));
}

type Route =
  | { name: "library" }
  | { name: "about" }
  | { name: "graph"; key: string; fresh: boolean }
  | { name: "open"; payload: string; candidate?: string }
  | { name: "live-run" }
  | { name: "live" }
  | { name: "run"; key: string }
  | { name: "templates" }
  | { name: "embed" }
  | { name: "template"; source: TemplateSource; id: string; use: boolean };

/**
 * Hash routes, so GitHub Pages needs no rewrite rules: `#/`, `#/g/<key>`,
 * `#/open?d=<payload>[&c=<candidate>]`, `#/templates`,
 * `#/templates/<built-in|yours>/<id>[/use]`, `#/run?live` (the run `grooph
 * watch` serves), `#/live` (the sessions it serves) and `#/run/<key>` (a run
 * kept on this device). A run from a
 * link opens at `#/open?d=…` like any share.
 */
/**
 * A key from the hash. A malformed `%` escape (a link cut short, a hand-typed
 * address) makes `decodeURIComponent` throw, which would blank the app; the
 * raw text matches no stored key, so the screen for a missing graph or run
 * shows instead, with its way back to the library (review 0008, finding 5).
 */
function decodeKey(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parse(hash: string): Route {
  if (hash === "#/run?live") return { name: "live-run" };
  if (hash === "#/live") return { name: "live" };
  const run = /^#\/run\/([^?]+)$/.exec(hash);
  if (run) return { name: "run", key: decodeKey(run[1]!) };
  if (hash === "#/about") return { name: "about" };
  if (hash === "#/templates") return { name: "templates" };
  if (hash === "#/embed" || hash.startsWith("#/embed?")) return { name: "embed" };
  const template = /^#\/templates\/(built-in|yours)\/([^/?]+)(\/use)?$/.exec(hash);
  if (template) return { name: "template", source: template[1] as TemplateSource, id: decodeKey(template[2]!), use: template[3] !== undefined };
  const graph = /^#\/g\/([^/?]+)(\?new)?$/.exec(hash);
  if (graph) return { name: "graph", key: decodeKey(graph[1]!), fresh: graph[2] !== undefined };
  if (hash.startsWith("#/open?")) {
    const candidate = /[?&]c=([^&]*)/.exec(hash)?.[1];
    return { name: "open", payload: sharePayloadFrom(hash) ?? "", ...(candidate ? { candidate: decodeKey(candidate) } : {}) };
  }
  return { name: "library" };
}

/**
 * A piece of the app the first screen may not need: asked for once that screen is up. What could not be fetched is
 * asked for again when the next screen is opened: the connection may be back.
 */
function useLater(here: () => boolean, load: () => Promise<unknown>, route: Route): "yes" | "no" | "failed" {
  const [got, setGot] = useState<"yes" | "no" | "failed">(() => (here() ? "yes" : "no"));
  // The screen a failure was said on: the one that was open when the piece could not be had. On the next one it is
  // not said again while the piece is asked for afresh.
  const [failedAt, setFailedAt] = useState<Route | null>(null);
  const open = useRef(route);
  open.current = route;
  useEffect(() => {
    if (got !== "no") return;
    let gone = false;
    load().then(
      () => !gone && setGot("yes"),
      () => {
        if (gone) return;
        setFailedAt(open.current);
        setGot("failed");
      },
    );
    return () => {
      gone = true;
    };
  }, [got]);
  useEffect(() => {
    if (got === "failed" && failedAt !== route) setGot("no");
  }, [route]);
  return got === "failed" && failedAt !== route ? "no" : got;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Once the first screen is up, fetch the canvas screens and the built-in templates, so the next one opens at
  // once; and the front page's picture, for a visit that began somewhere else.
  const fetched = useLater(() => screens !== undefined, loadScreens, route);
  const templates = useLater(() => builtIns() !== undefined, loadBuiltIns, route);
  useEffect(() => void loadFront().catch(() => undefined), []);

  // Reached only in the moment before a piece lands, from a screen that did not need it.
  const waiting = (piece: "yes" | "no" | "failed") =>
    piece !== "failed" ? (
      <div className="loading">Opening…</div>
    ) : (
      <div className="notfound">
        <p>This screen could not be fetched. It needs a connection the first time.</p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          Load the page again
        </button>
        <a className="btn" href="#/">
          Back to the library
        </a>
      </div>
    );

  if (route.name === "about") return <Landing />;
  if (opensBuiltIn(route) && templates !== "yes") return waiting(templates);
  if (route.name === "templates") return <TemplatesScreen />;
  if (route.name === "library") {
    return (
      <Library
        open={(key, fresh) => {
          location.hash = `#/g/${encodeURIComponent(key)}${fresh ? "?new" : ""}`;
        }}
      />
    );
  }
  // Reached from inside the app (a page opened on `#/embed` is drawn by main.tsx without the app at all): the embed
  // is fetched then, so the app itself never carries it.
  if (route.name === "embed") {
    return (
      <Suspense fallback={null}>
        <EmbedApp />
      </Suspense>
    );
  }
  if (!screens) return waiting(fetched);
  const { EditorScreen, LiveRun, LiveSessions, OpenScreen, StoredRun, TemplateView, UseTemplate } = screens;
  if (route.name === "graph") return <EditorScreen key={route.key} graphKey={route.key} fresh={route.fresh} />;
  if (route.name === "open") return <OpenScreen payload={route.payload} candidate={route.candidate} />;
  if (route.name === "live-run") return <LiveRun />;
  if (route.name === "live") return <LiveSessions />;
  if (route.name === "run") return <StoredRun key={route.key} runKey={route.key} />;
  const key = `${route.source}/${route.id}`;
  return route.use ? <UseTemplate key={key} source={route.source} id={route.id} /> : <TemplateView key={key} source={route.source} id={route.id} />;
}
