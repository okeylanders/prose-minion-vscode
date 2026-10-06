/**
 * Slice 2C in the session-recall service (ADR 2026-10-05 D8–D11), over REAL
 * chats saved through the real aggregate, coordinator, and store: the
 * catalog's `<match>`, multi-session reads with fair shares, and the excerpt
 * summary use case end to end.
 */

import {
  WORKSHOP_TRANSCRIPT_RECALL_LIMITS,
  WorkshopTranscriptRecallService
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallReadResult,
  WorkshopRecallSessionRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  RECALL_ROOT,
  saveRecallRoom,
  SavedRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  EXCERPT_REPORT_PASSES,
  EXCERPT_SENTINELS,
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

type Read = Extract<WorkshopRecallReadResult, { outcome: 'read' }>;

const readOf = (result: WorkshopRecallReadResult): Read => {
  if (!result.available) {
    throw new Error(`Expected a read, got ${JSON.stringify(result)}`);
  }
  return result;
};

/** Each named session's outcome, with its title when it was read. */
const outcomes = (result: WorkshopRecallReadResult): Array<[WorkshopRecallSessionRead['outcome'], string?]> =>
  readOf(result).sessions.map((session) =>
    (session.outcome === 'read' ? [session.outcome, session.header.title] : [session.outcome]));

const replaceBudgets = (overrides: Partial<typeof PROMPT_BUDGETS.workshopTranscriptRecall>) =>
  jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', {
    ...PROMPT_BUDGETS.workshopTranscriptRecall,
    ...overrides
  });

/** The authoritative file of a saved session, found by its id. */
const namedFile = (room: Pick<SavedRecallRoom, 'fs'>, sessionId: string): string => {
  const directory = `${RECALL_ROOT}/prose-minion/sessions`;
  return [...room.fs.files.keys()].find((file) =>
    file.startsWith(directory) && file.endsWith('.json') && !file.endsWith('.summary.json') &&
    !file.endsWith('/current.json') && new TextDecoder().decode(room.fs.files.get(file)!).includes(`"sessionId": "${sessionId}"`))!;
};

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

