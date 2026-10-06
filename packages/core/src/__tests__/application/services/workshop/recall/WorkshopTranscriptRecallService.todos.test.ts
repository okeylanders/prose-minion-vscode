/**
 * `transcript.todos` in the session-recall service (ADR 2026-10-05 D5–D8),
 * over REAL to-dos saved through the real aggregate, coordinator, and store:
 * every filter alone and combined, the live room's exclusion, staleness and
 * turn positions (including after a real rewind), and each bound.
 */

import {
  WORKSHOP_TRANSCRIPT_RECALL_LIMITS,
  WorkshopTranscriptRecallService
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type {
  WorkshopRecallTodosRequest,
  WorkshopRecallTodosResult
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { extractWorkshopActionableFindings } from '@/application/services/workshop/WorkshopActionableFindings';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { RECALL_ROOT } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  RecallTodoCorpus,
  saveBusyRoom,
  saveTodoCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import {
  scriptedCheckpoint,
  setupCoordinator
} from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

type Listed = Extract<WorkshopRecallTodosResult, { outcome: 'todos' }>;

const recallOver = (corpus: Pick<RecallTodoCorpus, 'store' | 'coordinator' | 'log'>) =>
  new WorkshopTranscriptRecallService(corpus.store, corpus.coordinator, corpus.log);

const listed = (result: WorkshopRecallTodosResult): Listed => {
  if (!result.available || result.outcome !== 'todos') {
    throw new Error(`Expected a to-do list, got ${JSON.stringify(result)}`);
  }
  return result;
};

/** Session titles, each with the ids of the to-dos shown for it. */
const shown = (result: WorkshopRecallTodosResult): Array<[string, string[]]> =>
  listed(result).sessions.map((session) => [session.header.title, session.todos.map((todo) => todo.id)]);

const replaceBudgets = (overrides: Partial<typeof PROMPT_BUDGETS.workshopTranscriptRecall>) =>
  jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', {
    ...PROMPT_BUDGETS.workshopTranscriptRecall,
    ...overrides
  });

afterEach(() => {
  jest.restoreAllMocks();
});

