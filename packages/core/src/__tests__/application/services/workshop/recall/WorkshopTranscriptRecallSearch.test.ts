/**
 * Session-recall search (ADR 2026-10-05 §4): deterministic ranking, caps,
 * snippets, session-level hits, and lineage de-duplication (runway F14).
 */

import {
  buildWorkshopRecallDocument,
  WorkshopRecallDocument
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  parseWorkshopRecallQuery,
  searchWorkshopRecallDocuments,
  WorkshopRecallSearchLimits,
  WorkshopRecallSearchOutcome,
  WorkshopRecallTurnHit
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import { fixtureTurn, writerTurn } from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import { recallSession, RecallSessionInput } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import type { WorkshopTurn } from '@messages';

const LIMITS: WorkshopRecallSearchLimits = { hits: 20, hitsPerSession: 5, snippetCharacters: 280 };

const doc = (
  sessionId: string,
  turns: WorkshopTurn[],
  extra: Partial<RecallSessionInput> = {}
): WorkshopRecallDocument => buildWorkshopRecallDocument(recallSession({ sessionId, turns, ...extra }));

const say = (id: string, content: string): WorkshopTurn => writerTurn(id, { content });

const search = (
  documents: WorkshopRecallDocument[],
  query: string,
  limits: WorkshopRecallSearchLimits = LIMITS
): WorkshopRecallSearchOutcome =>
  searchWorkshopRecallDocuments(documents, parseWorkshopRecallQuery(query), limits);

const turnHits = (outcome: WorkshopRecallSearchOutcome): Array<[string, number]> =>
  outcome.sessions.flatMap((session) => session.hits
    .filter((hit): hit is WorkshopRecallTurnHit => hit.kind === 'turn')
    .map((hit) => [session.header.sessionId, hit.position] as [string, number]));

describe('parseWorkshopRecallQuery', () => {
  it('keeps distinct Unicode words, drops stop words, and stops at eight terms', () => {
    expect(parseWorkshopRecallQuery('What did the Keeper say about the lighthouse? The KEEPER!'))
      .toEqual({
        terms: ['keeper', 'say', 'lighthouse'],
        overflowTerms: [],
        phrase: ['what', 'did', 'the', 'keeper', 'say', 'about', 'the', 'lighthouse', 'the', 'keeper']
      });
    expect(parseWorkshopRecallQuery('one two three four five six seven eight nine ten'))
      .toMatchObject({
        terms: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'],
        overflowTerms: ['nine', 'ten']
      });
  });

  it('keeps the words of a query made only of stop words', () => {
    expect(parseWorkshopRecallQuery('what did we do then').terms).toEqual(['what', 'did', 'we', 'do', 'then']);
    expect(parseWorkshopRecallQuery('to be or not to be').terms).toEqual(['to', 'be', 'or', 'not']);
  });

  it('has no terms when the query has no words', () => {
    expect(parseWorkshopRecallQuery(' — … ').terms).toEqual([]);
    expect(search([doc('s', [say('t', 'Anything.')])], ' — ')).toMatchObject({
      sessions: [],
      matchedHits: 0
    });
  });
});

describe('searchWorkshopRecallDocuments', () => {
  it('finds a tool reply by its speaker, and no reply by a persona’s name (Slice 2B)', () => {
    const documents = [doc('s', [
      say('t-1', 'Run the pass.'),
      fixtureTurn('t-2', {
        participant: 'tool',
        artifact: 'tool_report',
        toolId: 'stock-and-signature',
        toolLabel: 'Stock & Signature',
        personaId: undefined,
        personaLabel: undefined,
        content: 'Three reactions lean on familiar gestures.'
      }),
      fixtureTurn('t-3', { content: 'I would start with the laughter.' }),
      fixtureTurn('t-4', { participant: 'guest', personaId: 'felix', personaLabel: 'Felix', content: 'Agreed.' })
    ])];

    const bySpeaker = search(documents, 'stock signature');
    expect(turnHits(bySpeaker)).toEqual([['s', 2]]);
    // The snippet is the visible text; the speaker leads the hit line instead.
    expect(bySpeaker.sessions[0].hits[0]).toMatchObject({ snippet: 'Three reactions lean on familiar gestures.' });
    expect(turnHits(search(documents, 'jill'))).toEqual([]);
    expect(turnHits(search(documents, 'felix'))).toEqual([]);
  });

  it('matches word prefixes, never the middle of a word', () => {
    const documents = [doc('s', [
      say('t-1', 'The lighthouse keeper.'),
      say('t-2', 'A greenhouse in spring.')
    ])];

    expect(turnHits(search(documents, 'light'))).toEqual([['s', 1]]);
    expect(turnHits(search(documents, 'house'))).toEqual([]);
  });

  it('prefers hits with every term and falls back to any term, saying which', () => {
    const documents = [doc('s', [
      say('t-1', 'The lighthouse keeper rows out.'),
      say('t-2', 'His mother waits at the lighthouse.'),
      say('t-3', 'His mother mends nets.')
    ])];

    const all = search(documents, 'lighthouse mother');
    expect(all.mode).toBe('all-terms');
    expect(turnHits(all)).toEqual([['s', 2]]);

    const any = search(documents, 'lighthouse daughter');
    expect(any.mode).toBe('any-term');
    expect(turnHits(any)).toEqual([['s', 1], ['s', 2]]);

    expect(search(documents, 'daughter').mode).toBeUndefined();
  });

  it('ranks the phrase above scattered terms, then whole words above prefixes', () => {
    const documents = [doc('s', [
      say('t-1', 'The mother of the keeper.'),
      say('t-2', 'The keeper’s mother.'),
      say('t-3', 'Tidewater rising.'),
      say('t-4', 'The tide rising.')
    ])];

    expect(turnHits(search(documents, "keeper's mother"))).toEqual([['s', 2], ['s', 1]]);
    expect(turnHits(search(documents, 'tide'))).toEqual([['s', 4], ['s', 3]]);
  });

  it('breaks ties by the newer session, then the earlier turn', () => {
    const newer = doc('newer', [say('n-1', 'skip'), say('n-2', 'Lantern.'), say('n-3', 'Lantern again.')]);
    const older = doc('older', [say('o-1', 'Lantern.')]);

    expect(turnHits(search([newer, older], 'lantern')))
      .toEqual([['newer', 2], ['newer', 3], ['older', 1]]);
    // Recency is the caller's order, nothing else.
    expect(turnHits(search([older, newer], 'lantern')))
      .toEqual([['older', 1], ['newer', 2], ['newer', 3]]);
  });

  it('is deterministic for the same documents and query', () => {
    const documents = [
      doc('a', [say('a-1', 'Salt and rope.'), say('a-2', 'Rope burns.')]),
      doc('b', [say('b-1', 'Salt on the stair.')])
    ];

    expect(search(documents, 'salt rope')).toEqual(search(documents, 'salt rope'));
  });

  it('caps hits per session and in total, and counts what it left out', () => {
    const many = (sessionId: string, count: number) =>
      doc(sessionId, Array.from({ length: count }, (_, index) => say(`${sessionId}-${index}`, 'Gull.')));
    const outcome = search(
      [many('a', 4), many('b', 4), many('c', 2)],
      'gull',
      { hits: 5, hitsPerSession: 3, snippetCharacters: 280 }
    );

    expect(outcome.sessions.map((session) => [
      session.header.sessionId,
      session.hits.length,
      session.omittedHits
    ])).toEqual([['a', 3, 1], ['b', 2, 2]]);
    expect(outcome).toMatchObject({ matchedHits: 10, shownHits: 5, sessionsWithOnlyOmittedHits: 1 });
  });

  it('cuts a snippet around the first match, within the character budget', () => {
    const filler = 'word '.repeat(200);
    const outcome = search(
      [doc('s', [say('t', `${filler}the keeper lit the lamp ${filler}`)])],
      'keeper',
      { hits: 5, hitsPerSession: 5, snippetCharacters: 80 }
    );
    const hit = outcome.sessions[0].hits[0] as WorkshopRecallTurnHit;

    expect(hit.snippet.length).toBeLessThanOrEqual(80);
    expect(hit.snippet).toContain('the keeper lit the lamp');
    expect(hit.snippet.startsWith('…')).toBe(true);
    expect(hit.snippet.endsWith('…')).toBe(true);
  });

  it('returns session-level hits for the title, excerpt label, and context labels', () => {
    const documents = [doc('s', [say('t', 'Nothing relevant.')], {
      title: 'Lighthouse at dusk',
      excerptLabel: 'chapter-6.md',
      contextLabels: ['lighthouse-notes.md', 'tides.md']
    })];

    expect(search(documents, 'lighthouse').sessions[0].hits).toEqual([{
      kind: 'session',
      matchedTerms: 1,
      phrase: false,
      title: 'Lighthouse at dusk',
      contextLabels: ['lighthouse-notes.md']
    }]);
    expect(search(documents, 'chapter').sessions[0].hits[0])
      .toMatchObject({ kind: 'session', excerptLabel: 'chapter-6.md', contextLabels: [] });
  });

  describe('lineage de-duplication (runway F14)', () => {
    const shared = [
      say('turn-1-user-1', 'We landed on the lighthouse ending.'),
      fixtureTurn('turn-2-assistant-1', { content: 'The lighthouse goes dark.' })
    ];
    const source = doc('source', shared, { title: 'Chapter 6-7' });
    const copy = doc('copy', shared, { title: 'Chapter 6-7 copy' });
    const branch = doc('branch', [shared[0], say('turn-3-user-9', 'A new lighthouse idea.')], {
      title: 'Chapter 6-7 branch'
    });

    it('shows each shared turn once, in the newest session, naming the others', () => {
      const outcome = search([branch, copy, source], 'lighthouse');

      expect(turnHits(outcome)).toEqual([['branch', 1], ['branch', 2], ['copy', 2]]);
      const hits = outcome.sessions.flatMap((session) => session.hits) as WorkshopRecallTurnHit[];
      expect(hits[0].alsoIn).toEqual([
        { sessionId: 'copy', title: 'Chapter 6-7 copy', position: 1 },
        { sessionId: 'source', title: 'Chapter 6-7', position: 1 }
      ]);
      expect(hits[2].alsoIn).toEqual([{ sessionId: 'source', title: 'Chapter 6-7', position: 2 }]);
      expect(outcome).toMatchObject({ matchedHits: 3, lineageDuplicates: 3 });
    });

    it('never lets duplicates spend the hit caps', () => {
      const outcome = search([branch, copy, source], 'lighthouse', {
        hits: 3,
        hitsPerSession: 2,
        snippetCharacters: 280
      });

      expect(turnHits(outcome)).toEqual([['branch', 1], ['branch', 2], ['copy', 2]]);
      expect(outcome.shownHits).toBe(3);
    });

    it('keeps same-id turns apart when their visible text differs only in accents or punctuation (PR 126 F-05)', () => {
      const accented = doc('accented', [say('turn-7-user-1', 'The café ending?')]);
      const plain = doc('plain', [say('turn-7-user-1', 'The cafe ending!')]);

      const outcome = search([accented, plain], 'cafe ending');

      expect(turnHits(outcome)).toEqual([['accented', 1], ['plain', 1]]);
      expect(outcome.lineageDuplicates).toBe(0);
    });

    it('keeps two different turns that happen to share an id', () => {
      const other = doc('other', [say('turn-1-user-1', 'An unrelated lighthouse.')]);

      expect(turnHits(search([other, source], 'lighthouse')))
        .toEqual([['other', 1], ['source', 1], ['source', 2]]);
    });
  });
});
