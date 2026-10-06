/**
 * Slice 2C in the session-recall service (ADR 2026-10-05 D8–D11), over REAL
 * chats saved through the real aggregate, coordinator, and store: the
 * catalog's `<match>`, multi-session reads with fair shares, and the excerpt
 * summary use case end to end.
 */

import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallCatalog } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import type { WorkshopRecallCatalogResult } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { saveRecallRoom, SavedRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  RecallExcerptCorpus,
  saveExcerptCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallExcerptFixtures';

const NOW = Date.parse('2026-10-08T14:30:00.000Z');

type Cataloged = Extract<WorkshopRecallCatalogResult, { outcome: 'catalog' }>;

const recallOver = (room: Pick<SavedRecallRoom, 'store' | 'coordinator' | 'log'>) =>
  new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);

const cataloged = (result: WorkshopRecallCatalogResult): Cataloged => {
  if (!result.available || result.outcome !== 'catalog') {
    throw new Error(`Expected a catalog, got ${JSON.stringify(result)}`);
  }
  return result;
};

const titles = (result: WorkshopRecallCatalogResult): string[] =>
  cataloged(result).sessions.map((session) => session.title);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('transcript.catalog <match> (D8)', () => {
  let corpus: RecallExcerptCorpus;

  beforeAll(async () => {
    corpus = await saveExcerptCorpus({ reportWords: 40 });
  });

  it('keeps every session whose title or excerpt label matches, newest first, and reads no file', async () => {
    const reads = jest.spyOn(corpus.store, 'readNamed');

    const result = cataloged(await recallOver(corpus).catalog({ match: 'chapter 6.7' }));

    expect(titles(result)).toEqual(['Chapter 6.7 endings', 'Chapter 6.7 cliché pass', 'Stock & signature']);
    expect(result).toMatchObject({
      matchingSessions: 3,
      match: { text: 'chapter 6.7', query: { terms: ['chapter', '6', '7'], overflowTerms: [] }, mode: 'all-terms' }
    });
    expect(reads).not.toHaveBeenCalled();
  });

  it('finds a title-only hit and an excerpt-only hit', async () => {
    const result = cataloged(await recallOver(corpus).catalog({ match: 'chapter 6.7' }));
    const byId = new Map(result.sessions.map((session) => [session.sessionId, session]));

    // Title only: an open conversation has no excerpt label.
    expect(byId.get(corpus.sessions.endings)).toMatchObject({ title: 'Chapter 6.7 endings', scope: 'open' });
    expect(byId.get(corpus.sessions.endings)).not.toHaveProperty('excerptLabel');
    // Excerpt only: the title says nothing of 6.7.
    expect(byId.get(corpus.sessions.stock)).toMatchObject({
      title: 'Stock & signature',
      excerptLabel: 'chapter-6.7-draft.md'
    });
    expect(byId.has(corpus.sessions.decoy)).toBe(false);
  });

  it.each(['chapter-6.7', 'chapter-6-7', 'Chapter 6.7', 'chapter 6 7'])(
    'reads %p the same way', async (match) => {
      expect(titles(await recallOver(corpus).catalog({ match })))
        .toEqual(['Chapter 6.7 endings', 'Chapter 6.7 cliché pass', 'Stock & signature']);
    }
  );

  it('never matches a context-attachment label, which stays a search feature', async () => {
    await saveRecallRoom('Notes only', (session) => {
      session.setSessionScope('open');
      session.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'chapter-6.7-notes.md', content: 'Notes.', words: 1
      });
    }, { fs: corpus.fs, idPrefix: 'notes' });

    const result = cataloged(await recallOver(corpus).catalog({ match: 'chapter 6.7' }));

    expect(titles(result)).not.toContain('Notes only');
    expect(cataloged(await recallOver(corpus).catalog({})).matchingSessions).toBe(5);
  });

  it('combines with <persona>', async () => {
    expect(titles(await recallOver(corpus).catalog({ personaId: 'margot', match: 'chapter 6.7' })))
      .toEqual(['Chapter 6.7 endings']);
    expect(titles(await recallOver(corpus).catalog({ personaId: 'margot', match: 'bridge' }))).toEqual([]);
  });

  it('says what it matched on and how, in the text', async () => {
    const service = recallOver(corpus);
    const content = renderWorkshopRecallCatalog(await service.catalog({ match: 'chapter-6.7' }), { now: NOW });
    const none = renderWorkshopRecallCatalog(await service.catalog({ match: 'lighthouse', personaId: 'jill' }), { now: NOW });

    expect(content.split('\n')[1]).toBe(
      'Saved Workshop sessions in this workspace with a title or excerpt label matching “chapter-6.7” ' +
      '(terms: chapter, 6, 7; every term matched), newest first. The current session is never listed.'
    );
    expect(content).toContain('excerpt chapter-6.7-draft.md');
    expect(none.split('\n')[1]).toBe(
      'No other saved Workshop sessions in this workspace that include Jill, with a title or excerpt label ' +
      'matching “lighthouse” (terms: lighthouse; no session matched).'
    );
  });
});

