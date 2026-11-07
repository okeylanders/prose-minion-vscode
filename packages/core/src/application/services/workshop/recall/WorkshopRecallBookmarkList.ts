/**
 * Model-facing text for `transcript.bookmarks` (ADR 2026-11-05 D2): the
 * writer's bookmarks, the open room first, then saved sessions newest first,
 * each group in thread order; or one bookmark's message in windows. Pure:
 * the caller supplies the service's data and the clock.
 *
 * - The body opens with the quoted-record framing line, as every recall
 *   body does, and states every bound the service disclosed. A label is the
 *   writer's own text, quoted as record text.
 * - An item is one block, shown whole or not at all: its header, its turn
 *   id and qualified ref, then its message, capped at
 *   `bookmarkMessageCharacters`. A longer message is cut at a stated point,
 *   with a hint that reads the rest: `<bookmark>` with that row's ref and
 *   `<from>`. Every hint decodes exactly as written, alone or followed
 *   together.
 * - The text never exceeds `bookmarkCharacters` (or the smaller cap the
 *   window clamp gives), whatever a saved file holds: every label is
 *   clipped, the header, footer and each item's metadata have hard caps,
 *   and whole items are packed into what is left.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import type { WorkshopRecallBookmarkScope } from '@shared/types/workshopCapabilities';
import { workshopRecallEntryText } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { WORKSHOP_RECALL_BLOCK_SEPARATOR } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { WorkshopRecallClock } from '@/application/services/workshop/recall/WorkshopRecallTime';
import { recallBlock, recallLabel } from '@/application/services/workshop/recall/WorkshopRecallText';
import {
  recallBody,
  recallCount,
  recallListingNote,
  recallMatchWords,
  recallQuoted,
  recallSavedAt,
  recallScopeLine,
  recallUnavailable,
  recallUnknownSession
} from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { writableWorkshopRecallBookmarkRef } from '@/application/services/workshop/recall/WorkshopRecallBookmarkRef';
import type {
  WorkshopRecallBookmarkSource,
  WorkshopRecallBookmarksResult,
  WorkshopRecallListedBookmark
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';

/** The framing line, the summary, and the filters; every filter at its bound is near 1,300. */
const BOOKMARK_HEADER_CHARACTERS = 1_500;
/** What was read, what was left out, and how to narrow. */
const BOOKMARK_FOOTER_CHARACTERS = 1_500;
/** One source's line; bounded labels keep it near 850. */
const BOOKMARK_SOURCE_CHARACTERS = 1_000;
/** An item's header and ref lines (near 800 at most), or its cut notice (near 400). */
const BOOKMARK_META_CHARACTERS = 1_000;
const BOOKMARK_NOTICE_CHARACTERS = 500;
/** One item: its metadata, its message at its cap, and its cut notice, with their newlines. */
const BOOKMARK_ITEM_CHARACTERS =
  BOOKMARK_META_CHARACTERS + PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkMessageCharacters + BOOKMARK_NOTICE_CHARACTERS + 2;

/**
 * The smallest supported list cap: both caps, one source line, one item, and
 * their separators. At or above it, a list with any bookmark shows at least
 * one whole. A smaller cap is a programming error.
 */
export const WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS =
  BOOKMARK_HEADER_CHARACTERS + BOOKMARK_FOOTER_CHARACTERS + BOOKMARK_SOURCE_CHARACTERS + BOOKMARK_ITEM_CHARACTERS +
  3 * WORKSHOP_RECALL_BLOCK_SEPARATOR.length;

/** A one-bookmark read's header, its source line and its ref, capped together. */
const BOOKMARK_READ_HEAD_CHARACTERS = BOOKMARK_HEADER_CHARACTERS + BOOKMARK_SOURCE_CHARACTERS;
/** A one-bookmark read whose window is a whole `bookmarkMessageCharacters`: the read's own cap. */
export const WORKSHOP_RECALL_BOOKMARK_READ_CHARACTERS =
  BOOKMARK_READ_HEAD_CHARACTERS + PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkMessageCharacters + BOOKMARK_NOTICE_CHARACTERS;