describe('WorkshopTranscriptRecallService.todos filters', () => {
  let corpus: RecallTodoCorpus;
  let todos: (request?: WorkshopRecallTodosRequest) => Promise<WorkshopRecallTodosResult>;

  beforeAll(async () => {
    corpus = await saveTodoCorpus();
    todos = (request = {}) => recallOver(corpus).todos(request);
  });

  it('lists open to-dos, stale ones marked, newest session first, by default', async () => {
    const { todos: made } = corpus;
    const result = listed(await todos());

    expect(shown(result)).toEqual([
      ['Endings chat', [made.endings.id]],
      ['Cliché pass', [made.cliche.id]],
      ['Chapter 6-7 stock signature', [made.laughter.id, made.shapped.id, made.cadence.id]]
    ]);
    expect(result.status).toBe('open');
    expect(result.sessions[2].todos.map((todo) => todo.stale)).toEqual([true, true, false]);
    expect(result.sessions[2].header).toMatchObject({ excerptVersion: 2, openTodos: 3, completedTodos: 1 });
    expect(result.bounds).toEqual({
      corpusSessions: 3,
      sessionLimit: 50,
      sessionsScanned: 3,
      notScannedBySessionLimit: 0,
      notScannedByByteBudget: 0,
      omittedByItemLimit: 0,
      notShownByStatus: { open: 0, completed: 1, dismissed: 1 },
      notShownBySource: 0,
      sessionsWithoutMatchingTodos: 0,
      unreadableSessions: 0,
      listingTruncated: false,
      parsedBytes: expect.any(Number),
      unreadableBytesCharged: 0,
      cacheHits: 0
    });
  });

  it.each([
    ['completed', ['very'], { open: 5, completed: 0, dismissed: 1 }],
    ['dismissed', ['semicolon'], { open: 5, completed: 1, dismissed: 0 }],
    ['all', ['endings', 'cliche', 'laughter', 'shapped', 'very', 'cadence', 'semicolon'], { open: 0, completed: 0, dismissed: 0 }]
  ] as const)('filters by status %s, and counts what it left out', async (status, names, notShown) => {
    const result = listed(await todos({ status }));

    expect(result.sessions.flatMap((session) => session.todos.map((todo) => todo.id)))
      .toEqual(names.map((name) => corpus.todos[name].id));
    expect(result.bounds.notShownByStatus).toEqual(notShown);
  });

  it('reads only the newest <recent> sessions, and says how many it left', async () => {
    const result = listed(await todos({ recent: 2 }));

    expect(shown(result).map(([title]) => title)).toEqual(['Endings chat', 'Cliché pass']);
    expect(result).toMatchObject({ recent: 2, bounds: { sessionLimit: 2, sessionsScanned: 2, notScannedBySessionLimit: 1 } });
  });

  it('reads one named <session>, and refuses an id outside the corpus', async () => {
    const first = corpus.sessionIds[0];

    expect(shown(await todos({ sessionId: first })).map(([title]) => title)).toEqual(['Chapter 6-7 stock signature']);
    expect(await todos({ sessionId: '../current' })).toEqual({
      available: true,
      outcome: 'unknown-session',
      sessionId: '../current',
      liveSession: false
    });
  });

  it('narrows sessions by <match> on title and excerpt label, and reports how they matched', async () => {
    const chapter = listed(await todos({ match: 'chapter 6-7' }));
    expect(shown(chapter).map(([title]) => title)).toEqual(['Cliché pass', 'Chapter 6-7 stock signature']);
    expect(chapter.match).toEqual({
      text: 'chapter 6-7',
      query: { terms: ['chapter', '6', '7'], overflowTerms: [], phrase: ['chapter', '6', '7'] },
      mode: 'all-terms'
    });
    expect(chapter.bounds.corpusSessions).toBe(2);

    expect(shown(await todos({ match: 'cliche' })).map(([title]) => title)).toEqual(['Cliché pass']);
    const none = listed(await todos({ match: 'lighthouse' }));
    expect(none).toMatchObject({ sessions: [], bounds: { corpusSessions: 0, sessionsScanned: 0 } });
    expect(none.match).not.toHaveProperty('mode');
  });

  it('filters by <source>, a tool id or a persona id', async () => {
    const { todos: made } = corpus;

    const tool = listed(await todos({ source: 'stock-and-signature' }));
    expect(shown(tool)).toEqual([['Chapter 6-7 stock signature', [made.laughter.id, made.shapped.id]]]);
    expect(tool.bounds).toMatchObject({ notShownBySource: 5, notShownByStatus: { open: 0, completed: 0, dismissed: 0 } });

    expect(shown(await todos({ source: 'jill', status: 'all' }))).toEqual([
      ['Endings chat', [made.endings.id]],
      ['Chapter 6-7 stock signature', [made.very.id, made.cadence.id, made.semicolon.id]]
    ]);
    expect(shown(await todos({ source: 'cliche' }))).toEqual([['Cliché pass', [made.cliche.id]]]);
  });

  it('keeps to sessions a <persona> took part in', async () => {
    expect(shown(await todos({ personaId: 'margot' })).map(([title]) => title)).toEqual(['Cliché pass']);
    expect(listed(await todos({ personaId: 'jill' })).bounds.corpusSessions).toBe(3);
    expect(listed(await todos({ personaId: 'cliff' }))).toMatchObject({ sessions: [], bounds: { corpusSessions: 0 } });
  });

  it('combines every filter', async () => {
    const { todos: made } = corpus;

    expect(shown(await todos({ status: 'all', match: 'chapter', source: 'jill', personaId: 'jill', recent: 2 })))
      .toEqual([['Chapter 6-7 stock signature', [made.very.id, made.cadence.id, made.semicolon.id]]]);
    expect(shown(await todos({ status: 'open', match: 'chapter 6-7', source: 'stock-and-signature', recent: 1 })))
      .toEqual([]);
    expect(shown(await todos({ status: 'completed', sessionId: corpus.sessionIds[0], source: 'jill' })))
      .toEqual([['Chapter 6-7 stock signature', [made.very.id]]]);
  });

  it('logs counts, never a to-do or the match text', async () => {
    const service = recallOver(corpus);

    await service.todos({ match: 'chapter', status: 'all' });

    const lines = corpus.log.appendLine.mock.calls.map(([line]) => String(line))
      .filter((line) => line.startsWith('[WorkshopTranscriptRecall]')).join('\n');
    expect(lines).toMatch(/\[WorkshopTranscriptRecall\] todos status=all sessions=2\/2 notScanned=0\+0 /);
    expect(lines).not.toMatch(/chapter|laughter|cadence|Cliché pass/i);
  });
});