describe('transcript.read of several sessions (D9)', () => {
  let corpus: RecallExcerptCorpus;

  beforeEach(async () => {
    corpus = await saveExcerptCorpus({ reportWords: 40 });
  });

  it('reads the sessions in the order asked, each from its own ranges, in discussion detail by default', async () => {
    const { sessions } = corpus;
    const service = recallOver(corpus);

    const several = readOf(await service.read({
      sessions: [{ sessionId: sessions.endings }, { sessionId: sessions.stock, turns: [{ from: 3, to: 4 }, { from: 1, to: 2 }] }]
    }));
    expect(several.detail).toBe('discussion');
    expect(several.sessions).toMatchObject([
      { outcome: 'read', header: { title: 'Chapter 6.7 endings' }, fromStart: true },
      { outcome: 'read', header: { title: 'Stock & signature' }, fromStart: false, ranges: [{ from: 1, to: 4 }] }
    ]);
    expect(readOf(await service.read({ sessions: [{ sessionId: sessions.stock }] })).detail).toBe('full');
    expect(readOf(await service.read({ sessions: [{ sessionId: sessions.stock }], detail: 'discussion' })).detail).toBe('discussion');
    expect(readOf(await service.read({
      sessions: [{ sessionId: sessions.stock }, { sessionId: sessions.cliche }],
      detail: 'full'
    })).detail).toBe('full');
  });

  it.each([
    ['no session', () => [], /names 1-10 sessions; got 0/],
    ['more than readSessions', () => Array.from({ length: 11 }, (_, n) => ({ sessionId: `s-${n}` })), /names 1-10 sessions; got 11/],
    ['a session twice', (ids: RecallExcerptCorpus['sessions']) => [{ sessionId: ids.stock }, { sessionId: ids.cliche }, { sessionId: ids.stock }], /names session .+ twice/],
    ['an invalid range', (ids: RecallExcerptCorpus['sessions']) => [{ sessionId: ids.stock, turns: [{ from: 4, to: 2 }] }], /Invalid session-recall turn range 4-2/]
  ])('refuses %s before reading anything; the codec refuses it first', async (_case, sessions, message) => {
    const list = jest.spyOn(corpus.store, 'list');

    await expect(recallOver(corpus).read({ sessions: sessions(corpus.sessions) })).rejects.toThrow(message);
    expect(list).not.toHaveBeenCalled();
  });

  it('reports an unknown, live, or unreadable session in its place, and reads the rest', async () => {
    const { sessions } = corpus;
    corpus.fs.files.set(namedFile(corpus, sessions.decoy), new TextEncoder().encode('{"schemaVersion": 2, "broken'));
    await corpus.coordinator.openNamed(sessions.cliche);

    const result = readOf(await recallOver(corpus).read({
      sessions: [sessions.stock, 'nope', sessions.cliche, sessions.decoy, sessions.endings].map((sessionId) => ({ sessionId }))
    }));

    expect(result.sessions).toEqual([
      expect.objectContaining({ outcome: 'read' }),
      { outcome: 'unknown-session', sessionId: 'nope', liveSession: false },
      { outcome: 'unknown-session', sessionId: sessions.cliche, liveSession: true },
      { outcome: 'unreadable', sessionId: sessions.decoy, title: 'Chapter 6.8 bridge' },
      expect.objectContaining({ outcome: 'read' })
    ]);
    expect(result.bounds).toMatchObject({
      unreadableSessions: 1,
      unreadableBytesCharged: WORKSHOP_TRANSCRIPT_RECALL_LIMITS.unreadableSessionBytes,
      notReadByByteBudget: 0
    });
    const rendered = renderWorkshopRecallRead(result, { now: NOW });
    expect(rendered.content).toContain('Session 2 of 5 · No saved session in this workspace has id nope.');
    expect(rendered.content).toContain(`Session 3 of 5 · Session ${sessions.cliche} is the current session.`);
    expect(rendered.content).toContain('Session 4 of 5 · The saved session “Chapter 6.8 bridge”');
    expect(rendered.content).not.toContain(EXCERPT_SENTINELS.decoy);
  });

  it('spends the byte budget in the order asked, a failed read included (PR 126 F-02)', async () => {
    const { sessions } = corpus;
    const request = { sessions: [sessions.stock, sessions.cliche, sessions.endings].map((sessionId) => ({ sessionId })) };
    replaceBudgets({ searchSourceBytes: 1 });
    const service = recallOver(corpus);

    const cold = readOf(await service.read(request));
    expect(outcomes(cold)).toEqual([['read', 'Stock & signature'], ['not-read-by-byte-budget'], ['not-read-by-byte-budget']]);
    expect(cold.bounds).toMatchObject({ notReadByByteBudget: 2, cacheHits: 0 });
    expect(renderWorkshopRecallRead(cold, { now: NOW }).content).toContain(
      'Session 2 of 3 · The saved session “Chapter 6.7 cliché pass”'
    );

    // The cached session is free; the budget buys the next one.
    const warmer = readOf(await service.read(request));
    expect(outcomes(warmer)).toEqual([['read', 'Stock & signature'], ['read', 'Chapter 6.7 cliché pass'], ['not-read-by-byte-budget']]);
    expect(warmer.bounds).toMatchObject({ notReadByByteBudget: 1, cacheHits: 1 });

    // A failed cold read spends the budget too.
    corpus.fs.files.set(namedFile(corpus, sessions.endings), new TextEncoder().encode('{"schemaVersion": 99}'));
    const failed = readOf(await recallOver(corpus).read({ sessions: [{ sessionId: sessions.endings }, { sessionId: sessions.stock }] }));
    expect(outcomes(failed)).toEqual([['unreadable'], ['not-read-by-byte-budget']]);
  });

  it('refuses the whole read when the scope changes between its sessions, and keeps nothing it read (PR 126 F-04)', async () => {
    const { sessions } = corpus;
    const request = { sessions: [sessions.stock, sessions.cliche].map((sessionId) => ({ sessionId })) };
    const scope = jest.spyOn(corpus.coordinator, 'recallScope');
    const readNamed = corpus.store.readNamed.bind(corpus.store);
    const reads = jest.spyOn(corpus.store, 'readNamed').mockImplementation(async (sessionId) => {
      const session = await readNamed(sessionId);
      scope.mockReturnValue({ available: false, reason: 'workspace-changed' });
      return session;
    });
    const service = recallOver(corpus);

    expect(await service.read(request)).toEqual({ available: false, reason: 'workspace-changed' });
    expect(reads).toHaveBeenCalledTimes(1);

    reads.mockRestore();
    scope.mockRestore();
    expect(readOf(await service.read(request)).bounds).toMatchObject({ cacheHits: 0 });
  });

  it('lets cancellation win between sessions', async () => {
    const controller = new AbortController();
    const readNamed = corpus.store.readNamed.bind(corpus.store);
    const reads = jest.spyOn(corpus.store, 'readNamed').mockImplementation(async (sessionId) => {
      controller.abort();
      return readNamed(sessionId);
    });

    await expect(recallOver(corpus).read({
      sessions: [{ sessionId: corpus.sessions.stock }, { sessionId: corpus.sessions.cliche }]
    }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('lets cancellation win over the last read, too', async () => {
    const controller = new AbortController();
    const readNamed = corpus.store.readNamed.bind(corpus.store);
    jest.spyOn(corpus.store, 'readNamed').mockImplementation(async (sessionId) => {
      controller.abort();
      return readNamed(sessionId);
    });

    await expect(recallOver(corpus).read({ sessions: [{ sessionId: corpus.sessions.stock }] }, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reads warm sessions free from the cache, and writes nothing', async () => {
    const before = new Map([...corpus.fs.files].map(([file, bytes]) => [file, Buffer.from(bytes).toString('base64')]));
    const writes = (['writeCurrent', 'saveNamed', 'updateNamed', 'renameNamed', 'duplicateNamed', 'deleteNamed'] as const)
      .map((method) => jest.spyOn(corpus.store, method));
    const service = recallOver(corpus);
    const request = { sessions: Object.values(corpus.sessions).map((sessionId) => ({ sessionId })) };

    await service.read(request);
    const warm = readOf(await service.read(request));

    expect(warm.bounds).toMatchObject({ cacheHits: 4, parsedBytes: 0 });
    expect(warm.sessions.every((session) => session.outcome === 'read' && session.cacheHit)).toBe(true);
    const after = new Map([...corpus.fs.files].map(([file, bytes]) => [file, Buffer.from(bytes).toString('base64')]));
    expect(after).toEqual(before);
    for (const write of writes) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it('logs counts, never a title or transcript text', async () => {
    await recallOver(corpus).read({ sessions: [{ sessionId: corpus.sessions.stock }, { sessionId: 'nope' }] });

    const lines = corpus.log.appendLine.mock.calls.map(([line]) => String(line))
      .filter((line) => line.startsWith('[WorkshopTranscriptRecall] read')).join('\n');
    expect(lines).toMatch(/read sessions=2 read=1 unknown=1 unreadable=0 notRead=0 detail=discussion /);
    expect(lines).not.toMatch(/Stock &|DISCUSSION-|Chapter 6/);
  });
});

describe('summarize the chats on chapter 6.7, and what is left (the use case, end to end)', () => {
  let corpus: RecallExcerptCorpus;
  let service: WorkshopTranscriptRecallService;
  let ids: string[];
  let read: Read;
  let content: string;

  beforeAll(async () => {
    corpus = await saveExcerptCorpus();
    service = recallOver(corpus);
    // 1. Every chat on 6.7, by title or excerpt label.
    ids = cataloged(await service.catalog({ match: 'chapter 6.7' })).sessions.map((session) => session.sessionId);
    // 2. All of them in one read, discussion first.
    read = readOf(await service.read({ sessions: ids.map((sessionId) => ({ sessionId })) }));
    content = renderWorkshopRecallRead(read, { now: NOW }).content;
  });

  it('finds every 6.7 chat and not the 6.8 decoy', () => {
    const { sessions } = corpus;
    expect(ids).toEqual([sessions.endings, sessions.cliche, sessions.stock]);
    expect(read.detail).toBe('discussion');
    expect(content).not.toContain(EXCERPT_SENTINELS.decoy);
  });

  it('reads them all within one read’s budget, every chat complete', () => {
    const rendered = renderWorkshopRecallRead(read, { now: NOW });

    expect(content.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters);
    expect(rendered.sessions.map((session) => [session.outcome, session.continuation])).toEqual([
      ['read', []], ['read', []], ['read', []]
    ]);
  });

  it('shows every chat’s discussion whole, and no tool report’s body', () => {
    for (const said of [...corpus.discussion.stock, ...corpus.discussion.cliche, ...corpus.discussion.endings]) {
      expect(content).toContain(said);
    }
    expect(content).not.toContain(EXCERPT_SENTINELS.toolReportBody);
    expect(content).not.toContain('The beat lands on a stock gesture');
  });

  it('names each report’s turn and word count in its one line', () => {
    const rendered = renderWorkshopRecallRead(read, { now: NOW });
    for (const report of [...corpus.reports.stock, ...corpus.reports.cliche]) {
      const words = countWords(report.body).toLocaleString('en-US');
      expect(content).toMatch(new RegExp(
        `\\[turn (\\d+) · \\d+:\\d\\d [AP]M · ${report.toolLabel.replace('&', '\\&')} report · ${words} words · ` +
        'read it in full with <turns>\\1</turns>\\]'
      ));
    }
    expect(rendered.sessions.map((session) => session.collapsed.length)).toEqual([0, EXCERPT_REPORT_PASSES, EXCERPT_REPORT_PASSES]);
  });

  it('would not fit in full detail: the same chats overflow the budget and continue', async () => {
    const full = renderWorkshopRecallRead(
      await service.read({ sessions: ids.map((sessionId) => ({ sessionId })), detail: 'full' }),
      { now: NOW }
    );

    expect(full.content.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters);
    expect(full.content).toContain(EXCERPT_SENTINELS.toolReportBody);
    expect(full.sessions.some((session) => session.continuation.length > 0)).toBe(true);
  });

  it('then lists what is left on 6.7, and nothing from the decoy', async () => {
    // 3. What is still open (Slice 2B), under the same <match> rule.
    const todos = await service.todos({ match: 'chapter 6.7' });
    const text = renderWorkshopRecallTodos(todos, { now: NOW }).content;

    for (const todo of [corpus.todos.stock, corpus.todos.cliche, corpus.todos.endings]) {
      expect(text).toContain(todo.text);
    }
    expect(text).not.toContain(corpus.todos.decoy.text);
  });
});
