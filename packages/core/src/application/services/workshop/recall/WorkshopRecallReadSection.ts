/**
 * One session's part of a session-recall read (ADR 2026-10-05 §4, D9): a
 * header, a packed window (WorkshopRecallReadWindow), and a footer naming
 * what was shown and where to continue, all within the share of the read
 * the allocation gave it. A session that was not read is one notice line.
 *
 * - A section whose complete text fits its share is shown complete; its
 *   length is its need, which is what water-filling compares.
 * - Otherwise the header and footer keep hard caps, so the window's room
 *   is known before any metadata renders, whatever a saved file holds (PR
 *   126 review F-01). At or above WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS a
 *   share delivers at least one entry, whole or as a readable head, so
 *   following a continuation always makes progress.
 * - In a read of several sessions each section is numbered, and its
 *   continuation names its own session with its own ranges.
 */

import { WorkshopRecallClock } from '@/application/services/workshop/recall/WorkshopRecallTime';
import {
  formatWorkshopRecallTurnRanges,
  packWorkshopRecallReadWindow,
  WORKSHOP_RECALL_BLOCK_SEPARATOR,
  WorkshopRecallCollapsedEntry,
  WorkshopRecallDeliveredRange,
  WorkshopRecallReadWindow,
  WorkshopRecallTruncatedEntry
} from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import {
  recallBlock,
  recallLabel,
  recallLabelList
} from '@/application/services/workshop/recall/WorkshopRecallText';
import {
  recallCount,
  recallQuoted,
  recallSavedAt,
  recallScopeLine,
  recallUnknownSessionLine
} from '@/application/services/workshop/recall/WorkshopRecallCopy';
import type { WorkshopRecallHeader } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type {
  WorkshopRecallReadDetail,
  WorkshopRecallSessionRead,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The context-attachment labels in a read's header. */
const READ_CONTEXT_LABEL_CHARACTERS = 2_000;
/** Participant names on one header or catalog line. */
export const RECALL_PARTICIPANT_CHARACTERS = 400;
/** Ranges one footer or header list names before counting the rest. */
const LISTED_RANGES = 12;

/**
 * A section's complete text is header + entries + footer. The header (with
 * the read's opening, on the first section) and the footer each have a hard
 * cap, so the entries' room is known before any metadata is rendered.
 */
const READ_HEADER_CHARACTERS = 4_000;
const READ_FOOTER_CHARACTERS = 1_000;
/**
 * The smallest share a read section supports: both caps, plus room for a
 * readable head of one entry. A read of N sessions needs N of them.
 */
export const WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS =
  READ_HEADER_CHARACTERS + READ_FOOTER_CHARACTERS + 1_000;

/** The smallest `readCharacters` a read naming `sessions` sessions supports: a minimum share each. */
export function workshopRecallMinimumReadCharacters(sessions: number): number {
  return Math.max(1, sessions) * WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS;
}

export interface WorkshopRecallReadSectionOptions {
  /** Epoch ms, for relative dates. */
  readonly now: number;
  readonly detail: WorkshopRecallReadDetail;
  /** Lines above the section's own: the read's opening, on the first section only. */
  readonly opening: readonly string[];
  /** Its place in a read of several sessions; absent when the read names one. */
  readonly ordinal?: { readonly index: number; readonly count: number };
}

/** One section's text, and what it showed of its session, for provenance. */
export interface WorkshopRecallRenderedSection {
  readonly text: string;
  readonly delivered: readonly WorkshopRecallDeliveredRange[];
  /** Requested turns it did not reach; empty when it reached them all. */
  readonly continuation: readonly WorkshopRecallTurnRange[];
  /** Tool reports a discussion-detail read showed as one line. */
  readonly collapsed: readonly WorkshopRecallCollapsedEntry[];
  readonly truncatedEntry?: WorkshopRecallTruncatedEntry;
}

export interface WorkshopRecallReadSection {
  /** The length of its complete text: no share needs to be larger. */
  readonly need: number;
  /**
   * Its text within `share` characters. A share below the need must be at
   * least WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS; a notice's need is far
   * below that, so water-filling always gives a notice all of it.
   */
  render(share: number): WorkshopRecallRenderedSection;
}

export function prepareWorkshopRecallReadSection(
  read: WorkshopRecallSessionRead,
  options: WorkshopRecallReadSectionOptions
): WorkshopRecallReadSection {
  if (read.outcome !== 'read') {
    const notice: WorkshopRecallRenderedSection = {
      text: recallBlock([...options.opening, noticeLine(read, options.ordinal)].join('\n'), READ_HEADER_CHARACTERS, '[notice shortened]'),
      delivered: [],
      continuation: [],
      collapsed: []
    };
    return { need: notice.text.length, render: () => notice };
  }
  // Context labels come last, so a header over its cap loses them first.
  const header = recallBlock(
    [...options.opening, ...headerLines(read.header, options), requestedLine(read), ...contextLine(read.header)].join('\n'),
    READ_HEADER_CHARACTERS,
    '[header shortened to fit the window]'
  );
  const assemble = (window: WorkshopRecallReadWindow): WorkshopRecallRenderedSection => {
    const footer = recallBlock(footerLines(read, window, options.ordinal).join('\n'), READ_FOOTER_CHARACTERS, '[footer shortened]');
    return {
      text: [header, ...window.blocks, footer].join(WORKSHOP_RECALL_BLOCK_SEPARATOR),
      delivered: window.delivered,
      continuation: window.continuation,
      collapsed: window.collapsed,
      ...(window.truncatedEntry ? { truncatedEntry: window.truncatedEntry } : {})
    };
  };
  const pack = (room: number) => packWorkshopRecallReadWindow(read.ranges, read.header.timezone, room, options.detail);
  const complete = assemble(pack(Number.POSITIVE_INFINITY));
  return {
    need: complete.text.length,
    // header + separator + blocks (each costed with its separator) + footer, the footer reserved at its cap.
    render: (share) => complete.text.length <= share
      ? complete
      : assemble(pack(share - header.length - WORKSHOP_RECALL_BLOCK_SEPARATOR.length - READ_FOOTER_CHARACTERS))
  };
}

type ReadSession = Extract<WorkshopRecallSessionRead, { outcome: 'read' }>;
type Ordinal = WorkshopRecallReadSectionOptions['ordinal'];

/** "Session 2 of 3 · " before a notice in a read of several sessions. */
function place(ordinal: Ordinal): string {
  return ordinal ? `Session ${ordinal.index} of ${ordinal.count} · ` : '';
}

function noticeLine(read: Exclude<WorkshopRecallSessionRead, ReadSession>, ordinal: Ordinal): string {
  switch (read.outcome) {
    case 'unknown-session':
      return `${place(ordinal)}${recallUnknownSessionLine(read)}`;
    case 'unreadable':
      return `${place(ordinal)}The saved session ${recallQuoted(read.title)} (id ${recallLabel(read.sessionId)}) ` +
        'could not be read; its file may be damaged or too large. Nothing from it is shown.';
    case 'not-read-by-byte-budget':
      return `${place(ordinal)}The saved session ${recallQuoted(read.title)} (id ${recallLabel(read.sessionId)}) ` +
        'was not read: the sessions before it in this read spent its reading budget. Read it on its own.';
    default:
      return assertNever(read);
  }
}

function headerLines(header: WorkshopRecallHeader, options: WorkshopRecallReadSectionOptions): string[] {
  const clock = new WorkshopRecallClock(header.timezone);
  return [
    `Session ${options.ordinal ? `${options.ordinal.index} of ${options.ordinal.count} · ` : ''}` +
      `${recallQuoted(header.title)} · id ${recallLabel(header.sessionId)}`,
    `Saved ${recallSavedAt(header.savedAt, header.timezone, options.now)} · started ${clock.date(Date.parse(header.startedAt))}`,
    `Host ${recallLabel(header.host)} · participants ${recallLabelList(header.participants, RECALL_PARTICIPANT_CHARACTERS)}`,
    ...recallScopeLine(header.scope, header.excerptLabel)
  ];
}

function contextLine(header: WorkshopRecallHeader): string[] {
  return header.contextLabels.length > 0
    ? [`Context attachments (labels only): ${recallLabelList(header.contextLabels, READ_CONTEXT_LABEL_CHARACTERS)}`]
    : [];
}

function requestedLine(read: ReadSession): string {
  const total = read.header.turnCount;
  return read.fromStart
    ? `Requested: the whole session from turn 1 (${recallCount(total, 'turn')}).`
    : `Requested: turns ${listedRanges(read.ranges)} of ${total}.`;
}

/** At most LISTED_RANGES ranges in the `<turns>` grammar, then a count of the rest. */
function listedRanges(ranges: readonly WorkshopRecallTurnRange[]): string {
  const listed = formatWorkshopRecallTurnRanges(ranges.slice(0, LISTED_RANGES));
  return ranges.length > LISTED_RANGES ? `${listed}, and ${ranges.length - LISTED_RANGES} more ranges` : listed;
}

function footerLines(read: ReadSession, window: WorkshopRecallReadWindow, ordinal: Ordinal): string[] {
  const lines: string[] = [];
  const empty = read.ranges.filter((range) => range.entries.length === 0);
  if (window.delivered.length === 0 && empty.length === read.ranges.length) {
    lines.push(
      read.header.turnCount === 0
        ? 'This session has no turns.'
        : `No visible turns in ${listedRanges(empty)}; ` +
          `this session ends at turn ${read.header.turnCount}.`
    );
    return lines;
  }
  lines.push(
    window.delivered.length === 0
      ? 'No turn fit in this window.'
      : window.continuation.length === 0
        ? `Shown: turns ${listedRanges(window.delivered)}; every requested turn is here.`
        : `Shown: turns ${listedRanges(window.delivered)}; the window is full.`
  );
  if (empty.length > 0) {
    lines.push(`No visible turns in ${listedRanges(empty)}.`);
  }
  if (window.continuation.length > 0) {
    const next = formatWorkshopRecallTurnRanges(window.continuation.slice(0, LISTED_RANGES));
    const later = window.continuation.length - LISTED_RANGES;
    // In a read of several sessions, the continuation names its own session.
    const call = ordinal
      ? `<session turns="${next}">${recallLabel(read.header.sessionId)}</session>`
      : `<turns>${next}</turns>`;
    lines.push(`Continue with ${call}${later > 0 ? `, then the ${later} further ranges requested.` : '.'}`);
  }
  return lines;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
