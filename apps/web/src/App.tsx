import { sharePayloadFrom } from "@grooph/core";
import { useEffect, useState } from "react";

import { EditorScreen } from "./ui/Editor.js";
import { Library } from "./ui/Library.js";
import { OpenScreen } from "./ui/open/OpenScreen.js";

type Route =
  | { name: "library" }
  | { name: "graph"; key: string; fresh: boolean }
  | { name: "open"; payload: string; candidate?: string };

/** Hash routes, so GitHub Pages needs no rewrite rules: `#/`, `#/g/<key>` and `#/open?d=<payload>[&c=<candidate>]`. */
function parse(hash: string): Route {
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
    const onHash = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.name === "graph") return <EditorScreen key={route.key} graphKey={route.key} fresh={route.fresh} />;
  if (route.name === "open") return <OpenScreen payload={route.payload} candidate={route.candidate} />;
  return (
    <Library
      open={(key, fresh) => {
        location.hash = `#/g/${encodeURIComponent(key)}${fresh ? "?new" : ""}`;
      }}
    />
  );
}
