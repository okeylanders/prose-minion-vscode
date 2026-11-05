/**
 * What a `transcript.bookmarks` list chooses and keeps (ADR 2026-11-05 D2):
 * saved sessions from the listing alone, then the bookmarks the filters
 * admit, then the item bound. Dates are days in each holding session's own
 * zone, `<until>` whole.
 */

import {
  bookmarkCandidates,
  selectWorkshopRecallBookmarks
} from '@/application/services/workshop/recall/WorkshopRecallCorpusSelection';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

const summary = (sessionId: string, title: string, updatedAt: string, participants: string[] = ['jill']): WorkshopRecallSessionSummary => ({
  sessionId,
  title,
  updatedAt,
  timezone: 'UTC',
  hostPersonaId: 'jill',
  participantPersonaIds: participants as WorkshopRecallSessionSummary['participantPersonaIds'],
  turnCount: 4
});

// Newest first, as the service lists them.
const SESSIONS = [
  summary('s-3', 'Lighthouse 6.7', '2026-11-03T12:00:00.000Z', ['jill', 'cliff']),
  summary('s-2', 'Tea party', '2026-11-02T12:00:00.000Z'),
  summary('s-1', 'Lighthouse draft', '2026-11-01T12:00:00.000Z', ['jill', 'margot'])
];

const bookmark = (id: string, fields: Partial<WorkshopRecallBookmark> = {}): WorkshopRecallBookmark => ({
  id,
  turnId: `turn-${id}`,
  createdAt: Date.parse('2026-11-01T12:00:00.000Z'),
  position: 1,
  displayLabel: `Label ${id}`,
  speaker: { id: 'jill', label: 'Jill' },
  ...fields
});

describe('bookmarkCandidates', () => {
  it('reads every saved session, newest first, up to the session limit', () => {
    expect(bookmarkCandidates(SESSIONS, {}, 'live', 50)).toMatchObject({
      candidates: SESSIONS,
      scanned: SESSIONS,
      sessionLimit: 50
    });
    const recent = bookmarkCandidates(SESSIONS, { recent: 2 }, 'live', 50);
    expect('scanned' in recent && recent.scanned.map((session) => session.sessionId)).toEqual(['s-3', 's-2']);
  });

  it('reads the named sessions in the listing’s order, and refuses an unknown or live id with the shared copy', () => {
    const named = bookmarkCandidates(SESSIONS, { sessionIds: ['s-1', 's-3'] }, 'live', 50);
    expect('scanned' in named && named.scanned.map((session) => session.sessionId)).toEqual(['s-3', 's-1']);
    expect(bookmarkCandidates(SESSIONS, { sessionIds: ['s-1', 'nope'] }, 'live', 50))
      .toEqual({ unknown: { available: true, outcome: 'unknown-session', sessionId: 'nope', liveSession: false } });
    expect(bookmarkCandidates(SESSIONS, { sessionIds: ['live'] }, 'live', 50))
      .toEqual({ unknown: { available: true, outcome: 'unknown-session', sessionId: 'live', liveSession: true } });
  });

  it('keeps sessions by <persona> and <match>, which choose sessions, never bookmarks', () => {
    const cliff = bookmarkCandidates(SESSIONS, { personaId: 'cliff' }, 'live', 50);
    expect('scanned' in cliff && cliff.scanned.map((session) => session.sessionId)).toEqual(['s-3']);
    const lighthouse = bookmarkCandidates(SESSIONS, { match: 'lighthouse' }, 'live', 50);
    expect('scanned' in lighthouse && lighthouse.scanned.map((session) => session.sessionId)).toEqual(['s-3', 's-1']);
    expect('match' in lighthouse && lighthouse.match).toMatchObject({ text: 'lighthouse', mode: 'all-terms' });
  });

  it('throws on what the codec refuses first', () => {
    expect(() => bookmarkCandidates(SESSIONS, { recent: 51 }, 'live', 50)).toThrow(/recent/);
    expect(() => bookmarkCandidates(SESSIONS, { recent: 1, sessionIds: ['s-1'] } as never, 'live', 50)).toThrow(/recent/);
  });
});

