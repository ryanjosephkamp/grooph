import "../../embed.css";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { piece } from "../../piece.js";
import { Embed } from "./Embed.js";
import { isEmbedHash, parseEmbedHash } from "./link.js";

// An embed's address may name one of the pictures' themes (docs/themes.md; a theme's name begins with one of five
// letters, and `light` and `dark` do not). Then the themes' piece is fetched, and it dresses the embed; with no
// theme named an embed fetches nothing more, whatever the reader's own browser has kept.
const named = (): void => {
  if (/^#\/embed\?.*theme=[bcipt]/.test(location.hash)) piece("themes", () => import("../theme/themes.js")).catch(() => undefined);
};
named();
addEventListener("hashchange", named);

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
