/**
 * What became of a persona reply's memory-note and file-edit trailers
 * (ADR 2026-11-17 D13): counts and closed reasons, recorded on the reply
 * turn when it commits, so the persona can be told with its next message.
 *
 * **Every frame the persona wrote is counted once.** For each kind, `cards`
 * (and `refused`) plus every drop's `count` is the number of frames of that
 * kind the reply held (PR #269 F-01).
 *
 * Host-only: the webview never receives it. It holds no title, quote, path,
 * find text or note id, and never the writer's answer to a card. It lives
 * beside the message contracts, not among them: it is session state on a
 * turn, as `workshopCapabilities` is, and no message carries it.
 */

/** Dropped when the reply was read (the extractor), either kind. */
export const WORKSHOP_TRAILER_PARSE_DROP_REASONS = ['malformed', 'misplaced', 'duplicate', 'over-cap', 'off'] as const;
export type WorkshopTrailerParseDropReason = typeof WORKSHOP_TRAILER_PARSE_DROP_REASONS[number];

/** A memory edit that decoded, dropped when it was settled against the notes. */
export const WORKSHOP_MEMORY_EDIT_TRAILER_DROP_REASONS = [
  'notes-unreadable',
  'target-not-found',
  'target-not-in-effect',
  'target-busy',
  'find-not-found',
  'find-ambiguous',
  'edits-conflict',
  'result-invalid',
  'no-change',
  'pinned-budget'
] as const;
export type WorkshopMemoryEditTrailerDropReason = typeof WORKSHOP_MEMORY_EDIT_TRAILER_DROP_REASONS[number];

/** A file-edit frame alone: too long to read, or decoded and never staged. */
export const WORKSHOP_FILE_EDIT_ONLY_TRAILER_DROP_REASONS = ['oversized', 'not-staged'] as const;

/** Every reason a memory-note frame can be dropped for, in the order a record lists them. */
export const WORKSHOP_MEMORY_TRAILER_DROP_REASONS = [
  ...WORKSHOP_TRAILER_PARSE_DROP_REASONS,
  ...WORKSHOP_MEMORY_EDIT_TRAILER_DROP_REASONS
] as const;
export type WorkshopMemoryTrailerDropReason = typeof WORKSHOP_MEMORY_TRAILER_DROP_REASONS[number];

/** Every reason a file-edit frame can be dropped for, in the order a record lists them. */
export const WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS = [
  ...WORKSHOP_TRAILER_PARSE_DROP_REASONS,
  ...WORKSHOP_FILE_EDIT_ONLY_TRAILER_DROP_REASONS
] as const;
export type WorkshopFileEditTrailerDropReason = typeof WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS[number];

export type WorkshopTrailerDropReason = WorkshopMemoryTrailerDropReason | WorkshopFileEditTrailerDropReason;

/** How many frames were dropped for one reason; `count` is at least 1. */
export interface WorkshopTrailerDrop<Reason extends WorkshopTrailerDropReason> {
  reason: Reason;
  count: number;
}

/** The reply's memory-note frames: those shown as cards, and those dropped. */
export interface WorkshopMemoryTrailerOutcomes {
  /** Frames that reached the writer as a card, in any state it settled to at commit. */
  cards: number;
  /** At most one entry per reason, in `WORKSHOP_MEMORY_TRAILER_DROP_REASONS`' order. */
  dropped: WorkshopTrailerDrop<WorkshopMemoryTrailerDropReason>[];
}

/** The reply's file-edit frames: cards the writer may apply, cards refused, and frames dropped. */
export interface WorkshopFileEditTrailerOutcomes {
  /** Frames that became a card the writer can apply. */
  cards: number;
  /** Frames that became a card already refused; the count only, never the reason. */
  refused: number;
  /** At most one entry per reason, in `WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS`' order. */
  dropped: WorkshopTrailerDrop<WorkshopFileEditTrailerDropReason>[];
}

/** A side is present only when the reply carried that kind of trailer; a reply with neither has no record. */
export interface WorkshopTrailerOutcomes {
  memory?: WorkshopMemoryTrailerOutcomes;
  fileEdits?: WorkshopFileEditTrailerOutcomes;
}