describe('selectWorkshopRecallBookmarks', () => {
  const pool = (source: string, bookmarks: WorkshopRecallBookmark[], timezone = 'UTC') => ({ source, timezone, bookmarks });

  it('keeps the filters’ bookmarks in the order given, then bounds them, counting each left out by its rule', () => {
    const selected = selectWorkshopRecallBookmarks([
      pool('open room', [bookmark('a'), bookmark('b', { speaker: { id: 'writer', label: 'Writer' } })]),
      pool('s-3', [bookmark('c'), bookmark('d')]),
      pool('s-2', [bookmark('e')])
    ], { speaker: 'jill' }, 2);
    expect(selected.groups.map((group) => [group.source, group.bookmarks.map((row) => row.id)])).toEqual([
      ['open room', ['a']],
      ['s-3', ['c']]
    ]);
    expect(selected).toMatchObject({ kept: 2, seen: 5, notShownByFilters: 1, omittedByItemLimit: 2 });
  });

  it('matches every <query> word at the start of a word of the label or the message', () => {
    const rows = [
      bookmark('label', { displayLabel: 'The lighthouse keeper' }),
      bookmark('message', { entry: { kind: 'event', turnId: 't', timestamp: 0, text: 'Alice rows to the lighthouse' } }),
      bookmark('neither', { displayLabel: 'Tea party' })
    ];
    const ids = (query: string) => selectWorkshopRecallBookmarks([pool('s', rows)], { query }, 60).groups
      .flatMap((group) => group.bookmarks.map((row) => row.id));
    expect(ids('LIGHT')).toEqual(['label', 'message']);
    expect(ids('lighthouse alice')).toEqual(['message']);
    expect(ids('house')).toEqual([]);
    // A query with no words admits nothing, never everything.
    expect(ids('…')).toEqual([]);
  });

  it('reads <since> and <until> as days in each session’s own zone, <until> whole', () => {
    // 03:30 UTC on 5 November is 9:30 PM on 4 November in Chicago (CST, after the change back).
    const late = bookmark('late', { createdAt: Date.parse('2026-11-05T03:30:00.000Z') });
    const ids = (timezone: string, filters: { since?: string; until?: string }) =>
      selectWorkshopRecallBookmarks([pool('s', [late], timezone)], filters, 60).groups.flatMap((group) => group.bookmarks.map((row) => row.id));
    expect(ids('America/Chicago', { until: '2026-11-04' })).toEqual(['late']);
    expect(ids('UTC', { until: '2026-11-04' })).toEqual([]);
    expect(ids('UTC', { since: '2026-11-05', until: '2026-11-05' })).toEqual(['late']);
    // The last second of a day is still that day.
    const lastSecond = bookmark('last', { createdAt: Date.parse('2026-11-04T23:59:59.999Z') });
    expect(selectWorkshopRecallBookmarks([pool('s', [lastSecond])], { until: '2026-11-04' }, 60).kept).toBe(1);
    expect(selectWorkshopRecallBookmarks([pool('s', [lastSecond])], { since: '2026-11-05' }, 60).kept).toBe(0);
  });

  it('follows the zone across a daylight-saving change', () => {
    // 05:30 UTC on 9 March 2026 is 12:30 AM CDT that day; a fixed CST offset would put it on 8 March.
    const afterChange = bookmark('after', { createdAt: Date.parse('2026-03-09T05:30:00.000Z') });
    // 05:30 UTC on 8 March 2026 is 11:30 PM CST on 7 March, before the change.
    const beforeChange = bookmark('before', { createdAt: Date.parse('2026-03-08T05:30:00.000Z') });
    const days = (filters: { since?: string; until?: string }) =>
      selectWorkshopRecallBookmarks([pool('s', [beforeChange, afterChange], 'America/Chicago')], filters, 60).groups
        .flatMap((group) => group.bookmarks.map((row) => row.id));
    expect(days({ since: '2026-03-09', until: '2026-03-09' })).toEqual(['after']);
    expect(days({ since: '2026-03-08', until: '2026-03-08' })).toEqual([]);
    expect(days({ until: '2026-03-07' })).toEqual(['before']);
  });

  it('leaves out a bookmark whose time no Date can hold when a date filter is set', () => {
    const odd = bookmark('odd', { createdAt: Number.MAX_VALUE });
    expect(selectWorkshopRecallBookmarks([pool('s', [odd])], {}, 60).kept).toBe(1);
    expect(selectWorkshopRecallBookmarks([pool('s', [odd])], { since: '2026-01-01' }, 60).kept).toBe(0);
  });
});