describe('the live room and positions', () => {
  it('never lists the live room, and names it when asked for', async () => {
    const corpus = await saveTodoCorpus();
    const [first] = corpus.sessionIds;
    await corpus.coordinator.openNamed(first);
    const service = recallOver(corpus);

    expect(shown(await service.todos({ status: 'all' })).map(([title]) => title))
      .toEqual(['Endings chat', 'Cliché pass']);
    expect(await service.todos({ sessionId: first })).toMatchObject({ outcome: 'unknown-session', liveSession: true });
  });

  it('resolves turn positions after a real rewind cut and the room went on', async () => {
    const nextSteps = (step: string) => `Here is my read.\n\n### Next steps\n- ${step}`;
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('What should I fix?', { reply: nextSteps('Tighten the opening.') });
    const kept = room.session.addTodoFromFinding(first.id, first.actionableFindings![0].key);
    const second = room.hostMessage('What next?', { reply: nextSteps('Cut the adverb.') });
    const cut = room.session.addTodoFromFinding(second.id, second.actionableFindings![0].key);
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('scripted', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('scripted');

    const rewound = await harness.coordinator.rewindTo({ kind: 'afterTurn', turnId: first.id }, { origin: 'writer' });
    const reply = nextSteps('Trim the ending.');
    harness.session.beginPersonaMessage('after-rewind', 'And now?');
    const third = harness.session.completeRun('after-rewind', reply, undefined, false,
      harness.session.getHostConversationId(), extractWorkshopActionableFindings(reply))!;
    const added = harness.session.addTodoFromFinding(third.id, 'finding-1');
    await harness.coordinator.saveNamed('Scripted room', 'scripted');
    await harness.coordinator.resetSession({ clearWorkingSet: true });
    await harness.coordinator.flush();

    const result = listed(await new WorkshopTranscriptRecallService(harness.store, harness.coordinator, harness.log)
      .todos({ sessionId: 'scripted' }));

    const turns = (await harness.store.readNamed('scripted'))!.workshop.turns;
    const positionOf = (turnId: string) => turns.findIndex((turn) => turn.id === turnId) + 1;
    expect(rewound.summary.removedTodoCount).toBe(1);
    expect(result.sessions[0].todos.map(({ id, turnId, position }) => ({ id, turnId, position }))).toEqual([
      { id: kept.id, turnId: first.id, position: positionOf(first.id) },
      { id: added.id, turnId: third.id, position: positionOf(third.id) }
    ]);
    // The new reply follows the cut directly: its writer turn, then itself.
    expect(positionOf(third.id)).toBe(positionOf(first.id) + 2);
    expect(JSON.stringify(result)).not.toContain(cut.id);
  });
});

describe('to-do bounds and failures', () => {
  let corpus: RecallTodoCorpus;

  beforeEach(async () => {
    corpus = await saveTodoCorpus();
  });

  const namedFile = (sessionId: string): string => {
    const directory = `${RECALL_ROOT}/prose-minion/sessions`;
    return [...corpus.fs.files.keys()].find((file) =>
      file.startsWith(directory) && file.endsWith('.json') && !file.endsWith('.summary.json') &&
      !file.endsWith('/current.json') && new TextDecoder().decode(corpus.fs.files.get(file)!).includes(`"sessionId": "${sessionId}"`))!;
  };

  it('scans at most todoSessions, and refuses a <recent> beyond it', async () => {
    replaceBudgets({ todoSessions: 2 });
    const service = recallOver(corpus);

    expect(listed(await service.todos({})).bounds).toMatchObject({ sessionLimit: 2, sessionsScanned: 2, notScannedBySessionLimit: 1 });
    await expect(service.todos({ recent: 3 })).rejects.toThrow('Invalid session-recall recent count 3');
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses a <recent> of %s', async (recent) => {
    await expect(recallOver(corpus).todos({ recent })).rejects.toThrow(/Invalid session-recall recent count/);
  });

  it('refuses <recent> together with <session>', async () => {
    const request = { recent: 1, sessionId: corpus.sessionIds[0] } as unknown as WorkshopRecallTodosRequest;
    await expect(recallOver(corpus).todos(request)).rejects.toThrow(/without a session/);
  });

  it('keeps at most todoItems, newest session first, and counts the rest', async () => {
    replaceBudgets({ todoItems: 2 });

    const result = listed(await recallOver(corpus).todos({}));

    expect(shown(result).map(([title, ids]) => [title, ids.length])).toEqual([['Endings chat', 1], ['Cliché pass', 1]]);
    expect(result.bounds.omittedByItemLimit).toBe(3);
  });

  it('counts a session without a matching to-do before the item cap, so one the cap emptied is not one (PR 127 F-02)', async () => {
    // Defaults throughout: sixty newer to-dos reach todoItems through ordinary use.
    const busy = await saveBusyRoom(corpus, 20);

    const open = listed(await recallOver(busy).todos({}));
    expect(shown(open).map(([title, ids]) => [title, ids.length])).toEqual([['Busy room', 60]]);
    expect(open.bounds).toMatchObject({ sessionsScanned: 4, omittedByItemLimit: 5, sessionsWithoutMatchingTodos: 0 });

    const completed = listed(await recallOver(busy).todos({ status: 'completed' }));
    expect(shown(completed).map(([title]) => title)).toEqual(['Chapter 6-7 stock signature']);
    expect(completed.bounds).toMatchObject({ sessionsScanned: 4, omittedByItemLimit: 0, sessionsWithoutMatchingTodos: 3 });
  });

  it('stops cold reads at the byte budget, newest first, and reads cached sessions free', async () => {
    replaceBudgets({ searchSourceBytes: 1 });
    const service = recallOver(corpus);

    const cold = listed(await service.todos({}));
    expect(shown(cold).map(([title]) => title)).toEqual(['Endings chat']);
    expect(cold.bounds).toMatchObject({ sessionsScanned: 1, notScannedByByteBudget: 2, cacheHits: 0 });

    const warmer = listed(await service.todos({}));
    expect(warmer.bounds).toMatchObject({ sessionsScanned: 2, notScannedByByteBudget: 1, cacheHits: 1 });
  });

  it('counts an unreadable file, charges it the most it can cost, and lists the rest', async () => {
    corpus.fs.files.set(namedFile(corpus.sessionIds[1]), new TextEncoder().encode('{"schemaVersion": 2, "broken'));

    const result = listed(await recallOver(corpus).todos({}));

    expect(shown(result).map(([title]) => title)).toEqual(['Endings chat', 'Chapter 6-7 stock signature']);
    expect(result.bounds).toMatchObject({
      sessionsScanned: 2,
      unreadableSessions: 1,
      unreadableBytesCharged: WORKSHOP_TRANSCRIPT_RECALL_LIMITS.unreadableSessionBytes
    });
  });

  it('spends the byte budget on a failed read too (PR 126 F-02)', async () => {
    corpus.fs.files.set(namedFile(corpus.sessionIds[2]), new TextEncoder().encode('{"schemaVersion": 99}'));
    replaceBudgets({ searchSourceBytes: 1 });

    const result = listed(await recallOver(corpus).todos({}));

    expect(result).toMatchObject({
      sessions: [],
      bounds: { sessionsScanned: 0, unreadableSessions: 1, notScannedByByteBudget: 2, parsedBytes: 0 }
    });
  });

  it('refuses the whole call when the scope changes mid-call, and keeps nothing it read (PR 126 F-04)', async () => {
    const service = recallOver(corpus);
    const scope = jest.spyOn(corpus.coordinator, 'recallScope');
    const readNamed = corpus.store.readNamed.bind(corpus.store);
    const reads = jest.spyOn(corpus.store, 'readNamed').mockImplementation(async (sessionId) => {
      const session = await readNamed(sessionId);
      scope.mockReturnValue({ available: false, reason: 'workspace-changed' });
      return session;
    });

    expect(await service.todos({})).toEqual({ available: false, reason: 'workspace-changed' });
    expect(reads).toHaveBeenCalledTimes(1);

    reads.mockRestore();
    scope.mockRestore();
    expect(listed(await service.todos({})).bounds).toMatchObject({ sessionsScanned: 3, cacheHits: 0 });
  });

  it('lets cancellation win, between files and over a failing read', async () => {
    const between = new AbortController();
    const readNamed = corpus.store.readNamed.bind(corpus.store);
    jest.spyOn(corpus.store, 'readNamed').mockImplementation(async (sessionId) => {
      between.abort();
      return readNamed(sessionId);
    });
    await expect(recallOver(corpus).todos({}, between.signal)).rejects.toMatchObject({ name: 'AbortError' });

    jest.restoreAllMocks();
    const failing = new AbortController();
    jest.spyOn(corpus.store, 'readNamed').mockImplementation(async () => {
      failing.abort();
      throw new Error('EIO: read interrupted');
    });
    await expect(recallOver(corpus).todos({ sessionId: corpus.sessionIds[0] }, failing.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('writes nothing: no file changes, and no store write is called', async () => {
    const before = new Map([...corpus.fs.files].map(([file, bytes]) => [file, Buffer.from(bytes).toString('base64')]));
    const writes = (['writeCurrent', 'saveNamed', 'updateNamed', 'renameNamed', 'duplicateNamed', 'deleteNamed'] as const)
      .map((method) => jest.spyOn(corpus.store, method));
    const service = recallOver(corpus);

    await service.todos({ status: 'all' });
    await service.todos({ match: 'chapter', source: 'jill' });

    const after = new Map([...corpus.fs.files].map(([file, bytes]) => [file, Buffer.from(bytes).toString('base64')]));
    expect(after).toEqual(before);
    for (const write of writes) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it('discloses a truncated listing', async () => {
    const list = corpus.store.list.bind(corpus.store);
    jest.spyOn(corpus.store, 'list').mockImplementation(async (query, signal) => ({ ...(await list(query, signal)), truncated: true }));

    expect(listed(await recallOver(corpus).todos({})).bounds.listingTruncated).toBe(true);
  });
});
