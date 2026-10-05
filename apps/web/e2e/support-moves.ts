import type { Page } from "@playwright/test";

/** A move the page made of one view into another: how many parts were carried from a place to a place, and whether it has ended. */
export type Move = { pairs: number; ended: boolean };

/**
 * Note each view transition the page starts (`ui/become.ts`): how many of the graph's parts the browser is carrying
 * from a place before to a place after (it has a picture of each both ways), read when its pictures are ready, and
 * whether it has ended. Asked for before the page is opened. With `held`, each move is stopped where it starts, until
 * `letGo` is called in the page. `slowest` is the longest any took, from being asked for to its end, in
 * milliseconds: a browser left waiting for a change holds the page for seconds.
 *
 * It reads `ready`, so a move the browser gives up is not an error of the page's while this listens: a test of that
 * must not use it. (The same helper is in graph-space.spec.ts, which is left as it was written.)
 */
export async function noteMoves(page: Page, held = false): Promise<() => Promise<Move[]>> {
  await page.addInitScript((hold) => {
    const real = document.startViewTransition?.bind(document);
    if (!real) return;
    const log: { pairs: number; ended: boolean }[] = [];
    const took: number[] = [];
    const its = (): Animation[] => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
    const pictures = (side: string): string[] =>
      its()
        .map((a) => (a.effect as KeyframeEffect).pseudoElement!)
        .filter((part) => part.startsWith(`::view-transition-${side}(gv`))
        .map((part) => part.slice(part.indexOf("(")));
    Object.assign(window, { __moves: log, __took: took, letGo: () => its().forEach((a) => a.finish()) });
    document.startViewTransition = (update?: unknown) => {
      const from = performance.now();
      const move = real(update as ViewTransitionUpdateCallback);
      const seen = { pairs: -1, ended: false };
      const at = log.push(seen) - 1;
      void move.ready.then(
        () => {
          if (hold) its().forEach((a) => a.pause());
          const after = new Set(pictures("new"));
          seen.pairs = new Set(pictures("old").filter((name) => after.has(name))).size;
        },
        () => (seen.pairs = 0),
      );
      void move.finished.then(() => ((seen.ended = true), (took[at] = performance.now() - from)));
      return move;
    };
  }, held);
  return () => page.evaluate(() => (window as unknown as { __moves?: Move[] }).__moves ?? []);
}
export const slowest = (page: Page): Promise<number> => page.evaluate(() => Math.max(0, ...((window as unknown as { __took?: number[] }).__took ?? [])));
/** How many parts of the page still carry a name for the browser to move them by. */
export const namedStill = (page: Page): Promise<number> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".react-flow__node, .space-card, .s3-card")].filter((el) => el.style.getPropertyValue("view-transition-name")).length);

/**
 * How long each move took, from being asked for to its end, in milliseconds, for a test that runs in every engine.
 * Only the end of a move is listened to, which never fails: a move given up that nobody had read is still the
 * page's own error, and the smoke set fails on it. Asked for before the page is opened.
 */
export async function timeMoves(page: Page): Promise<() => Promise<number[]>> {
  await page.addInitScript(() => {
    const real = document.startViewTransition?.bind(document);
    if (!real) return;
    const took: number[] = [];
    Object.assign(window, { __took: took });
    document.startViewTransition = (update?: unknown) => {
      const from = performance.now();
      const move = real(update as ViewTransitionUpdateCallback);
      const at = took.push(-1) - 1;
      void move.finished.then(() => (took[at] = Math.round(performance.now() - from)));
      return move;
    };
  });
  return () => page.evaluate(() => (window as unknown as { __took?: number[] }).__took ?? []);
}