/** The smallest one-bookmark read: its head, a readable 1,000-character window, and its continuation. */
export const WORKSHOP_RECALL_MINIMUM_BOOKMARK_READ_CHARACTERS =
  BOOKMARK_READ_HEAD_CHARACTERS + 1_000 + BOOKMARK_NOTICE_CHARACTERS;

export interface WorkshopRecallBookmarkListOptions {
  /** Epoch ms, for relative dates. */
  readonly now: number;
  /** The text's hard cap. Defaults to PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkCharacters. */
  readonly bookmarkCharacters?: number;
}

export interface WorkshopRecallRenderedBookmarks {
  readonly content: string;
  /** Each bookmark the text shows, by its ref as written: what a later step may cite. */
  readonly shown: ReadonlyArray<{ readonly ref: string; readonly turnId: string; readonly sessionId?: string }>;
  /** Bookmarks in the result that did not fit. */
  readonly notShownForSpace: number;
  /** Messages the text shows cut, each with its hint. */
  readonly cutMessages: number;
}

export function renderWorkshopRecallBookmarks(
  result: WorkshopRecallBookmarksResult,
  options: WorkshopRecallBookmarkListOptions
): WorkshopRecallRenderedBookmarks {
  const nothing = (content: string): WorkshopRecallRenderedBookmarks => ({ content, shown: [], notShownForSpace: 0, cutMessages: 0 });
  if (!result.available) {
    return nothing(recallUnavailable(result));
  }
  if (result.outcome === 'unknown-session') {
    return nothing(recallUnknownSession(result));
  }
  if (result.outcome !== 'bookmarks') {
    return nothing(renderWorkshopRecallBookmarkMessage(result, { now: options.now }).content);
  }
  const cap = options.bookmarkCharacters ?? PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkCharacters;
  if (cap < WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS) {
    throw new RangeError(
      `A session-recall bookmark list needs at least ${WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS} characters; got ${cap}.`
    );
  }
  const header = recallBlock(recallBody(headerLines(result)), BOOKMARK_HEADER_CHARACTERS, '[filters shortened]');
  // header + (separator + source block)… + separator + footer, the footer reserved at its cap.
  let room = cap - header.length - WORKSHOP_RECALL_BLOCK_SEPARATOR.length - BOOKMARK_FOOTER_CHARACTERS;
  const blocks: string[] = [];
  const shown: Array<{ ref: string; turnId: string; sessionId?: string }> = [];
  const total = result.groups.reduce((sum, group) => sum + group.bookmarks.length, 0);
  let cutMessages = 0;
  let full = false;
  for (const group of result.groups) {
    const parts = [sourceLine(group.source, options.now)];
    let used = WORKSHOP_RECALL_BLOCK_SEPARATOR.length + parts[0].length;
    for (const bookmark of group.bookmarks) {
      const item = itemBlock(bookmark, group.source);
      if (used + WORKSHOP_RECALL_BLOCK_SEPARATOR.length + item.text.length > room) {
        full = true;
        break;
      }
      parts.push(item.text);
      used += WORKSHOP_RECALL_BLOCK_SEPARATOR.length + item.text.length;
      shown.push({
        ref: item.ref ?? '',
        turnId: bookmark.turnId,
        ...(group.source.kind === 'saved' ? { sessionId: group.source.header.sessionId } : {})
      });
      cutMessages += item.cut ? 1 : 0;
    }
    if (parts.length > 1) {
      blocks.push(parts.join(WORKSHOP_RECALL_BLOCK_SEPARATOR));
      room -= used;
    }
    if (full) {
      break;
    }
  }
  const notShownForSpace = total - shown.length;
  const footer = recallBlock(footerLines(result, notShownForSpace, cutMessages).join('\n'), BOOKMARK_FOOTER_CHARACTERS, '[footer shortened]');
  return {
    content: [header, ...blocks, footer].join(WORKSHOP_RECALL_BLOCK_SEPARATOR),
    shown,
    notShownForSpace,
    cutMessages
  };
}

type Listed = Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' }>;
type OneBookmark = Exclude<WorkshopRecallBookmarksResult, Listed | { available: false } | { outcome: 'unknown-session' }>;

