/**
 * Session-recall text (ADR 2026-10-05 §4, §6): framing, catalog, search, and
 * read windows with day headers, gap markers, packing, and continuation.
 */

import {
  buildWorkshopRecallDocument,
  WorkshopRecallDocument
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  parseWorkshopRecallQuery,
  searchWorkshopRecallDocuments
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch,
  WorkshopRecallRenderOptions
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS } from '@/application/services/workshop/recall/WorkshopRecallReadSection';
import { WORKSHOP_TRANSCRIPT_RECALL_FRAMING } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallReadBounds,
  WorkshopRecallReadResult,
  WorkshopRecallSearchBounds,
  WorkshopRecallSearchResult,
  WorkshopRecallSessionRead,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import {
  RECALL_ROOT,
  recallSession,
  RecallSessionInput,
  saveRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import type { WorkshopTurn } from '@messages';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');
const at = (iso: string): number => Date.parse(iso);

const doc = (
  sessionId: string,
  turns: WorkshopTurn[],
  extra: Partial<RecallSessionInput> = {}
): WorkshopRecallDocument => buildWorkshopRecallDocument(recallSession({ sessionId, turns, ...extra }));

const READ_BOUNDS: WorkshopRecallReadBounds = {
  notReadByByteBudget: 0,
  unreadableSessions: 0,
  listingTruncated: false,
  parsedBytes: 0,
  unreadableBytesCharged: 0,
  cacheHits: 0
};

/** A read naming these sessions, in full detail unless told otherwise. */
const readResult = (
  sessions: WorkshopRecallSessionRead[],
  detail: 'full' | 'discussion' = 'full'
): Extract<WorkshopRecallReadResult, { outcome: 'read' }> => ({
  available: true,
  outcome: 'read',
  detail,
  sessions,
  bounds: READ_BOUNDS
});

/** One session's read of a document: these ranges, or the whole session from turn 1. */
const sessionRead = (
  document: WorkshopRecallDocument,
  ranges?: WorkshopRecallTurnRange[]
): Extract<WorkshopRecallSessionRead, { outcome: 'read' }> => ({
  outcome: 'read',
  header: document.header,
  fromStart: ranges === undefined,
  ranges: (ranges ?? [{ from: 1, to: Math.max(1, document.header.turnCount) }]).map((range) => {
    const entries = document.entries.filter((entry) => entry.position >= range.from && entry.position <= range.to);
    return {
      ...range,
      entries,
      ...(entries.length > 0 ? { firstTurnId: entries[0].turnId, lastTurnId: entries.at(-1)!.turnId } : {})
    };
  }),
  cacheHit: false
});

const readOf = (document: WorkshopRecallDocument, ranges?: WorkshopRecallTurnRange[]) =>
  readResult([sessionRead(document, ranges)]);

/** A one-session read's text, with that session's provenance beside it. */
const renderOne = (result: WorkshopRecallReadResult, options: WorkshopRecallRenderOptions) => {
  const rendered = renderWorkshopRecallRead(result, options);
  return { content: rendered.content, ...rendered.sessions[0] };
};

/** n writer turns of `size` characters, one minute apart. */
const longRoom = (n: number, size: number): WorkshopTurn[] =>
  Array.from({ length: n }, (_, index) => writerTurn(`t-${index + 1}`, {
    content: `Turn ${index + 1}. ${'tide '.repeat(Math.ceil(size / 5))}`.slice(0, size),
    timestamp: at('2026-10-03T15:00:00.000Z') + index * 60_000
  }));

const BOUNDS: WorkshopRecallSearchBounds = {
  corpusSessions: 3,
  sessionsSearched: 3,
  notSearchedBySessionLimit: 0,
  notSearchedByByteBudget: 0,
  unreadableSessions: 0,
  listingTruncated: false,
  parsedBytes: 0,
  unreadableBytesCharged: 0,
  cacheHits: 0
};

const searched = (
  documents: WorkshopRecallDocument[],
  queryText: string,
  bounds: Partial<WorkshopRecallSearchBounds> = {}
): WorkshopRecallSearchResult => {
  const query = parseWorkshopRecallQuery(queryText);
  return {
    available: true,
    outcome: 'searched',
    queryText,
    query,
    search: searchWorkshopRecallDocuments(documents, query, { hits: 20, hitsPerSession: 5, snippetCharacters: 280 }),
    bounds: { ...BOUNDS, ...bounds }
  };
};

describe('session-recall framing', () => {
  const document = doc('s-1', [writerTurn('t-1', { content: 'Hello.' })]);
  const catalog: WorkshopRecallCatalogResult = {
    available: true, outcome: 'catalog', sessions: [], matchingSessions: 0, listingTruncated: false
  };

  it.each([
    ['catalog', renderWorkshopRecallCatalog(catalog, { now: NOW })],
    ['search', renderWorkshopRecallSearch(searched([document], 'hello'), { now: NOW })],
    ['read', renderWorkshopRecallRead(readOf(document), { now: NOW }).content],
    ['unavailable', renderWorkshopRecallCatalog({ available: false, reason: 'workspace-changed' }, { now: NOW })],
    ['unknown session', renderWorkshopRecallSearch(
      { available: true, outcome: 'unknown-session', sessionId: 'nope', liveSession: false },
      { now: NOW }
    )],
    ['unreadable', renderWorkshopRecallRead(
      readResult([{ outcome: 'unreadable', sessionId: 's-9', title: 'Broken' }]),
      { now: NOW }
    ).content]
  ])('opens the %s body with the quoted-record framing', (_kind, content) => {
    expect(content.split('\n')[0]).toBe(WORKSHOP_TRANSCRIPT_RECALL_FRAMING);
  });

  it('frames the record as reference, not instructions or memory', () => {
    expect(WORKSHOP_TRANSCRIPT_RECALL_FRAMING).toMatch(/quoted record/i);
    expect(WORKSHOP_TRANSCRIPT_RECALL_FRAMING).toMatch(/not instructions/);
    expect(WORKSHOP_TRANSCRIPT_RECALL_FRAMING).toMatch(/do not remember/);
    expect(WORKSHOP_TRANSCRIPT_RECALL_FRAMING).not.toContain('\n');
  });

  it('names the live room as the current session instead of reading it', () => {
    const content = renderWorkshopRecallRead(
      readResult([{ outcome: 'unknown-session', sessionId: 'live', liveSession: true }]),
      { now: NOW }
    ).content;

    expect(content).toContain('is the current session');
  });
});

describe('renderWorkshopRecallRead', () => {
  it('heads days in the session timezone and marks gaps in the room frames’ words', () => {
    const document = doc('s-1', [
      // 11:30 PM and 12:30 AM in Chicago: one UTC day, two local days.
      writerTurn('t-1', { content: 'Late question.', timestamp: at('2026-10-04T04:30:00.000Z') }),
      fixtureTurn('t-2', { content: 'Late answer.', timestamp: at('2026-10-04T05:30:00.000Z') }),
      writerTurn('t-3', { content: 'Morning.', timestamp: at('2026-10-04T08:30:00.000Z') })
    ], { timezone: 'America/Chicago' });

    const content = renderOne(readOf(document), { now: NOW }).content;

    expect(content).toContain('── Saturday, October 3, 2026 ──\n\n[turn 1 · 11:30 PM · Writer]\nLate question.');
    expect(content).toContain('── Sunday, October 4, 2026 ──\n\n[turn 2 · 12:30 AM · Jill]\nLate answer.');
    expect(content).toContain('[3 hours later]\n\n[turn 3 · 3:30 AM · Writer]\nMorning.');
    expect(content).not.toContain('[1 hour later]');
  });

  it('renders the header from metadata and labels only', () => {
    const document = doc('s-1', [writerTurn('t-1', { content: 'Hi.', timestamp: at('2026-10-03T15:00:00.000Z') })], {
      title: 'Lighthouse at dusk',
      savedAt: '2026-10-03T19:03:00.000Z',
      participantPersonaIds: ['jill', 'cliff'],
      scope: 'excerpt',
      excerptLabel: 'chapter-6.md',
      contextLabels: ['keeper-notes.md', 'Tide tables']
    });

    expect(renderOne(readOf(document), { now: NOW }).content.split('\n').slice(1, 7)).toEqual([
      'Session “Lighthouse at dusk” · id s-1',
      'Saved Saturday, October 3, 2026, 2:03 PM (America/Chicago), 2 days ago · started Thursday, October 1, 2026',
      'Host Jill · participants Jill, Cliff',
      'excerpt chapter-6.md',
      'Requested: the whole session from turn 1 (1 turn).',
      // Last, so a header over its cap loses context labels first.
      'Context attachments (labels only): keeper-notes.md, Tide tables'
    ]);
  });

  it('uses export phrasing for labels, private exchanges, truncation, and sources', () => {
    const document = doc('s-1', [
      writerTurn('t-1', {
        content: 'Read these.',
        messageAttachments: [{ id: 'ta-1', label: 'letters.md', words: 3 }],
        widgetCommit: {
          widgetId: 'creative-variations',
          widgetConfigId: 'wc-1',
          rail: 'thread-artifact',
          artifactId: 'ta-2',
          selectionCount: 2
        }
      }),
      writerTurn('t-2', {
        artifact: 'direct_tool_message',
        toolLabel: 'Prose Assistant',
        content: 'Tighten this.'
      }),
      fixtureTurn('t-3', {
        artifact: 'direct_tool_response',
        participant: 'tool',
        toolLabel: 'Prose Assistant',
        personaId: undefined,
        personaLabel: undefined,
        content: 'Tightened.',
        truncated: true,
        citations: [{ url: 'https://example.com/tides', title: 'Tide Atlas' }]
      }),
      dividerTurn('t-4', 'session_resume', 'Session resumed.')
    ]);

    const content = renderOne(readOf(document), { now: NOW }).content;

    expect(content).toContain(
      '[turn 1 · 9:30 AM · Writer]\nAttached: letters.md\nComposed with Creative Variations Explorer · 2 variations\nRead these.'
    );
    expect(content).toContain('[turn 2 · 9:30 AM · Writer · private with Prose Assistant]\nTighten this.');
    expect(content).toContain(
      '[turn 3 · 9:30 AM · Prose Assistant · private]\n(This reply hit the max-token limit and was cut off.)\n' +
        'Tightened.\nSources: Tide Atlas <https://example.com/tides>'
    );
    expect(content).toContain('[turn 4 · 9:30 AM · event] Session resumed.');
  });

  it('packs whole entries, ends with a continuation, and reports what it delivered', () => {
    const document = doc('s-1', longRoom(40, 900));
    const rendered = renderOne(readOf(document), { now: NOW, readCharacters: 12_000 });

    expect(rendered.content.length).toBeLessThanOrEqual(12_000);
    expect(rendered.truncatedEntry).toBeUndefined();
    const last = rendered.delivered[0].to;
    expect(rendered.delivered).toEqual([{
      from: 1,
      to: last,
      firstTurnId: 't-1',
      lastTurnId: `t-${last}`,
      entryCount: last
    }]);
    expect(rendered.continuation).toEqual([{ from: last + 1, to: 40 }]);
    expect(rendered.content.endsWith(`Continue with <turns>${last + 1}-40</turns>.`)).toBe(true);
    // The last delivered entry is whole, and nothing of the next one appears.
    const lastEntry = document.entries[last - 1].entry;
    expect(lastEntry.kind).toBe('writer');
    expect(rendered.content).toContain(`${lastEntry.kind === 'writer' ? lastEntry.content : ''}\n\nShown: turns 1-${last};`);
    expect(rendered.content).not.toContain(`[turn ${last + 1} ·`);
  });

  it('fits the default read budget', () => {
    const document = doc('s-1', longRoom(200, 2_000));
    const rendered = renderOne(readOf(document), { now: NOW });

    expect(rendered.content.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters);
    expect(rendered.continuation.length).toBe(1);
  });

  it('cuts only an entry too large for an empty window, keeping its head', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: `Opening line. ${'salt '.repeat(5_000)}` }),
      writerTurn('t-2', { content: 'Short.' })
    ]);
    const rendered = renderOne(readOf(document), { now: NOW, readCharacters: 6_000 });

    expect(rendered.content.length).toBeLessThanOrEqual(6_000);
    expect(rendered.content).toContain('Opening line. salt salt');
    expect(rendered.truncatedEntry).toMatchObject({ position: 1 });
    expect(rendered.truncatedEntry!.shownCharacters).toBeLessThan(rendered.truncatedEntry!.totalCharacters);
    expect(rendered.content).toMatch(/\[turn 1 cut here: [\d,]+ of [\d,]+ characters shown\]/);
    expect(rendered.delivered).toEqual([{ from: 1, to: 1, firstTurnId: 't-1', lastTurnId: 't-1', entryCount: 1 }]);
    expect(rendered.continuation).toEqual([{ from: 2, to: 2 }]);
  });

  it('stops before a large entry that follows others, so the next read gets it whole or cut', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: 'Short.' }),
      writerTurn('t-2', { content: 'salt '.repeat(5_000) })
    ]);
    const rendered = renderOne(readOf(document), { now: NOW, readCharacters: 6_000 });

    expect(rendered.truncatedEntry).toBeUndefined();
    expect(rendered.delivered.map(({ from, to }) => [from, to])).toEqual([[1, 1]]);
    expect(rendered.continuation).toEqual([{ from: 2, to: 2 }]);
  });

  it('reads requested ranges, marks the jump between them, and continues across them', () => {
    const document = doc('s-1', longRoom(60, 900));
    const rendered = renderOne(
      readOf(document, [{ from: 2, to: 3 }, { from: 10, to: 30 }, { from: 50, to: 52 }]),
      { now: NOW, readCharacters: 9_000 }
    );

    expect(rendered.content).toContain('Requested: turns 2-3, 10-30, 50-52 of 60.');
    expect(rendered.content).toContain('[turns 4-9 not shown]');
    expect(rendered.delivered[0]).toEqual({ from: 2, to: 3, firstTurnId: 't-2', lastTurnId: 't-3', entryCount: 2 });
    const cutAt = rendered.delivered[1].to + 1;
    expect(rendered.continuation).toEqual([{ from: cutAt, to: 30 }, { from: 50, to: 52 }]);
    expect(rendered.content).toContain(`Continue with <turns>${cutAt}-30, 50-52</turns>.`);
  });

  it('says when requested turns hold nothing visible', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: 'Hello.' }),
      dividerTurn('t-2', 'context_change', 'Context updated.')
    ]);

    expect(renderOne(readOf(document, [{ from: 2, to: 2 }, { from: 9, to: 12 }]), { now: NOW }).content)
      .toContain('No visible turns in 2, 9-12; this session ends at turn 2.');
    expect(renderOne(readOf(document, [{ from: 1, to: 1 }, { from: 9, to: 12 }]), { now: NOW }).content)
      .toContain('Shown: turns 1; every requested turn is here.\nNo visible turns in 9-12.');
    expect(renderOne(readOf(doc('s-2', [])), { now: NOW }).content)
      .toContain('This session has no turns.');
  });
});

