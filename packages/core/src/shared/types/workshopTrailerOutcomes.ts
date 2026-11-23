/**
 * What became of a persona reply's memory-note, file-edit and to-do status
 * trailers (ADR 2026-11-17 D13; ADR 2026-11-19 D7): counts and closed
 * reasons, recorded on the reply turn when it commits, so the persona can be told with its next message.
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

/**
 * A to-do status frame that decoded, dropped when it was settled against the
 * session it named (ADR 2026-11-19 D3, D7). `session-unreadable` covers a
 * file that does not decode and one that needs recovery;
 * `sessions-unavailable` a store or workspace that is not.
 */
export const WORKSHOP_TODO_SETTLEMENT_TRAILER_DROP_REASONS = [
  'session-not-found',
  'session-unreadable',
  'sessions-unavailable',
  'todo-not-found',
  'todo-not-open'
] as const;

/**
 * Every reason a to-do status frame can be dropped for, in the order a
 * record lists them. `off` never occurs: the trailer has no setting (D2).
 */
export const WORKSHOP_TODO_TRAILER_DROP_REASONS = [
  'malformed',
  'misplaced',
  'duplicate',
  'over-cap',
  ...WORKSHOP_TODO_SETTLEMENT_TRAILER_DROP_REASONS
] as const;
export type WorkshopTodoTrailerDropReason = typeof WORKSHOP_TODO_TRAILER_DROP_REASONS[number];

/**
 * Every reason a context-paths proposal frame can be dropped for (ADR
 * 2026-11-19 D27), in the order a record lists them. `nothing-kept`: every
 * pattern was dropped or refused, so no card. `workspace-unavailable`: the
 * project's folders could not be checked. `too-large`: a group's current
 * value is past what a card holds. `off` and `over-cap` never occur:
 * the trailer has no setting, and a second frame is `duplicate`.
 */
export const WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS = [
  'malformed',
  'misplaced',
  'duplicate',
  'nothing-kept',
  'workspace-unavailable',
  'too-large'
] as const;
export type WorkshopLocationsTrailerDropReason = typeof WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS[number];

/**
 * Every reason a passage-search request frame can be dropped for (ADR
 * 2026-11-20 D17), in the order a record lists them. `extra`: a second
 * frame in one reply. The rest are the host's checks at settlement: a group
 * that is no context group, a file not in its group, a file two workspace
 * folders both hold, an `<excerpt/>` in a room with no excerpt, a group
 * narrowed by a pattern the context-path rules refuse (`unsafe-match`) or by
 * one that finds no file of the group (`match-found-nothing`; S44), and a
 * listing that could not be read. `off` and `over-cap` never occur: the
 * trailer has no setting, and a second frame is `extra`.
 */
export const WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS = [
  'malformed',
  'misplaced',
  'extra',
  'unknown-group',
  'unknown-file',
  'ambiguous-file',
  'no-excerpt',
  'unsafe-match',
  'match-found-nothing',
  'catalog-unreadable'
] as const;
export type WorkshopPassageSearchTrailerDropReason = typeof WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS[number];

export type WorkshopTrailerDropReason =
  | WorkshopMemoryTrailerDropReason
  | WorkshopFileEditTrailerDropReason
  | WorkshopTodoTrailerDropReason
  | WorkshopLocationsTrailerDropReason
  | WorkshopPassageSearchTrailerDropReason;

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

/**
 * The reply's to-do status frames (ADR 2026-11-19 D7): the receipt rows made
 * at commit, in any state (`applied` or `saving`), and the frames dropped.
 * A saved row's later state is the row's, never this record's.
 */
export interface WorkshopTodoTrailerOutcomes {
  changes: number;
  /** At most one entry per reason, in `WORKSHOP_TODO_TRAILER_DROP_REASONS`' order. */
  dropped: WorkshopTrailerDrop<WorkshopTodoTrailerDropReason>[];
}

/**
 * The reply's context-paths proposal frames (ADR 2026-11-19 D27): the card
 * made (at most one), the frames dropped, and the card's patterns as the
 * checker sorted them. `incomplete` is kept apart from `unmatched`: a check
 * that did not complete is never zero matches (D22a). The writer's Apply or
 * decline is never recorded here.
 */
export interface WorkshopLocationsTrailerOutcomes {
  cards: number;
  /** At most one entry per reason, in `WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS`' order. */
  dropped: WorkshopTrailerDrop<WorkshopLocationsTrailerDropReason>[];
  patterns: { kept: number; unmatched: number; incomplete: number; refused: number };
}

/**
 * The reply's passage-search request frames (ADR 2026-11-20 D17): the card
 * made (at most one) and the frames dropped. Run and Cancel are the
 * writer's answers and are never recorded here.
 */
export interface WorkshopPassageSearchTrailerOutcomes {
  cards: number;
  /** At most one entry per reason, in `WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS`' order. */
  dropped: WorkshopTrailerDrop<WorkshopPassageSearchTrailerDropReason>[];
}

/** A side is present only when the reply carried that kind of trailer; a reply with none has no record. */
export interface WorkshopTrailerOutcomes {
  memory?: WorkshopMemoryTrailerOutcomes;
  fileEdits?: WorkshopFileEditTrailerOutcomes;
  todos?: WorkshopTodoTrailerOutcomes;
  locations?: WorkshopLocationsTrailerOutcomes;
  passageSearch?: WorkshopPassageSearchTrailerOutcomes;
}