export interface WorkshopRecallRenderedBookmarkMessage {
  readonly content: string;
  /** The window shown, as offsets in the message; absent when no message was shown. */
  readonly window?: { readonly from: number; readonly to: number; readonly total: number };
}

/**
 * One bookmark's message from `from`, in a window of at most
 * `bookmarkMessageCharacters` (and of what `characters` leaves), with the
 * continuation that reads the next window; or why there is none.
 */
export function renderWorkshopRecallBookmarkMessage(
  result: OneBookmark,
  options: { readonly now: number; readonly characters?: number }
): WorkshopRecallRenderedBookmarkMessage {
  switch (result.outcome) {
    case 'stale-bookmark-ref':
      return { content: recallBody([workshopRecallStaleBookmarkRefLine(result)]) };
    case 'unknown-bookmark':
      return {
        content: recallBody([
          `No bookmark with ref ${refWords(result.ref)} is in that session, or it stands on a turn you could not see. ` +
            'List the bookmarks again for current refs.'
        ])
      };
    case 'unreadable-session':
      return {
        content: recallBody([
          `The saved session that holds ${refWords(result.ref)} could not be read; its file may be damaged or too large.`
        ])
      };
    case 'bookmark':
      return messageWindow(result, options);
    default:
      return assertNever(result);
  }
}

/** Why a ref's source is not one recall may read now; never retargeted. */
export function workshopRecallStaleBookmarkRefLine(result: Extract<WorkshopRecallBookmarksResult, { outcome: 'stale-bookmark-ref' }>): string {
  switch (result.why) {
    case 'room-replaced':
      return `Bookmark ref ${refWords(result.ref)} names an open room that has since been replaced. ` +
        'List the open room\'s bookmarks again with <scope>current</scope> for current refs.';
    case 'now-open':
      return `Bookmark ref ${refWords(result.ref)} names a saved session that is now the open room, whose refs start with current@. ` +
        'List its bookmarks again with <scope>current</scope>.';
    case 'no-session':
      return `No saved session in this workspace holds bookmark ref ${refWords(result.ref)}. List the bookmarks again for current refs.`;
    default:
      return assertNever(result.why);
  }
}

function messageWindow(
  result: Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmark' }>,
  options: { readonly now: number; readonly characters?: number }
): WorkshopRecallRenderedBookmarkMessage {
  const { bookmark, source } = result;
  const ref = writableWorkshopRecallBookmarkRef(bookmark.ref);
  const text = messageText(bookmark);
  const head = recallBlock([
    itemHeader(bookmark, source),
    sourceLine(source, options.now),
    `turn id ${recallLabel(bookmark.turnId)}${ref ? ` · ref ${ref}` : ''}`
  ].join('\n'), BOOKMARK_READ_HEAD_CHARACTERS, '[header shortened]');
  if (result.from >= text.length) {
    return {
      content: recallBody([head, `The message has ${count(text.length)} characters; nothing starts at character ${count(result.from)}.`])
    };
  }
  const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
  // The notice's allowance covers the framing line, the range line and the continuation.
  const room = Math.min(
    budgets.bookmarkMessageCharacters,
    (options.characters ?? WORKSHOP_RECALL_BOOKMARK_READ_CHARACTERS) - head.length - BOOKMARK_NOTICE_CHARACTERS
  );
  const to = cutAt(text, result.from, Math.max(1, room));
  return {
    content: recallBody([
      head,
      `Characters ${count(result.from)}–${count(to)} of ${count(text.length)}:`,
      text.slice(result.from, to),
      windowEnd(text, to, ref)
    ]),
    window: { from: result.from, to, total: text.length }
  };
}

/**
 * What follows a window: the end only when the text ends there, else the
 * continuation, else why the rest cannot be read by ref (PR #215 F-01). A
 * window that stops at `bookmarkFromMax` never claims the message is whole.
 */
function windowEnd(text: string, to: number, ref: string | undefined): string {
  if (to >= text.length) {
    return 'This is the end of the message.';
  }
  const next = continuation(ref, to);
  if (next) {
    return `Continue with ${next}.`;
  }
  const left = `the message continues for ${count(text.length - to)} more characters`;
  return ref === undefined
    ? `[message cut: ${left}; its ref cannot be written, so the rest cannot be read by ref]`
    : `[message cut: ${left}; reading by ref stops at character ` +
      `${count(PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkFromMax)}, so the rest cannot be read by ref]`;
}