describe('renderWorkshopRecallCatalog', () => {
  it('lists sessions newest first with absolute and relative dates, people, scope, and last turn', () => {
    const content = renderWorkshopRecallCatalog({
      available: true,
      outcome: 'catalog',
      sessions: [
        {
          sessionId: 'room-2', title: 'Chapter 6-8 bridge', savedAt: '2026-10-04T02:12:00.000Z',
          timezone: 'America/Chicago', hostPersonaId: 'jill', host: 'Jill',
          participantPersonaIds: ['jill', 'cliff'], participants: ['Jill', 'Cliff'],
          scope: 'excerpt', excerptLabel: 'chapter-6-8.md', lastTurn: 412
        },
        {
          sessionId: 'room-1', title: 'Brainstorm', savedAt: '2026-09-28T16:00:00.000Z',
          timezone: 'America/Chicago', hostPersonaId: 'cliff', host: 'Cliff',
          participantPersonaIds: ['cliff'], participants: ['Cliff'], scope: 'open', lastTurn: 9
        }
      ],
      matchingSessions: 7,
      listingTruncated: true
    }, { now: NOW });

    expect(content.split('\n').slice(1)).toEqual([
      'Saved Workshop sessions in this workspace, newest first. The current session is never listed.',
      '',
      '1. “Chapter 6-8 bridge” · id room-2',
      '   Saved Saturday, October 3, 2026, 9:12 PM (America/Chicago), 2 days ago',
      '   Host Jill · participants Jill, Cliff',
      '   excerpt chapter-6-8.md · last turn 412',
      '',
      '2. “Brainstorm” · id room-1',
      '   Saved Monday, September 28, 2026, 11:00 AM (America/Chicago), 7 days ago',
      '   Host Cliff · participants Cliff',
      '   open conversation · last turn 9',
      '',
      'Showing 2 of 7 sessions; the rest are older.',
      'This workspace holds more session files than one listing reads; the oldest were not listed.'
    ]);
  });

  it('says plainly when no session qualifies', () => {
    expect(renderWorkshopRecallCatalog({
      available: true, outcome: 'catalog', personaId: 'cliff', sessions: [], matchingSessions: 0, listingTruncated: false
    }, { now: NOW })).toContain('No other saved Workshop sessions in this workspace that include Cliff.');
  });
});

