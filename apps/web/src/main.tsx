import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { piece } from "./piece.js";

const root = createRoot(document.getElementById("root")!);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

// Slice 0056: an embed (`#/embed?…`) loads only its own module, not the app, so a page that holds one
// fetches a fraction of what the app weighs. Everything else loads the app as before.
if (location.hash === "#/embed" || location.hash.startsWith("#/embed?")) {
  document.documentElement.classList.add("gx-page-only");
  void piece("EmbedApp", () => import("./ui/embed/EmbedApp.js")).then(({ EmbedApp }) => render(<EmbedApp />));
} else {
  // The stylesheets in order (React Flow's base, then the app's, which overrides it), the app beside them.
  const css = import("@xyflow/react/dist/base.css").then(() => import("./styles.css"));
  // An address that opens on a screen that draws on the canvas waits for those screens too (slice 0069); index.html
  // has already asked for them beside the app, so this costs no round of its own. Any other address does not wait.
  const app = Promise.all([css, import("./App.js")]).then(async ([, loaded]) => {
    if (loaded.needsScreens(location.hash)) await loaded.loadScreens().catch(() => undefined);
    render(<loaded.App />);
    return loaded;
  });

  // Stage 8: once opened with a network, the app opens without one (public/sw.js). Only in a built app:
  // the dev server's modules are not files to cache.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
    // The worker caches at install what index.html names; the app's own chunks load from code, before it is in control.
    // Once it is, ask for them again through it, so a first visit leaves everything a visit with no network needs.
    const warm = () => {
      for (const entry of performance.getEntriesByType("resource")) if (entry.name.includes("/assets/")) void fetch(entry.name).catch(() => undefined);
    };
    // That waits for the canvas screens, which on the front page arrive after the first screen is up.
    if (!navigator.serviceWorker.controller) {
      const all = () =>
        app
          .then((loaded) => loaded.loadScreens())
          .catch(() => undefined)
          .then(warm);
      navigator.serviceWorker.addEventListener("controllerchange", () => void all(), { once: true });
    }
  }
}