function headerLines(result: Listed): string[] {
  const sources = result.groups.length;
  const shown = result.groups.reduce((sum, group) => sum + group.bookmarks.length, 0);
  const summary = shown > 0
    ? `${recallCount(shown, 'bookmark')} the writer made, from ${recallCount(sources, 'source')}: ${scopeWords(result.scope)}.`
    : 'No bookmarks to show.';
  const filters = [
    ...(result.sessionIds !== undefined ? [`sessions ${result.sessionIds.map((id) => recallLabel(id)).join(', ')}`] : []),
    ...(result.recent !== undefined ? [`the ${recallCount(result.recent, 'most recent saved session')}`] : []),
    ...(result.personaId ? [`saved sessions that include ${workshopPersonaLabel(result.personaId)}`] : []),
    ...(result.match ? [recallMatchWords(result.match)] : []),
    ...(result.filters.query !== undefined ? [`label or message matching ${recallQuoted(result.filters.query)}`] : []),
    ...(result.filters.speaker !== undefined ? [`said by ${recallLabel(result.filters.speaker)}`] : []),
    ...(result.filters.since !== undefined ? [`made on or after ${result.filters.since}`] : []),
    ...(result.filters.until !== undefined ? [`made on or before ${result.filters.until}`] : [])
  ];
  return [
    summary,
    ...(filters.length > 0 ? [`Filters: ${filters.join('; ')}. Dates are days in each session's own timezone.`] : []),
    'Each label is the writer\'s own words, quoted as record text.'
  ];
}

function scopeWords(scope: WorkshopRecallBookmarkScope): string {
  switch (scope) {
    case 'current':
      return 'this conversation';
    case 'saved':
      return 'saved sessions, newest first';
    case 'all':
      return 'this conversation first, then saved sessions, newest first';
    default:
      return assertNever(scope);
  }
}

/** "This conversation (the open room) · …" or "“Title” · id … · saved …". */
function sourceLine(source: WorkshopRecallBookmarkSource, now: number): string {
  const line = source.kind === 'current'
    ? `This conversation (the open room) · only bookmarks on turns you could see · times in ${recallLabel(source.timezone)} · ` +
      `last turn ${source.turnCount}`
    : [
        `${recallQuoted(source.header.title)} · id ${recallLabel(source.header.sessionId)}`,
        `saved ${recallSavedAt(source.header.savedAt, source.header.timezone, now)}`,
        ...recallScopeLine(source.header.scope, source.header.excerptLabel)
      ].join(' · ');
  return recallLabel(line, BOOKMARK_SOURCE_CHARACTERS);
}

/** "[bookmark “Label” · turn 12 · Sister Agnes · bookmarked Thursday, October 1, 2026, 2:14 PM]" */
function itemHeader(bookmark: WorkshopRecallListedBookmark, source: WorkshopRecallBookmarkSource): string {
  const clock = new WorkshopRecallClock(source.kind === 'current' ? source.timezone : source.header.timezone);
  return recallLabel(
    `[bookmark ${recallQuoted(bookmark.displayLabel)} · turn ${bookmark.position} · ${recallLabel(bookmark.speaker.label)} · ` +
      `bookmarked ${clock.date(bookmark.createdAt)}, ${clock.time(bookmark.createdAt)}]`,
    BOOKMARK_META_CHARACTERS / 2
  );
}

/** One item: its header and ref, then its message at its cap, then the cut notice that reads the rest. */
function itemBlock(
  bookmark: WorkshopRecallListedBookmark,
  source: WorkshopRecallBookmarkSource
): { readonly text: string; readonly ref?: string; readonly cut: boolean } {
  const ref = writableWorkshopRecallBookmarkRef(bookmark.ref);
  const meta = [
    itemHeader(bookmark, source),
    recallLabel(`turn id ${recallLabel(bookmark.turnId)}${ref ? ` · ref ${ref}` : ''}`, BOOKMARK_META_CHARACTERS / 2)
  ];
  const text = messageText(bookmark);
  const to = cutAt(text, 0, PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkMessageCharacters);
  const lines = [...meta, text.length > 0 ? text.slice(0, to) : '(The thread shows nothing of this turn.)'];
  if (to < text.length) {
    const next = continuation(ref, to);
    lines.push(`[message cut: ${count(to)} of ${count(text.length)} characters shown; ` +
      `${next ? `read the rest with ${next}` : 'its ref cannot be written, so the rest cannot be read by ref'}]`);
  }
  return { text: lines.join('\n'), ...(ref ? { ref } : {}), cut: to < text.length };
}

