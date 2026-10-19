/**
 * Stale readings (ADR 2026-10-19 D4; Slice 3), apart from the reading
 * contract so that module stays within its size.
 */

import type { LightboxLensId } from './lightboxReadings';

/**
 * A lens whose readings were made against an earlier version of the text
 * (D4). They stay on the board, labeled stale; each quote was checked again
 * against the current paragraphs and its counted support recounted. A fresh
 * reading of the lens clears the mark.
 */
export interface LightboxStaleLens {
  lens: LightboxLensId;
  /** The content hash of the text the lens was read against. */
  readAgainst: string;
}
