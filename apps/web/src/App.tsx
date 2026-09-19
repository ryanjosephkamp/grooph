import { sharePayloadFrom } from "@grooph/core";
import { useEffect, useState } from "react";

import type { TemplateSource } from "./doc/templates.js";
import "./store/persist.js";
import { EditorScreen } from "./ui/Editor.js";
import { Library } from "./ui/Library.js";
import { OpenScreen } from "./ui/open/OpenScreen.js";
import { LiveRun, StoredRun } from "./ui/run/RunScreens.js";
import { TemplatesScreen } from "./ui/templates/TemplatesScreen.js";
import { TemplateView } from "./ui/templates/TemplateView.js";
import { UseTemplate } from "./ui/templates/UseTemplate.js";

type Route =
  | { name: "library" }
  | { name: "graph"; key: string; fresh: boolean }
  | { name: "open"; payload: string; candidate?: string }
  | { name: "live-run" }
  | { name: "run"; key: string }
  | { name: "templates" }
  | { name: "template"; source: TemplateSource; id: string; use: boolean };

/**
 * Hash routes, so GitHub Pages needs no rewrite rules: `#/`, `#/g/<key>`,
 * `#/open?d=<payload>[&c=<candidate>]`, `#/templates`,
 * `#/templates/<built-in|yours>/<id>[/use]`, `#/run?live` (the run `grooph
 * watch` serves) and `#/run/<key>` (a run kept on this device). A run from a
 * link opens at `#/open?d=…` like any share.
 */
function parse(hash: string): Route {
  if (hash === "#/run?live") return { name: "live-run" };
  const run = /^#\/run\/([^?]+)$/.exec(hash);
  if (run) return { name: "run", key: decodeURIComponent(run[1]!) };
  if (hash === "#/templates") return { name: "templates" };
  const template = /^#\/templates\/(built-in|yours)\/([^/?]+)(\/use)?$/.exec(hash);
  if (template) return { name: "template", source: template[1] as TemplateSource, id: decodeURIComponent(template[2]!), use: template[3] !== undefined };
  const graph = /^#\/g\/([^/?]+)(\?new)?$/.exec(hash);
  if (graph) return { name: "graph", key: decodeURIComponent(graph[1]!), fresh: graph[2] !== undefined };
  if (hash.startsWith("#/open?")) {
    const candidate = /[?&]c=([^&]*)/.exec(hash)?.[1];
    return { name: "open", payload: sharePayloadFrom(hash) ?? "", ...(candidate ? { candidate: decodeURIComponent(candidate) } : {}) };
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
  if (route.name === "run") return <StoredRun key={route.key} runKey={route.key} />;
  if (route.name === "templates") return <TemplatesScreen />;
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