describe('transcript.catalog <match> disclosure and exhaustiveness', () => {
  it('names the terms it never evaluated, past the eight-term limit (PR 127 F-01)', async () => {
    const corpus = await saveExcerptCorpus({ reportWords: 40 });
    await corpus.store.renameNamed(corpus.sessions.cliche, 'alpha beta gamma delta epsilon zeta eta theta');
    const match = 'alpha beta gamma delta epsilon zeta eta theta lighthouse';
    expect(match.length).toBeLessThan(PROMPT_BUDGETS.workshopTranscriptRecall.todoMatchCharacters);

    const result = cataloged(await recallOver(corpus).catalog({ match }));
    const content = renderWorkshopRecallCatalog(result, { now: NOW });

    expect(result).toMatchObject({ match: { mode: 'all-terms', query: { overflowTerms: ['lighthouse'] } }, matchingSessions: 1 });
    expect(content).toContain(
      '(terms: alpha, beta, gamma, delta, epsilon, zeta, eta, theta; every evaluated term matched; ' +
      'not evaluated, past the eight-term limit: lighthouse), newest first.'
    );
    expect(content).not.toContain('every term matched');
  });

  it('counts every match across more sessions than it lists, and never lists the live room', async () => {
    const fs = new MemoryFileSystem();
    let last: SavedRecallRoom | undefined;
    for (let take = 1; take <= 55; take += 1) {
      const decoy = take % 18 === 0;
      last = await saveRecallRoom(`Chapter ${decoy ? '6.8' : '6.7'} take ${take}`, (session, advance) => {
        advance(take * 60_000);
        session.setSessionScope('open');
      }, { fs, idPrefix: `take-${take}` });
    }
    const room = last!;
    const reads = jest.spyOn(room.store, 'readNamed');
    const catalogSessions = PROMPT_BUDGETS.workshopTranscriptRecall.catalogSessions;

    const result = cataloged(await recallOver(room).catalog({ match: 'chapter-6-7' }));

    // 55 sessions, three of them 6.8 decoys: 52 match, past the 50-session cap.
    expect(result.matchingSessions).toBe(52);
    expect(result.sessions).toHaveLength(catalogSessions);
    expect(result.sessions[0].title).toBe('Chapter 6.7 take 55');
    expect(titles(result).every((title) => title.startsWith('Chapter 6.7 '))).toBe(true);
    expect(renderWorkshopRecallCatalog(result, { now: NOW }))
      .toContain(`Showing ${catalogSessions} of 52 matching sessions; the rest are older.`);
    expect(reads).not.toHaveBeenCalled();

    // The newest match becomes the live room: it is never listed, nor counted.
    await room.coordinator.openNamed(result.sessions[0].sessionId);
    const live = cataloged(await recallOver(room).catalog({ match: 'chapter-6-7' }));
    expect(live.matchingSessions).toBe(51);
    expect(titles(live)).not.toContain('Chapter 6.7 take 55');
    expect(live.sessions[0].title).toBe('Chapter 6.7 take 53'); // take 54 is a 6.8 decoy
  });
});