describe('renderWorkshopRecallSearch', () => {
  const shared = [
    writerTurn('turn-1-user-1', { content: 'We landed on the lighthouse ending.' }),
    fixtureTurn('turn-2-assistant-1', { content: 'The lighthouse goes dark at the end.' })
  ];
  const branch = doc('branch', shared, { title: 'Chapter 6-7 branch', updatedAt: '2026-10-04T02:00:00.000Z' });
  const source = doc('source', shared, { title: 'Chapter 6-7', contextLabels: ['lighthouse.md'] });

  it('groups hits by session, names shared copies, and points at a read', () => {
    const content = renderWorkshopRecallSearch(searched([branch, source], 'lighthouse'), { now: NOW });

    expect(content).toContain('Search: “lighthouse” · terms: lighthouse');
    expect(content).toContain('Searched 3 of 3 saved sessions; the current session is never searched.');
    expect(content).toContain('Every hit matches every term.');
    expect(content).toContain('“Chapter 6-7 branch” · id branch · saved ');
    expect(content).toContain(
      '- turn 1 · Writer: We landed on the lighthouse ending. (also in “Chapter 6-7” turn 1)'
    );
    expect(content).toContain('- turn 2 · Jill: The lighthouse goes dark at the end. (also in “Chapter 6-7” turn 2)');
    expect(content).toContain('“Chapter 6-7” · id source');
    expect(content).toContain('- session labels: context lighthouse.md');
    expect(content).toContain('Read around a hit with transcript.read, for example <session>branch</session> <turns>1-4</turns>.');
  });

  it('discloses every bound that left sessions unsearched', () => {
    const content = renderWorkshopRecallSearch(searched([branch], 'lighthouse', {
      corpusSessions: 60,
      sessionsSearched: 45,
      notSearchedBySessionLimit: 10,
      notSearchedByByteBudget: 4,
      unreadableSessions: 1,
      listingTruncated: true
    }), { now: NOW });

    expect(content).toContain(
      'Searched 45 of 60 saved sessions; the current session is never searched. ' +
        'Not searched: 10 older past the session limit; 4 past this search\'s reading budget. ' +
        '1 session could not be read and was skipped.'
    );
    expect(content).toContain('the oldest were not listed');
  });

  it('says which mode matched, and when nothing did', () => {
    expect(renderWorkshopRecallSearch(searched([branch], 'lighthouse daughter'), { now: NOW }))
      .toContain('No turn matched every term; these match some of them.');
    expect(renderWorkshopRecallSearch(searched([branch], 'daughter'), { now: NOW }))
      .toContain('No visible turn or session label matched.');
    expect(renderWorkshopRecallSearch(searched([branch], '…'), { now: NOW }))
      .toContain('The query has no words to search for.');
  });

  it('counts hits the caps left out', () => {
    const many = doc('many', Array.from({ length: 8 }, (_, index) => writerTurn(`m-${index}`, { content: 'Gull.' })));
    const content = renderWorkshopRecallSearch(searched([many], 'gull'), { now: NOW });

    expect(content).toContain('  3 more hits in this session not shown.');
    expect(content).toContain('5 of 8 hits shown.');
  });
});

