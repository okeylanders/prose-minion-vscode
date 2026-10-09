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
 * Why Commit is unavailable, most important first: what is happening now
 * (a generation, a commit, the room, the target), then what the writer can
 * still fix in the draft. Commit is enabled exactly when this list is empty.
 */
export type ShowVsTellCommitBlocker =
  | 'generation-in-flight'
  | 'commit-in-flight'
  | 'room-run-active'
  | 'tool-target'
  | 'no-workup'
  | 'no-keep'
  | 'artifact-compilation-failed'
  | 'over-artifact-budget';

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

/** Display posture of the current opening; mapped from the opening controller. */
export type ShowVsTellBanner =
  | { kind: 'none' }
  /** A rewound message released its commit, so no chip is left behind (ADR 2026-09-30). */
  | { kind: 'clone'; from: 'committed-turn' | 'rewound-message' };