/** `<bookmark>ref</bookmark> <from>N</from>`, when the ref can be written and N is one `<from>` takes. */
function continuation(ref: string | undefined, from: number): string | undefined {
  return ref !== undefined && from <= PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkFromMax
    ? `<bookmark>${ref}</bookmark> <from>${from}</from>`
    : undefined;
}

/** The message as the thread shows it: its visible text, labels included. */
function messageText(bookmark: WorkshopRecallListedBookmark): string {
  return bookmark.entry ? workshopRecallEntryText(bookmark.entry) : '';
}

/** Where a window of at most `room` characters from `from` ends, never inside a surrogate pair. */
function cutAt(text: string, from: number, room: number): number {
  let to = Math.min(text.length, from + room);
  if (to < text.length && to > from + 1 && /[\uD800-\uDBFF]/.test(text.charAt(to - 1))) {
    to -= 1;
  }
  return to;
}

function footerLines(result: Listed, notShownForSpace: number, cutMessages: number): string[] {
  const { bounds } = result;
  const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
  const savedAsked = result.scope !== 'current';
  const notScanned = [
    ...(bounds.notScannedBySessionLimit > 0
      ? [`${bounds.notScannedBySessionLimit} older past ${result.recent !== undefined
        ? `<recent>${result.recent}</recent>`
        : `the ${bounds.sessionLimit}-session limit`}`]
      : []),
    ...(bounds.notScannedByByteBudget > 0 ? [`${bounds.notScannedByByteBudget} past this call's reading budget`] : [])
  ];
  const narrow = notShownForSpace > 0 || bounds.omittedByItemLimit > 0 || notScanned.length > 0;
  return [
    ...(bounds.openRoom === 'read' ? ['Every bookmark of this conversation on a turn you could see was read.'] : []),
    ...(bounds.openRoom === 'unavailable' ? ['This conversation\'s bookmarks could not be read.'] : []),
    ...(savedAsked
      ? [`Read ${bounds.sessionsScanned} of ${recallCount(bounds.corpusSessions, 'saved session')}` +
        `${result.match || result.personaId || result.sessionIds !== undefined ? ' the filters admitted' : ''}.`]
      : []),
    ...(notScanned.length > 0 ? [`Not read: ${notScanned.join('; ')}.`] : []),
    ...(bounds.unreadableSessions > 0
      ? [`${recallCount(bounds.unreadableSessions, 'session')} could not be read and ${bounds.unreadableSessions === 1 ? 'was' : 'were'} skipped.`]
      : []),
    ...recallListingNote(bounds.listingTruncated),
    ...(bounds.notShownByFilters > 0 ? [`${recallCount(bounds.notShownByFilters, 'bookmark')} did not match the filters.`] : []),
    ...(bounds.omittedByItemLimit > 0
      ? [`${recallCount(bounds.omittedByItemLimit, 'more bookmark')} past the ${budgets.bookmarkItems}-bookmark limit.`]
      : []),
    ...(notShownForSpace > 0 ? [`${recallCount(notShownForSpace, 'more bookmark')} did not fit in this listing.`] : []),
    ...(cutMessages > 0
      ? [`Messages longer than ${count(budgets.bookmarkMessageCharacters)} characters are cut; each cut one says how to read the rest.`]
      : []),
    ...(narrow
      ? ['Narrow the list with <scope>, <session>, <recent>, <match>, <query>, <speaker>, <since> or <until>.']
      : [])
  ];
}

function refWords(ref: Parameters<typeof writableWorkshopRecallBookmarkRef>[0]): string {
  return recallLabel(writableWorkshopRecallBookmarkRef(ref) ?? ref.bookmarkId);
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
