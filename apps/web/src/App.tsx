import { useEffect, useState } from "react";

import { EditorScreen } from "./ui/Editor.js";
import { Library } from "./ui/Library.js";

type Route = { name: "library" } | { name: "graph"; key: string; fresh: boolean };

/** Hash routes, so GitHub Pages needs no rewrite rules: `#/` and `#/g/<key>`. */
function parse(hash: string): Route {
  const match = /^#\/g\/([^/?]+)(\?new)?$/.exec(hash);
  return match ? { name: "graph", key: decodeURIComponent(match[1]!), fresh: match[2] !== undefined } : { name: "library" };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.name === "graph") return <EditorScreen key={route.key} graphKey={route.key} fresh={route.fresh} />;
  return (
    <Library
      open={(key, fresh) => {
        location.hash = `#/g/${encodeURIComponent(key)}${fresh ? "?new" : ""}`;
      }}
    />
  );
}