describe('formatWorkshopRecallTurnRanges', () => {
  it('writes the <turns> grammar', () => {
    expect(formatWorkshopRecallTurnRanges([{ from: 38, to: 46 }, { from: 52, to: 52 }])).toBe('38-46, 52');
  });
});

describe('the composite read bound (PR 126 review F-01)', () => {
  const READ_CHARACTERS = PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters;

  /** Every requested visible position is delivered or left to continue, never both. */
  const expectAccounted = (
    rendered: { readonly delivered: readonly WorkshopRecallTurnRange[]; readonly continuation: readonly WorkshopRecallTurnRange[] },
    requested: number[]
  ): void => {
    const inRanges = (position: number, ranges: readonly WorkshopRecallTurnRange[]) =>
      ranges.some((range) => position >= range.from && position <= range.to);
    for (const position of requested) {
      expect([position, inRanges(position, rendered.delivered) !== inRanges(position, rendered.continuation)])
        .toEqual([position, true]);
    }
  };

  it('holds through the real aggregate, coordinator, and store with oversized metadata', async () => {
    const { store, coordinator, log, savedSessionId } = await saveRecallRoom('Normal title', (session, advance) => {
      session.setSessionScope('open');
      for (let index = 0; index < 1_300; index += 1) {
        session.addContextAttachment({
          kind: 'text',
          origin: 'writer',
          label: `context-note-${String(index).padStart(4, '0')}-${'x'.repeat(20)}.md`,
          content: 'word',
          words: 1
        });
      }
      advance(60_000);
      // Longer than the whole read budget, so only its head can fit.
      session.beginPersonaMessage('run-1', `Opening. ${'salt '.repeat(READ_CHARACTERS / 3)}`);
      advance(60_000);
      session.completeRun('run-1', 'A short reply.', undefined, false, 'runtime-host');
    });
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);
    const read = await service.read({ sessions: [{ sessionId: savedSessionId, turns: [{ from: 2, to: 3 }] }] });
    const whole = await service.read({ sessions: [{ sessionId: savedSessionId }] });

    const rendered = renderOne(read, { now: NOW });
    const renderedWhole = renderOne(whole, { now: NOW });

    expect(rendered.content.length).toBeLessThanOrEqual(READ_CHARACTERS);
    expect(renderedWhole.content.length).toBeLessThanOrEqual(READ_CHARACTERS);
    expect(rendered.content).toMatch(/Context attachments \(labels only\): context-note-0000-x+\.md, .*… and [\d,]+ more/);
    expect(rendered.truncatedEntry).toMatchObject({ position: 2 });
    expect(rendered.truncatedEntry!.shownCharacters).toBeLessThan(READ_CHARACTERS);
    expect(rendered.delivered.map(({ from, to }) => [from, to])).toEqual([[2, 2]]);
    expect(rendered.continuation).toEqual([{ from: 3, to: 3 }]);
    expectAccounted(rendered, [2, 3]);
  });

  it('bounds every metadata label, so metadata alone cannot exceed the window', () => {
    const document = doc('s'.repeat(5_000), [writerTurn('t-1', { content: 'Hello.' })], {
      title: 'T'.repeat(60_000),
      excerptLabel: `${'e'.repeat(60_000)}.md`,
      contextLabels: Array.from({ length: 3_000 }, (_, index) => `label-${index}-${'y'.repeat(30)}`)
    });

    const rendered = renderOne(readOf(document), { now: NOW });

    expect(rendered.content.length).toBeLessThanOrEqual(READ_CHARACTERS);
    expect(rendered.delivered).toEqual([{ from: 1, to: 1, firstTurnId: 't-1', lastTurnId: 't-1', entryCount: 1 }]);
    expect(rendered.content).toContain('Hello.');
  });

  it('keeps every supported budget within its window, and every read makes progress', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: `First. ${'salt '.repeat(1_200)}` }),
      fixtureTurn('t-2', { content: `Second. ${'tide '.repeat(300)}` }),
      // Longer than the footer's unused reserve: a share that fits two entries
      // with the reserve does not fit the complete text, so "2" is reachable.
      writerTurn('t-3', { content: `Third. ${'gull '.repeat(300)}` })
    ], { contextLabels: ['keeper-notes.md'] });
    const budgets = [
      // One character at a time from the minimum through the first entry's cut...
      ...Array.from({ length: 900 }, (_, step) => WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS + step),
      // ...then on through the first entry whole, the second, and all three.
      ...Array.from({ length: 200 }, (_, step) => WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS + 900 + step * 37)
    ];
    const outcomes = new Set<string>();
    for (const readCharacters of budgets) {
      const rendered = renderOne(readOf(document), { now: NOW, readCharacters });

      expect([readCharacters, rendered.content.length <= readCharacters]).toEqual([readCharacters, true]);
      expect([readCharacters, rendered.delivered.length]).toEqual([readCharacters, 1]);
      expectAccounted(rendered, [1, 2, 3]);
      outcomes.add(`${rendered.delivered[0].to}${rendered.truncatedEntry ? ' cut' : ''}`);
    }
    // The sweep crosses every packing outcome.
    expect([...outcomes]).toEqual(['1 cut', '1', '2', '3']);
  });
});

