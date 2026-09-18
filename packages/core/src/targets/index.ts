/**
 * Compile-target profiles.
 *
 * A profile is data (`packages/core/targets/<harness>.profile.json`) so a vendor
 * rename is a one-file change, as `docs/targets/claude-code.md` requires. A
 * harness id is "known" — and so passes `E_NO_TARGET` — exactly when a profile
 * for it is registered here.
 */

import claudeCode from "../../targets/claude-code.profile.json" with { type: "json" };
import type { Capability, Effort, HarnessId, Tier } from "../types.js";

export type TargetProfile = {
  harness: HarnessId;
  title: string;
  /** harness version the mapping was verified against */
  verifiedAgainst: string;
  verifiedOn: string;
  models: Record<Tier, string>;
  defaultTier: Tier;
  effort: Record<Effort, string>;
  capabilityTools: Record<string, string[]>;
  defaultCapabilities: Capability[];
  /** stable output order for tool lists */
  toolOrder: string[];
  /** budget measures the harness cannot enforce; the lead brief says so */
  advisoryBudgetMeasures: string[];
  runIdFormat: string;
};

const PROFILES: Record<string, TargetProfile> = {
  "claude-code": claudeCode as TargetProfile,
};

export type TargetId = keyof typeof PROFILES & string;

export const KNOWN_TARGETS: HarnessId[] = Object.keys(PROFILES);

export const hasProfile = (harness: HarnessId): boolean => harness in PROFILES;

export function getProfile(harness: HarnessId): TargetProfile {
  const profile = PROFILES[harness];
  if (!profile) {
    throw new Error(
      `no compile profile for target harness "${harness}"; known targets: ${KNOWN_TARGETS.join(", ")}`,
    );
  }
  return profile;
}
