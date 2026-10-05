import "../../embed.css";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { piece } from "../../piece.js";
import { Embed } from "./Embed.js";
import { isEmbedHash, parseEmbedHash } from "./link.js";

// An embed's address may name one of the pictures' five themes that are not Paper (docs/themes.md). Then the
// themes' piece is fetched, and it dresses the embed; with none named an embed fetches nothing more, whatever the
// reader's own browser has kept. `light` and `dark` alone, Paper, and a name that is no theme's fetch nothing.
const NAMED = /^#\/embed\?(?:[^&]*&)*?theme=(?:blueprint|ink|phosphor|transit|chalk)(?:-(?:light|dark|auto))?(?:&|$)/;
const named = (): Promise<unknown> | undefined => (NAMED.test(location.hash) ? piece("themes", () => import("../theme/themes.js")).catch(() => undefined) : undefined);
addEventListener("hashchange", () => void named());
// An embed that is to be drawn in a theme is not shown in Paper first: it is held back, a moment and no longer,
// until the themes are here and have dressed it.
const asked = named();
if (asked) {
  const held = document.createElement("style");
  held.textContent = ".gx{visibility:hidden}";
  document.head.append(held);
  const shown = (): void => held.remove();
  void asked.then(shown);
  setTimeout(shown, 800);
}

/**
 * The embed as a page of its own. `main.tsx` loads this module, and not the
 * app, when the address is `#/embed?…`, so a page holding a frame fetches
 * only what an embed draws with (handoff 0056, criterion 6). The app's route
 * table renders it too, for an embed address opened inside the app.
 *
 * The page's own background is the host's (transparent), unless `frame=1`.
 */
export function EmbedApp() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onHash = () => {
      // Leaving the embed for the app: the app is a different module, so load the page again.
      if (!isEmbedHash(location.hash) && document.documentElement.classList.contains("gx-page-only")) location.reload();
      else setHash(location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("gx-page");
    return () => html.classList.remove("gx-page");
  }, []);

  const link = useMemo(() => parseEmbedHash(hash), [hash]);
  return <Embed key={link.payload} link={link} />;
}