describe('the complete read bound for accepted, edited metadata (PR 126 re-review F-01)', () => {
  const READ_CHARACTERS = PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters;
  const SESSIONS = `${RECALL_ROOT}/prose-minion/sessions`;

  /** Save a short room, then edit its authoritative file the way a writer's tools might. */
  async function editedRoom(edit: (session: Record<string, any>) => void) {
    const room = await saveRecallRoom('Normal title', (session, advance) => {
      session.setSessionScope('open');
      session.beginPersonaMessage('run-1', 'A short question about the lighthouse.');
      advance(60_000);
      session.completeRun('run-1', 'A short reply about the lighthouse.', undefined, false, 'runtime-host');
    });
    const file = [...room.fs.files.keys()].find((name) =>
      name.startsWith(SESSIONS) && name.endsWith('.json') &&
      !name.endsWith('.summary.json') && !name.endsWith('/current.json'))!;
    const session = JSON.parse(new TextDecoder().decode(room.fs.files.get(file)));
    edit(session);
    room.fs.files.set(file, new TextEncoder().encode(JSON.stringify(session, undefined, 2)));
    return { ...room, service: new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log) };
  }

  it('fits the window when a saved file lists one participant ten thousand times', async () => {
    const { service, savedSessionId } = await editedRoom((session) => {
      session.summary.participantPersonaIds = Array.from({ length: 10_000 }, () => 'jill');
    });

    const read = await service.read({ sessions: [{ sessionId: savedSessionId, turns: [{ from: 2, to: 3 }] }] });
    const rendered = renderOne(read, { now: NOW });

    expect(read).toMatchObject({ outcome: 'read', sessions: [{ outcome: 'read', header: { participants: ['Jill'] } }] });
    expect(rendered.content.length).toBeLessThanOrEqual(READ_CHARACTERS);
    expect(rendered.delivered.map(({ from, to }) => [from, to])).toEqual([[2, 3]]);
    expect(rendered.continuation).toEqual([]);
    expect(rendered.content).toContain('Host Jill · participants Jill\n');
  });

  it('clips a reply speaker from a saved file in search and in reads', async () => {
    const speaker = 'P'.repeat(100_000);
    const { service, savedSessionId } = await editedRoom((session) => {
      for (const turn of session.workshop.turns) {
        if (turn.role === 'assistant') {
          turn.personaLabel = speaker;
        }
      }
    });

    const search = renderWorkshopRecallSearch(await service.search({ query: 'reply' }), { now: NOW });
    const read = renderOne(await service.read({ sessions: [{ sessionId: savedSessionId }] }), { now: NOW });

    expect(search.length).toBeLessThan(5_000);
    expect(search).toContain(`${'P'.repeat(199)}…: A short reply`);
    expect(read.content).toContain(`${'P'.repeat(199)}…]\nA short reply`);
  });

  it('rejects a window too small for the bounded header and footer, and the production budget clears it', () => {
    const document = doc('s-1', [writerTurn('t-1', { content: 'Hello.' })]);

    expect(() => renderOne(readOf(document), {
      now: NOW,
      readCharacters: WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS - 1
    })).toThrow(RangeError);
    expect(READ_CHARACTERS).toBeGreaterThanOrEqual(WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS);
  });

  it('keeps every supported budget within its window, and makes progress, with every header part at its bound', () => {
    const saved = doc('i'.repeat(5_000), [
      writerTurn('t-1', { content: `First. ${'salt '.repeat(2_000)}` }),
      fixtureTurn('t-2', { content: `Second. ${'tide '.repeat(600)}` }),
      writerTurn('t-3', { content: 'Third.' })
    ], {
      title: 'T'.repeat(5_000),
      excerptLabel: `${'e'.repeat(5_000)}.md`,
      contextLabels: Array.from({ length: 2_000 }, (_, index) => `${'c'.repeat(150)}-${index}.md`)
    });
    // Distinct names, so no deduplication shortens the list: the renderer bounds it on its own.
    const document = {
      ...saved,
      header: {
        ...saved.header,
        host: 'H'.repeat(5_000),
        participants: Array.from({ length: 10_000 }, (_, index) => `${'P'.repeat(300)}-${index}`)
      }
    };
    const ranges = Array.from({ length: 40 }, (_, index) => ({ from: index * 3 + 1, to: index * 3 + 1 }));
    // The fixture stresses the header: every part at its bound, near the whole header's cap.
    const header = renderOne(readOf(document, ranges), { now: NOW }).content.split('\n\n')[0];
    expect(header.length).toBeGreaterThan(3_000);
    expect(header).toContain(', … and 9,');

    for (let step = 0; step < 1_500; step += 1) {
      const readCharacters = WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS + step * 3;
      for (const request of [undefined, ranges]) {
        const rendered = renderOne(readOf(document, request), { now: NOW, readCharacters });

        expect([readCharacters, rendered.content.length <= readCharacters]).toEqual([readCharacters, true]);
        expect([readCharacters, rendered.delivered.length > 0]).toEqual([readCharacters, true]);
      }
    }
  });
});

