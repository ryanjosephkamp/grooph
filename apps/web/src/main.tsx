import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root")!);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

// Slice 0056: an embed (`#/embed?…`) loads only its own module, not the app, so a page that holds one
// fetches a fraction of what the app weighs. Everything else loads the app as before.
if (location.hash === "#/embed" || location.hash.startsWith("#/embed?")) {
  document.documentElement.classList.add("gx-page-only");
  void import("./ui/embed/EmbedApp.js").then(({ EmbedApp }) => render(<EmbedApp />));
} else {
  void Promise.all([import("@xyflow/react/dist/base.css"), import("./styles.css"), import("./App.js")]).then(([, , { App }]) => render(<App />));

  // Stage 8: once opened with a network, the app opens without one (public/sw.js). Only in a built app:
  // the dev server's modules are not files to cache.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
  }
}
