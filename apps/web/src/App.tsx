import { sharePayloadFrom } from "@grooph/core";
import { Suspense, lazy, useEffect, useState } from "react";

import type { TemplateSource } from "./doc/templates.js";
import "./store/persist.js";
import { EditorScreen } from "./ui/Editor.js";
import { Landing } from "./ui/landing/Landing.js";
import { Library } from "./ui/Library.js";
import { LiveSessions } from "./ui/live/LiveSessions.js";
import { OpenScreen } from "./ui/open/OpenScreen.js";
import { LiveRun, StoredRun } from "./ui/run/RunScreens.js";
import { TemplatesScreen } from "./ui/templates/TemplatesScreen.js";
import { TemplateView } from "./ui/templates/TemplateView.js";
import { UseTemplate } from "./ui/templates/UseTemplate.js";

/** The embed, fetched only when a route asks for it (slice 0056 keeps it out of the app's own load). */
const EmbedApp = lazy(() => import("./ui/embed/EmbedApp.js").then((m) => ({ default: m.EmbedApp })));

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

  if (route.name === "graph") return <EditorScreen key={route.key} graphKey={route.key} fresh={route.fresh} />;
  if (route.name === "open") return <OpenScreen payload={route.payload} candidate={route.candidate} />;
  if (route.name === "live-run") return <LiveRun />;
  if (route.name === "live") return <LiveSessions />;
  if (route.name === "run") return <StoredRun key={route.key} runKey={route.key} />;
  if (route.name === "about") return <Landing />;
  if (route.name === "templates") return <TemplatesScreen />;
  // Reached from inside the app (a page opened on `#/embed` is drawn by main.tsx without the app at all): the embed
  // is fetched then, so the app itself never carries it.
  if (route.name === "embed") {
    return (
      <Suspense fallback={null}>
        <EmbedApp />
      </Suspense>
    );
  }
  if (route.name === "template") {
    const key = `${route.source}/${route.id}`;
    return route.use ? <UseTemplate key={key} source={route.source} id={route.id} /> : <TemplateView key={key} source={route.source} id={route.id} />;
  }
  return (
    <Library
      open={(key, fresh) => {
        location.hash = `#/g/${encodeURIComponent(key)}${fresh ? "?new" : ""}`;
      }}
    />
  );
}
