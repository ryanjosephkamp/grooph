/**
 * A change of view in which each part is seen to go from where it was to where it is (the owner's notes of
 * 2026-10-05: "the 2D should become 3D"). The browser does the moving: before the change each part is given a name,
 * after it the part that stands for the same thing is given the same one, and a view transition carries the one to
 * the other, turning and resizing it on the way, while everything that has no name fades from the old page to the
 * new. Nothing here knows what the parts are: a graph's nodes and their cards today (`canvas/graph-views.tsx`).
 *
 * Where a reader has asked for less motion, or the browser has no view transitions, the change is made as it was
 * before this file: at once, in one paint.
 */

/** Whether a change is made at once: reduced motion, or no view transitions. */
export const still = (): boolean => typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;

// The parts that carry a name now, and which call gave it them: a change asked for while another is still moving
// takes the names over, and the earlier one's end must not take them off again.
let named: HTMLElement[] = [];
let turn = 0;

/**
 * Make a change with its parts seen to move. `parts` is asked twice, before the change and after it, for the
 * elements on the page then and the key of each: one before and one after with the same key are one thing to the
 * eye. `change` makes the change and calls `done` once the page has it, and must call it whatever happens: until
 * then the browser shows the page as it was, and takes nothing. It may call `skip` when, by the time it is asked,
 * there is nothing left to change: the move is then not made. The names are taken off again when the move has ended.
 */
export function become(parts: () => Iterable<readonly [HTMLElement, string]>, change: (done: () => void, skip: () => void) => void): void {
  if (still()) return change(() => {}, () => {});
  const keys: string[] = [];
  const mine = ++turn;
  const name = (now: Iterable<readonly [HTMLElement, string]>): void => {
    if (mine !== turn) return;
    for (const el of named) for (const what of ["name", "class"]) el.style.removeProperty(`view-transition-${what}`);
    named = [];
    for (const [el, key] of now) {
      // A key need not be a name a style sheet would take: its place in the list is.
      el.style.setProperty("view-transition-name", `gv${keys.includes(key) ? keys.indexOf(key) : keys.push(key) - 1}`);
      el.style.setProperty("view-transition-class", "gv");
      named.push(el);
    }
  };
  name(parts());
  const move = document.startViewTransition(
    () =>
      new Promise<void>((done) =>
        change(
          () => (name(parts()), done()),
          () => move.skipTransition(),
        ),
      ),
  );
  // A move the browser gives up (another began, the page is out of sight) rejects this, and nobody else reads it.
  move.ready.catch(() => {});
  const ended = (): void => name([]);
  void move.finished.then(ended, ended);
}
