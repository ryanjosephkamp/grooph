/**
 * The compile targets by name: each one's id and its title, and nothing else of its profile.
 *
 * This is what every address of the web app carries. The validator asks whether a harness has a profile, and the
 * harness choice shows a title; a profile itself (its tier map, its tools, its effort names) is the compiler's to
 * read, and the compiler is fetched when a person exports. So the profiles are not on the way in from `base.ts`
 * (`targets/index.ts` holds them), and a second target does not add its whole profile to every first load.
 *
 * A harness is known, and so passes `E_NO_TARGET`, exactly when it is named here. `test/targets.test.ts` holds
 * this list to the profile files: the same ids, the same titles.
 */

import type { HarnessId } from "../types.js";

const TITLES: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
};

export const KNOWN_TARGETS: HarnessId[] = Object.keys(TITLES);

/** Its own entry only: `constructor` is a word every object answers to, and no harness. */
export const hasProfile = (harness: HarnessId): boolean => Object.prototype.hasOwnProperty.call(TITLES, harness);

/** A target's title as a person reads it ("Claude Code"); undefined for a harness that is no target. */
export const targetTitle = (harness: HarnessId): string | undefined => (hasProfile(harness) ? TITLES[harness] : undefined);
