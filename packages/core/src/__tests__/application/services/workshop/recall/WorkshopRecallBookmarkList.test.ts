/**
 * The bookmark list's text (ADR 2026-11-05 D2): whole items only, each
 * message capped with a hint that decodes as written, every bound in the
 * footer, a hard cap whatever a saved file holds, and one bookmark's
 * message read in windows.
 */

import {
  renderWorkshopRecallBookmarkMessage,
  renderWorkshopRecallBookmarks,
  WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkList';
import type {
  WorkshopRecallBookmarksBounds,
  WorkshopRecallBookmarksResult,
  WorkshopRecallListedBookmark
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { decodeWorkshopPersistedSessionCheckpoint } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
const codec = new WorkshopCapabilityXmlCodec();
const NOW = Date.parse('2026-11-05T12:00:00.000Z');
const document = buildWorkshopRecallDocument(
  decodeWorkshopPersistedSessionCheckpoint(require('../../../../fixtures/workshop-session-v2-wayfinding-bookmarks.json')).session
);
const SAVED = { kind: 'saved' as const, header: document.header };
const CURRENT = { kind: 'current' as const, liveSessionId: 'room-7', timezone: 'America/Chicago', turnCount: 12 };

const bounds = (fields: Partial<WorkshopRecallBookmarksBounds> = {}): WorkshopRecallBookmarksBounds => ({
  openRoom: 'read',
  corpusSessions: 1,
  sessionLimit: 50,
  sessionsScanned: 1,
  notScannedBySessionLimit: 0,
  notScannedByByteBudget: 0,
  bookmarksSeen: 2,
  notShownByFilters: 0,
  omittedByItemLimit: 0,
  parsedBytes: 0,
  unreadableSessions: 0,
  unreadableBytesCharged: 0,
  cacheHits: 0,
  listingTruncated: false,
  ...fields
});

const row = (index: number, text: string, source: 'saved' | 'current' = 'saved'): WorkshopRecallListedBookmark => ({
  ...document.bookmarks[0],
  id: `bookmark-${index}-5000`,
  turnId: `turn-${index}`,
  displayLabel: `Alice's mark ${index}`,
  entry: { kind: 'event', turnId: `turn-${index}`, timestamp: 5000, text },
  ref: source === 'saved'
    ? { source: 'saved', sessionId: document.header.sessionId, bookmarkId: `bookmark-${index}-5000` }
    : { source: 'current', liveSessionId: CURRENT.liveSessionId, bookmarkId: `bookmark-${index}-5000` }
});

const listed = (
  groups: Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' }>['groups'],
  fields: Partial<WorkshopRecallBookmarksBounds> = {}
): Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' }> => ({
  available: true,
  outcome: 'bookmarks',
  scope: 'all',
  filters: {},
  groups,
  bounds: bounds(fields)
});

const inspectBookmarks = (body: string) =>
  codec.inspect(`<prose-minion-tool-call name="transcript.bookmarks">${body}</prose-minion-tool-call>`);