describe('a saved time no date can hold (PR 129 review F-02)', () => {
  it('renders as unknown, never aborting a read, alone or beside a healthy session', async () => {
    const fs = new MemoryFileSystem();
    const healthy = await saveRecallRoom('Healthy', (session, advance) => {
      session.setSessionScope('open');
      advance(60_000);
      session.beginPersonaMessage('run-1', 'A short question.');
      session.completeRun('run-1', 'A short answer.', undefined, false, 'runtime-host');
    }, { fs, idPrefix: 'healthy' });
    const room = await saveRecallRoom('Far future', (session, advance) => {
      session.setSessionScope('open');
      for (let n = 1; n <= 4; n += 1) {
        advance(60_000);
        session.beginPersonaMessage(`run-${n}`, `Question ${n}. ${'salt '.repeat(400)}`);
        advance(60_000);
        session.completeRun(`run-${n}`, `Answer ${n}.`, undefined, false, 'runtime-host');
      }
    }, { fs, idPrefix: 'far' });
    // Only the final turn's time changes: finite, so the codec accepts it, but past any Date.
    const file = [...fs.files.keys()].find((name) =>
      name.startsWith(`${RECALL_ROOT}/prose-minion/sessions`) && name.endsWith('.json') &&
      !name.endsWith('.summary.json') && !name.endsWith('/current.json') &&
      new TextDecoder().decode(fs.files.get(name)!).includes(`"sessionId": "${room.savedSessionId}"`))!;
    const saved = JSON.parse(new TextDecoder().decode(fs.files.get(file)));
    saved.workshop.turns.at(-1).timestamp = Number.MAX_SAFE_INTEGER;
    fs.files.set(file, new TextEncoder().encode(JSON.stringify(saved, undefined, 2)));
    const last = saved.workshop.turns.length;
    expect((await room.store.readNamed(room.savedSessionId))!.workshop.turns.at(-1)!.timestamp).toBe(Number.MAX_SAFE_INTEGER);
    const service = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);
    const alone = await service.read({ sessions: [{ sessionId: room.savedSessionId }] });

    // A first window that never reaches the tail reads as it did before sizing the whole read.
    const first = renderOne(alone, { now: NOW, readCharacters: WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS });
    expect(first.content.length).toBeLessThanOrEqual(WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS);
    expect(first.delivered.length).toBe(1);
    expect(first.continuation.at(-1)!.to).toBe(last);
    // The whole read shows the turn, its time unknown, with no gap measured to it.
    const whole = renderOne(alone, { now: NOW }).content;
    expect(whole).toContain(`── an unknown date ──\n\n[turn ${last} · an unknown time · Jill]\nAnswer 4.`);
    expect(whole).not.toMatch(/\d{4,} days later/);
    // Beside a healthy session, both are read.
    const both = renderWorkshopRecallRead(
      await service.read({ sessions: [{ sessionId: room.savedSessionId }, { sessionId: healthy.savedSessionId }] }),
      { now: NOW, readCharacters: 2 * WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS }
    );
    expect(both.sessions.map((session) => [session.outcome, session.delivered.length > 0])).toEqual([['read', true], ['read', true]]);
    expect(both.content).toContain('A short answer.');
  });
});
