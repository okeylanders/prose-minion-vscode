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
  WORKSHOP_TRANSCRIPT_RECALL_FRAMING
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallReadResult,
  WorkshopRecallSearchBounds,
  WorkshopRecallSearchResult,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import {
  recallSession,
  RecallSessionInput,
  saveRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopTurn } from '@messages';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');
const at = (iso: string): number => Date.parse(iso);

const doc = (
  sessionId: string,
  turns: WorkshopTurn[],
  extra: Partial<RecallSessionInput> = {}
): WorkshopRecallDocument => buildWorkshopRecallDocument(recallSession({ sessionId, turns, ...extra }));

const readOf = (
  document: WorkshopRecallDocument,
  ranges?: WorkshopRecallTurnRange[]
): Extract<WorkshopRecallReadResult, { outcome: 'read' }> => ({
  available: true,
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
      { available: true, outcome: 'unreadable', sessionId: 's-9', title: 'Broken' },
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
      { available: true, outcome: 'unknown-session', sessionId: 'live', liveSession: true },
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

    const content = renderWorkshopRecallRead(readOf(document), { now: NOW }).content;

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

    expect(renderWorkshopRecallRead(readOf(document), { now: NOW }).content.split('\n').slice(1, 7)).toEqual([
      'Session “Lighthouse at dusk” · id s-1',
      'Saved Saturday, October 3, 2026, 2:03 PM (America/Chicago), 2 days ago · started Thursday, October 1, 2026',
      'Host Jill · participants Jill, Cliff',
      'excerpt chapter-6.md',
      'Context attachments (labels only): keeper-notes.md, Tide tables',
      'Requested: the whole session from turn 1 (1 turn).'
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

    const content = renderWorkshopRecallRead(readOf(document), { now: NOW }).content;

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
    const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW, readCharacters: 12_000 });

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
    const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW });

    expect(rendered.content.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters);
    expect(rendered.continuation.length).toBe(1);
  });

  it('cuts only an entry too large for an empty window, keeping its head', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: `Opening line. ${'salt '.repeat(5_000)}` }),
      writerTurn('t-2', { content: 'Short.' })
    ]);
    const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW, readCharacters: 4_000 });

    expect(rendered.content.length).toBeLessThanOrEqual(4_000);
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
    const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW, readCharacters: 4_000 });

    expect(rendered.truncatedEntry).toBeUndefined();
    expect(rendered.delivered.map(({ from, to }) => [from, to])).toEqual([[1, 1]]);
    expect(rendered.continuation).toEqual([{ from: 2, to: 2 }]);
  });

  it('reads requested ranges, marks the jump between them, and continues across them', () => {
    const document = doc('s-1', longRoom(60, 900));
    const rendered = renderWorkshopRecallRead(
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

    expect(renderWorkshopRecallRead(readOf(document, [{ from: 2, to: 2 }, { from: 9, to: 12 }]), { now: NOW }).content)
      .toContain('No visible turns in 2, 9-12; this session ends at turn 2.');
    expect(renderWorkshopRecallRead(readOf(document, [{ from: 1, to: 1 }, { from: 9, to: 12 }]), { now: NOW }).content)
      .toContain('Shown: turns 1; every requested turn is here.\nNo visible turns in 9-12.');
    expect(renderWorkshopRecallRead(readOf(doc('s-2', [])), { now: NOW }).content)
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
    rendered: ReturnType<typeof renderWorkshopRecallRead>,
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
      session.beginPersonaMessage('run-1', `Opening. ${'salt '.repeat(20_000)}`);
      advance(60_000);
      session.completeRun('run-1', 'A short reply.', undefined, false, 'runtime-host');
    });
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);
    const read = await service.read({ sessionId: savedSessionId, turns: [{ from: 2, to: 3 }] });
    const whole = await service.read({ sessionId: savedSessionId });

    const rendered = renderWorkshopRecallRead(read, { now: NOW });
    const renderedWhole = renderWorkshopRecallRead(whole, { now: NOW });

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

    const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW });

    expect(rendered.content.length).toBeLessThanOrEqual(READ_CHARACTERS);
    expect(rendered.delivered).toEqual([{ from: 1, to: 1, firstTurnId: 't-1', lastTurnId: 't-1', entryCount: 1 }]);
    expect(rendered.content).toContain('Hello.');
  });

  it('keeps every budget, from no room for an entry upward, within its window', () => {
    const document = doc('s-1', [
      writerTurn('t-1', { content: `First. ${'salt '.repeat(600)}` }),
      fixtureTurn('t-2', { content: `Second. ${'tide '.repeat(300)}` }),
      writerTurn('t-3', { content: 'Third.' })
    ], { contextLabels: ['keeper-notes.md'] });
    // The irreducible read: header and footer, with no room for any entry.
    const floor = renderWorkshopRecallRead(readOf(document), { now: NOW, readCharacters: 0 });
    expect(floor.delivered).toEqual([]);
    expect(floor.continuation).toEqual([{ from: 1, to: 3 }]);
    expect(floor.content).toContain('No turn fit in this window.\nContinue with <turns>1-3</turns>.');

    const budgets = [
      // One character at a time through no room, 0-4 characters of room, and the first cut.
      ...Array.from({ length: 900 }, (_, step) => floor.content.length + step),
      ...Array.from({ length: 120 }, (_, step) => floor.content.length + 900 + step * 37)
    ];
    for (const readCharacters of budgets) {
      const rendered = renderWorkshopRecallRead(readOf(document), { now: NOW, readCharacters });

      expect([readCharacters, rendered.content.length <= readCharacters]).toEqual([readCharacters, true]);
      expectAccounted(rendered, [1, 2, 3]);
    }
  });
});
