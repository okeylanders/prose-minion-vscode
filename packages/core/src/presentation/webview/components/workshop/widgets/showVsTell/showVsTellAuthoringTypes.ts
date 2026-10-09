/**
 * Presentation-facing projections shared by the Show vs. Tell authoring
 * controller and its modal. They carry controller-computed facts; the modal
 * maps them to copy and never re-derives a rule.
 */

import type { WorkshopWidgetSourceReference } from '@messages';

/** Presentation projection of the async generation lifecycle. */
export type ShowVsTellGenerationPhase =
  | { kind: 'idle' }
  | { kind: 'generating'; detail?: string }
  | { kind: 'failed'; message: string };

/** Why Generate is unavailable, most important first. */
export type ShowVsTellGenerateBlocker =
  | 'beat-required'
  | 'must-survive-required'
  | 'source-unavailable';

/**
 * Why Commit is unavailable, most important first. `commit-not-wired` is the
 * last entry until Slice 4 wires the commit route, so Commit is always
 * disabled in this slice; the others explain what the writer can still fix.
 */
export type ShowVsTellCommitBlocker =
  | 'generation-in-flight'
  | 'no-workup'
  | 'no-keep'
  | 'artifact-compilation-failed'
  | 'over-artifact-budget'
  | 'commit-not-wired';

export interface ShowVsTellAvailableSource {
  reference: WorkshopWidgetSourceReference;
  label: string;
  detail: string;
}

/** The exact counted body and its ceiling; `characters` is `text.length`. */
export interface ShowVsTellArtifactUsage {
  text: string;
  characters: number;
  budget: number;
}

/** Display posture of the current opening. */
export type ShowVsTellBanner = { kind: 'none' };