describe('renderWorkshopRecallBookmarks', () => {
  it('opens with the framing line, this conversation first, and shows each bookmark with its ref and message', () => {
    const text = renderWorkshopRecallBookmarks(listed([
      { source: CURRENT, bookmarks: [row(1, 'The keeper climbs.', 'current')] },
      { source: SAVED, bookmarks: document.bookmarks.map((bookmark) => ({
        ...bookmark,
        ref: { source: 'saved' as const, sessionId: document.header.sessionId, bookmarkId: bookmark.id }
      })) }
    ]), { now: NOW }).content;
    expect(text.startsWith('Quoted record of saved Workshop sessions')).toBe(true);
    expect(text.indexOf('This conversation (the open room)')).toBeLessThan(text.indexOf('“Wayfinding bookmarks”'));
    expect(text).toContain('ref current@room-7/bookmark-1-5000');
    expect(text).toContain(`ref wayfinding-bookmarks/bookmark-1-2000`);
    expect(text).toContain('[bookmark “Alice\'s reply” · turn 4 ·');
    expect(text).toContain('[bookmark “You · Why does the jar matter?” · turn 2 · Writer ·');
    expect(text).toContain('Why does the jar matter?');
  });

  it('cuts a long message at its cap, with a hint that decodes exactly as written to the rest', () => {
    const long = `Alice ${'rows out at dawn. '.repeat(400)}`;
    const rendered = renderWorkshopRecallBookmarks(listed([{ source: SAVED, bookmarks: [row(1, long)] }]), { now: NOW });
    const hint = /read the rest with (<bookmark>[^<]+<\/bookmark> <from>\d+<\/from>)\]/.exec(rendered.content)?.[1];
    expect(rendered.content).toContain(`[message cut: ${budgets.bookmarkMessageCharacters.toLocaleString('en-US')} of ` +
      `${long.length.toLocaleString('en-US')} characters shown;`);
    expect(rendered.content).toContain(long.slice(0, budgets.bookmarkMessageCharacters));
    expect(rendered.content).not.toContain(long.slice(0, budgets.bookmarkMessageCharacters + 1));
    expect(inspectBookmarks(hint!)).toEqual({
      kind: 'request',
      request: {
        capability: 'transcript.bookmarks',
        bookmark: { source: 'saved', sessionId: document.header.sessionId, bookmarkId: 'bookmark-1-5000' },
        from: budgets.bookmarkMessageCharacters
      }
    });
    expect(rendered.cutMessages).toBe(1);
    expect(rendered.content).toContain('Messages longer than 4,000 characters are cut');
  });

  it('shows whole items only, within the cap, and says how many did not fit', () => {
    const rows = Array.from({ length: 12 }, (_, index) => row(index + 1, `Alice ${'x'.repeat(budgets.bookmarkMessageCharacters + 50)}`));
    const rendered = renderWorkshopRecallBookmarks(listed([{ source: SAVED, bookmarks: rows }]), { now: NOW });
    expect(rendered.content.length).toBeLessThanOrEqual(budgets.bookmarkCharacters);
    expect(rendered.shown.length).toBeGreaterThan(0);
    expect(rendered.shown.length + rendered.notShownForSpace).toBe(12);
    // Every header shown has its whole message and its cut notice after it.
    const headers = rendered.content.match(/\[bookmark /g) ?? [];
    const notices = rendered.content.match(/\[message cut: /g) ?? [];
    expect(headers).toHaveLength(rendered.shown.length);
    expect(notices).toHaveLength(rendered.shown.length);
    expect(rendered.content).toContain(`${rendered.notShownForSpace} more bookmark${rendered.notShownForSpace === 1 ? '' : 's'} did not fit in this listing.`);
    expect(rendered.content).toContain('Narrow the list with <scope>, <session>, <recent>, <match>, <query>, <speaker>, <since> or <until>.');
  });

  it('states every bound the service disclosed', () => {
    const text = renderWorkshopRecallBookmarks(listed([{ source: SAVED, bookmarks: [row(1, 'short')] }], {
      corpusSessions: 70,
      sessionsScanned: 48,
      notScannedBySessionLimit: 20,
      notScannedByByteBudget: 2,
      unreadableSessions: 1,
      listingTruncated: true,
      notShownByFilters: 5,
      omittedByItemLimit: 3,
      openRoom: 'unavailable'
    }), { now: NOW }).content;
    for (const words of [
      'This conversation\'s bookmarks could not be read.',
      'Read 48 of 70 saved sessions.',
      'Not read: 20 older past the 50-session limit; 2 past this call\'s reading budget.',
      '1 session could not be read and was skipped.',
      'the oldest were not listed',
      '5 bookmarks did not match the filters.',
      `3 more bookmarks past the ${budgets.bookmarkItems}-bookmark limit.`
    ]) {
      expect(text).toContain(words);
    }
  });

  it('stays within its cap whatever a saved file holds, and refuses a cap below its minimum', () => {
    const huge = 'T'.repeat(50_000);
    const header = { ...document.header, title: huge, excerptLabel: huge };
    const rows = Array.from({ length: 30 }, (_, index) => ({ ...row(index + 1, huge), displayLabel: huge, speaker: { label: huge } }));
    for (const cap of [WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS, budgets.bookmarkCharacters]) {
      const rendered = renderWorkshopRecallBookmarks(listed([{ source: { kind: 'saved', header }, bookmarks: rows }]), {
        now: NOW,
        bookmarkCharacters: cap
      });
      expect(rendered.content.length).toBeLessThanOrEqual(cap);
      expect(rendered.shown.length).toBeGreaterThanOrEqual(1);
    }
    expect(() => renderWorkshopRecallBookmarks(listed([]), { now: NOW, bookmarkCharacters: WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS - 1 }))
      .toThrow(RangeError);
  });

  it('says so plainly when nothing matched', () => {
    expect(renderWorkshopRecallBookmarks(listed([]), { now: NOW }).content).toContain('No bookmarks to show.');
  });
});

describe('renderWorkshopRecallBookmarkMessage', () => {
  const one = (text: string, from: number): Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmark' }> => ({
    available: true,
    outcome: 'bookmark',
    source: CURRENT,
    bookmark: row(9, text, 'current'),
    from
  });

  it('reads a message in windows whose continuations decode as written, to its end', () => {
    const text = `Alice ${'climbs the stair, '.repeat(700)}`;
    let from = 0;
    const seen: string[] = [];
    for (let window = 0; window < 10; window += 1) {
      const rendered = renderWorkshopRecallBookmarkMessage(one(text, from), { now: NOW });
      seen.push(text.slice(rendered.window!.from, rendered.window!.to));
      expect(rendered.window!.to - rendered.window!.from).toBeLessThanOrEqual(budgets.bookmarkMessageCharacters);
      const next = /Continue with (<bookmark>[^<]+<\/bookmark> <from>\d+<\/from>)\./.exec(rendered.content)?.[1];
      if (!next) {
        expect(rendered.content).toContain('This is the end of the message.');
        break;
      }
      const decoded = inspectBookmarks(next);
      expect(decoded).toMatchObject({ kind: 'request', request: { bookmark: { source: 'current', liveSessionId: 'room-7' } } });
      from = (decoded as { request: { from: number } }).request.from;
    }
    expect(seen.join('')).toBe(text);
  });

  it('never cuts inside a surrogate pair', () => {
    const text = `${'a'.repeat(budgets.bookmarkMessageCharacters - 1)}😀 tail`;
    const rendered = renderWorkshopRecallBookmarkMessage(one(text, 0), { now: NOW });
    expect(rendered.window!.to).toBe(budgets.bookmarkMessageCharacters - 1);
  });

  it('says where a message ends when <from> is past it', () => {
    expect(renderWorkshopRecallBookmarkMessage(one('Alice', 40), { now: NOW }).content)
      .toContain('The message has 5 characters; nothing starts at character 40.');
  });

  it('says why a ref names nothing it may read, never retargeting it', () => {
    const ref = { source: 'current' as const, liveSessionId: 'room-6', bookmarkId: 'bookmark-1-5000' };
    expect(renderWorkshopRecallBookmarkMessage({ available: true, outcome: 'stale-bookmark-ref', ref, why: 'room-replaced' }, { now: NOW }).content)
      .toContain('names an open room that has since been replaced');
    expect(renderWorkshopRecallBookmarkMessage({ available: true, outcome: 'unknown-bookmark', ref }, { now: NOW }).content)
      .toContain('or it stands on a turn you could not see');
  });
});
