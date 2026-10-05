/**
 * The session-recall service (ADR 2026-10-05 §2, §5): corpus rules, bounds
 * and their disclosure, the document cache, cancellation, and the read-only
 * contract, against a fake store that throws on every write and against the
 * real store and coordinator.
 */

import {
  WORKSHOP_TRANSCRIPT_RECALL_LIMITS,
  WorkshopRecallCorpusPort,
  WorkshopRecallScope,
  WorkshopRecallSessionSummary,
  WorkshopTranscriptRecallService
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import {
  WORKSHOP_SESSION_STORE_LIMITS,
  WorkshopSessionStore
} from '@/infrastructure/storage/WorkshopSessionStore';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { fixtureTurn, writerTurn } from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import {
  RECALL_ROOT,
  RECALL_WORKSPACE,
  recallLog,
  recallSession,
  saveRecallRoom,
  saveSentinelCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import type { WorkshopTurn } from '@messages';

const WRITE_METHODS = [
  'readCurrent',
  'readCurrentWithRecovery',
  'writeCurrent',
  'saveNamed',
  'updateNamed',
  'renameNamed',
  'duplicateNamed',
  'deleteNamed',
  'resolveRevealPath'
] as const;

/**
 * The corpus port over in-memory sessions. Every write method, and every
 * read of current.json, throws: recall must never reach them.
 */
class FakeSessionStore implements WorkshopRecallCorpusPort {
  readonly sessions: WorkshopPersistedSessionV2[] = [];
  readonly failures = new Map<string, Error>();
  readonly missing = new Set<string>();
  truncated = false;
  available = true;
  onRead?: (sessionId: string) => void;
  readonly list = jest.fn(async (_query: undefined, _signal?: AbortSignal) => ({
    sessions: this.sessions.map(summaryOf),
    truncated: this.truncated
  }));
  readonly readNamed = jest.fn(async (sessionId: string) => {
    this.onRead?.(sessionId);
    const failure = this.failures.get(sessionId);
    if (failure) {
      throw failure;
    }
    return this.missing.has(sessionId)
      ? undefined
      : cloneSession(this.sessions.find((session) => session.sessionId === sessionId));
  });

  constructor() {
    for (const method of WRITE_METHODS) {
      Object.defineProperty(this, method, {
        value: () => {
          throw new Error(`session recall called the store's ${method}`);
        }
      });
    }
  }

  availability(): { available: true } | { available: false; reason: 'multi-root' } {
    return this.available ? { available: true } : { available: false, reason: 'multi-root' };
  }
}

const summaryOf = (session: WorkshopPersistedSessionV2): WorkshopRecallSessionSummary & {
  preview?: string;
  excerptIdentity?: string;
} => ({
  sessionId: session.sessionId,
  title: session.title,
  updatedAt: session.updatedAt,
  ...(session.savedAt ? { savedAt: session.savedAt } : {}),
  timezone: session.temporal.timezone,
  hostPersonaId: session.summary.hostPersonaId,
  participantPersonaIds: [...session.summary.participantPersonaIds],
  turnCount: session.summary.turnCount,
  ...(session.summary.scope !== undefined ? { scope: session.summary.scope } : {}),
  ...(session.summary.excerptLabel ? { excerptLabel: session.summary.excerptLabel } : {}),
  // What the real store's summaries also carry; recall must ignore both.
  preview: session.summary.preview,
  excerptIdentity: session.summary.excerptIdentity
});

const say = (id: string, content: string): WorkshopTurn => writerTurn(id, { content });

const cloneSession = (
  session: WorkshopPersistedSessionV2 | undefined
): WorkshopPersistedSessionV2 | undefined =>
  session ? JSON.parse(JSON.stringify(session)) as WorkshopPersistedSessionV2 : undefined;

/** Session `n` is newer than session `n - 1`. */
const numbered = (n: number, turns: WorkshopTurn[] = [say(`s${n}-t1`, `Lantern note ${n}.`)]) =>
  recallSession({
    sessionId: `s${n}`,
    title: `Session ${n}`,
    updatedAt: new Date(Date.parse('2026-09-01T12:00:00.000Z') + n * 3_600_000).toISOString(),
    turns
  });

describe('WorkshopTranscriptRecallService', () => {
  let store: FakeSessionStore;
  let scope: WorkshopRecallScope;
  let log: ReturnType<typeof recallLog>;
  let service: WorkshopTranscriptRecallService;

  const create = (limits?: { maximumCachedDocuments: number; maximumCachedCharacters: number }) =>
    new WorkshopTranscriptRecallService(store, { recallScope: () => scope }, log, {
      now: () => 0,
      ...(limits ? { limits } : {})
    });

  beforeEach(() => {
    store = new FakeSessionStore();
    scope = { available: true, liveSessionId: 'live' };
    log = recallLog();
    service = create();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const replaceBudgets = (overrides: Partial<typeof PROMPT_BUDGETS.workshopTranscriptRecall>) =>
    jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', {
      ...PROMPT_BUDGETS.workshopTranscriptRecall,
      ...overrides
    });

  describe('corpus', () => {
    it('never lists, searches, or reads the live room', async () => {
      store.sessions.push(numbered(1), numbered(2, [say('live-t1', 'Lantern in the live room.')]), numbered(3));
      store.sessions[1].sessionId = 'live';

      const catalog = await service.catalog({});
      const search = await service.search({ query: 'lantern' });
      const read = await service.read({ sessionId: 'live' });

      expect(catalog.available && catalog.outcome === 'catalog' && catalog.sessions.map((s) => s.sessionId))
        .toEqual(['s3', 's1']);
      expect(JSON.stringify(search)).not.toContain('live room');
      expect(read).toEqual({ available: true, outcome: 'unknown-session', sessionId: 'live', liveSession: true });
      expect(store.readNamed.mock.calls.map(([id]) => id)).not.toContain('live');
    });

    it('lists without a query, and the catalog reads no session file', async () => {
      store.sessions.push(numbered(1), numbered(2));
      const controller = new AbortController();

      await service.catalog({}, controller.signal);

      expect(store.list).toHaveBeenCalledWith(undefined, controller.signal);
      expect(store.readNamed).not.toHaveBeenCalled();
    });

    it.each([
      ['workspace-changed'],
      ['not-ready'],
      ['no-workspace']
    ] as const)('reads nothing when the scope is unavailable (%s)', async (reason) => {
      store.sessions.push(numbered(1));
      scope = { available: false, reason };

      for (const result of [
        await service.catalog({}),
        await service.search({ query: 'lantern' }),
        await service.read({ sessionId: 's1' })
      ]) {
        expect(result).toEqual({ available: false, reason });
      }
      expect(store.list).not.toHaveBeenCalled();
      expect(store.readNamed).not.toHaveBeenCalled();
    });

    it('reads nothing when the store itself is unavailable', async () => {
      store.available = false;

      expect(await service.search({ query: 'lantern' })).toEqual({ available: false, reason: 'multi-root' });
      expect(store.list).not.toHaveBeenCalled();
    });

    it('orders sessions newest first itself, and keeps one session per id', async () => {
      store.sessions.push(numbered(2), numbered(5), numbered(1), { ...numbered(4), sessionId: 's5' });

      const catalog = await service.catalog({});

      expect(catalog.available && catalog.outcome === 'catalog' && catalog.sessions.map((s) => s.title))
        .toEqual(['Session 5', 'Session 2', 'Session 1']);
    });

    it('filters by participant, and caps the catalog while counting every match', async () => {
      replaceBudgets({ catalogSessions: 2 });
      for (const n of [1, 2, 3, 4]) {
        store.sessions.push({
          ...numbered(n),
          summary: { ...numbered(n).summary, participantPersonaIds: n === 2 ? ['jill'] : ['jill', 'cliff'] }
        });
      }

      const catalog = await service.catalog({ personaId: 'cliff' });

      expect(catalog).toMatchObject({
        outcome: 'catalog',
        personaId: 'cliff',
        matchingSessions: 3,
        listingTruncated: false
      });
      expect(catalog.available && catalog.outcome === 'catalog' && catalog.sessions.map((s) => s.sessionId))
        .toEqual(['s4', 's3']);
    });

    it('never carries the summary preview or excerpt identity into a catalog', async () => {
      const session = numbered(1);
      session.summary.preview = 'HIDDEN-PREVIEW';
      session.summary.excerptIdentity = 'HIDDEN-IDENTITY';
      store.sessions.push(session);
      store.truncated = true;

      const catalog = await service.catalog({});

      expect(JSON.stringify(catalog)).not.toMatch(/HIDDEN-(PREVIEW|IDENTITY)/);
      expect(catalog).toMatchObject({ listingTruncated: true });
    });
  });

  describe('search bounds', () => {
    it('counts an unreadable or vanished file and searches the rest', async () => {
      store.sessions.push(numbered(1), numbered(2), numbered(3));
      store.failures.set('s2', new Error('Unexpected token } in JSON'));
      store.missing.add('s1');

      const result = await service.search({ query: 'lantern' });

      expect(result).toMatchObject({
        outcome: 'searched',
        bounds: { corpusSessions: 3, sessionsSearched: 1, unreadableSessions: 2 }
      });
      expect(log.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Skipped unreadable session s2: Unexpected token')
      );
    });

    it('stops cold parsing at the byte budget, newest first, and says how many it skipped', async () => {
      for (const n of [1, 2, 3, 4]) {
        store.sessions.push(numbered(n));
      }
      // Any one session spends the whole budget.
      replaceBudgets({ searchSourceBytes: 1 });

      const result = await service.search({ query: 'lantern' });

      expect(result).toMatchObject({
        outcome: 'searched',
        bounds: { sessionsSearched: 1, notSearchedByByteBudget: 3, cacheHits: 0 }
      });
      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s4']);

      // The cached session is free; the budget buys the next one.
      const again = await service.search({ query: 'lantern' });
      expect(again).toMatchObject({
        bounds: { sessionsSearched: 2, notSearchedByByteBudget: 2, cacheHits: 1 }
      });
      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s4', 's3']);
    });

    it('stops at the session limit and discloses the rest', async () => {
      for (const n of [1, 2, 3]) {
        store.sessions.push(numbered(n));
      }
      replaceBudgets({ searchSessions: 2 });

      const result = await service.search({ query: 'lantern' });

      expect(result).toMatchObject({
        bounds: { corpusSessions: 3, sessionsSearched: 2, notSearchedBySessionLimit: 1 }
      });
      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s3', 's2']);
    });

    it('charges a failed cold read the most it can cost, so failures spend the budget too (PR 126 F-02)', async () => {
      const failureCharge = WORKSHOP_TRANSCRIPT_RECALL_LIMITS.unreadableSessionBytes;
      for (const n of [1, 2, 3, 4, 5]) {
        store.sessions.push(numbered(n));
      }
      await service.read({ sessionId: 's5' });
      store.readNamed.mockClear();
      store.failures.set('s4', new Error('Unsupported Workshop session schema: 99'));
      store.failures.set('s2', new Error('Unsupported Workshop session schema: 99'));
      // Room for one failure and a healthy file, but not for two failures.
      replaceBudgets({ searchSourceBytes: failureCharge + 1_000_000 });

      const result = await service.search({ query: 'lantern' });

      expect(result).toMatchObject({
        outcome: 'searched',
        bounds: {
          cacheHits: 1,
          sessionsSearched: 2,
          unreadableSessions: 2,
          unreadableBytesCharged: 2 * failureCharge,
          notSearchedByByteBudget: 1
        }
      });
      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s4', 's3', 's2']);
    });

    it('charges failures the store\u2019s exact-read ceiling, the most a failed read can cost', () => {
      expect(WORKSHOP_TRANSCRIPT_RECALL_LIMITS.unreadableSessionBytes)
        .toBe(WORKSHOP_SESSION_STORE_LIMITS.maximumExactFileBytes);
    });

    it('checks for cancellation between files', async () => {
      for (const n of [1, 2, 3]) {
        store.sessions.push(numbered(n));
      }
      const controller = new AbortController();
      store.onRead = () => controller.abort();

      await expect(service.search({ query: 'lantern' }, controller.signal))
        .rejects.toMatchObject({ name: 'AbortError' });
      expect(store.readNamed).toHaveBeenCalledTimes(1);
    });

    it('searches one named session, and refuses an id outside the corpus', async () => {
      store.sessions.push(numbered(1), numbered(2));

      const one = await service.search({ query: 'lantern', sessionId: 's1' });
      expect(one).toMatchObject({ outcome: 'searched', sessionId: 's1', bounds: { sessionsSearched: 1 } });
      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s1']);

      expect(await service.search({ query: 'lantern', sessionId: '../current' })).toEqual({
        available: true,
        outcome: 'unknown-session',
        sessionId: '../current',
        liveSession: false
      });
    });

    it('logs counts, never the query or session text', async () => {
      store.sessions.push(numbered(1));

      await service.search({ query: 'lantern secret' });

      const lines = log.appendLine.mock.calls.map(([line]) => line).join('\n');
      expect(lines).toMatch(/\[WorkshopTranscriptRecall\] search terms=2 mode=any-term sessions=1\/1/);
      expect(lines).not.toMatch(/lantern|secret|Session 1/);
    });
  });

  describe('document cache', () => {
    it('reuses a document while the listing’s updatedAt matches, and rereads when it changes', async () => {
      store.sessions.push(numbered(1), numbered(2));

      await service.search({ query: 'lantern' });
      const warm = await service.search({ query: 'lantern' });
      expect(warm).toMatchObject({ bounds: { cacheHits: 2, parsedBytes: 0 } });
      expect(store.readNamed).toHaveBeenCalledTimes(2);

      store.sessions[0] = { ...numbered(1, [say('s1-t1', 'Lantern, revised.')]), updatedAt: '2026-10-04T00:00:00.000Z' };
      const changed = await service.search({ query: 'revised' });
      expect(changed).toMatchObject({ bounds: { cacheHits: 1 } });
      expect(store.readNamed).toHaveBeenCalledTimes(3);
      expect(changed.available && changed.outcome === 'searched' && changed.search.matchedHits).toBe(1);

      const read = await service.read({ sessionId: 's2' });
      expect(read).toMatchObject({ outcome: 'read', cacheHit: true });
      expect(store.readNamed).toHaveBeenCalledTimes(3);
    });

    it('evicts the least recently used document past its count bound', async () => {
      service = create({ maximumCachedDocuments: 2, maximumCachedCharacters: 1_000_000 });
      store.sessions.push(numbered(1), numbered(2), numbered(3));

      await service.read({ sessionId: 's1' });
      await service.read({ sessionId: 's2' });
      await service.read({ sessionId: 's1' });
      await service.read({ sessionId: 's3' });
      store.readNamed.mockClear();
      await service.read({ sessionId: 's1' });
      await service.read({ sessionId: 's2' });

      expect(store.readNamed.mock.calls.map(([id]) => id)).toEqual(['s2']);
    });

    it('does not cache a document larger than its character bound', async () => {
      service = create({ maximumCachedDocuments: 10, maximumCachedCharacters: 10 });
      store.sessions.push(numbered(1));

      await service.read({ sessionId: 's1' });
      await service.read({ sessionId: 's1' });

      expect(store.readNamed).toHaveBeenCalledTimes(2);
    });
  });

  describe('read', () => {
    const turns = [
      say('t-1', 'One.'),
      fixtureTurn('t-2', { content: 'Two.' }),
      say('t-3', 'Three.'),
      fixtureTurn('t-4', { content: 'Four.' }),
      say('t-5', 'Five.')
    ];

    it('resolves sorted, merged ranges with the first and last turn id of each', async () => {
      store.sessions.push(numbered(1, turns));

      const read = await service.read({
        sessionId: 's1',
        turns: [{ from: 5, to: 9 }, { from: 1, to: 2 }, { from: 2, to: 3 }]
      });

      expect(read).toMatchObject({ outcome: 'read', fromStart: false, cacheHit: false });
      const ranges = read.available && read.outcome === 'read' ? read.ranges : [];
      expect(ranges.map(({ from, to, firstTurnId, lastTurnId, entries }) =>
        ({ from, to, firstTurnId, lastTurnId, positions: entries.map((entry) => entry.position) })
      )).toEqual([
        { from: 1, to: 3, firstTurnId: 't-1', lastTurnId: 't-3', positions: [1, 2, 3] },
        { from: 5, to: 9, firstTurnId: 't-5', lastTurnId: 't-5', positions: [5] }
      ]);
    });

    it('starts from turn 1 when no turns are named', async () => {
      store.sessions.push(numbered(1, turns));

      const read = await service.read({ sessionId: 's1' });

      expect(read).toMatchObject({ outcome: 'read', fromStart: true });
      expect(read.available && read.outcome === 'read' && read.ranges.map(({ from, to }) => [from, to]))
        .toEqual([[1, 5]]);
    });

    it('reports an unreadable session by title, and refuses an invalid range loudly', async () => {
      store.sessions.push(numbered(1, turns), numbered(2));
      store.failures.set('s2', new Error('too large'));

      expect(await service.read({ sessionId: 's2' }))
        .toEqual({ available: true, outcome: 'unreadable', sessionId: 's2', title: 'Session 2' });
      await expect(service.read({ sessionId: 's1', turns: [{ from: 4, to: 2 }] }))
        .rejects.toThrow('Invalid session-recall turn range 4-2.');
    });
  });
});

describe('WorkshopTranscriptRecallService over the real store and coordinator', () => {
  it('composes with the real store and coordinator as its ports', async () => {
    const { store, coordinator, log, savedSessionId } = await saveSentinelCorpus();
    // Compiles only while the real classes satisfy the consumer-owned ports.
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);

    const catalog = await service.catalog({});

    expect(catalog.available && catalog.outcome === 'catalog' && catalog.sessions.map((s) => s.sessionId))
      .toEqual([savedSessionId]);
  });

  it('excludes the saved session once it is the live room again', async () => {
    const { store, coordinator, log, savedSessionId } = await saveSentinelCorpus();
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);

    await coordinator.openNamed(savedSessionId);

    expect(await service.catalog({})).toMatchObject({ outcome: 'catalog', sessions: [], matchingSessions: 0 });
    expect(await service.read({ sessionId: savedSessionId })).toMatchObject({
      outcome: 'unknown-session',
      liveSession: true
    });
  });

  it('charges about the real file size for a cold parse, and nothing when warm', async () => {
    const { fs, store, coordinator, log, savedSessionId } = await saveSentinelCorpus();
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);
    const directory = `${RECALL_ROOT}/prose-minion/sessions`;
    const namedFile = [...fs.files.keys()].find((file) =>
      file.startsWith(directory) && file.endsWith('.json') &&
      !file.endsWith('.summary.json') && !file.endsWith('/current.json')
    )!;

    const cold = await service.search({ query: 'lighthouse' });
    const warm = await service.search({ query: 'lighthouse' });

    const fileBytes = fs.files.get(namedFile)!.byteLength;
    const parsedBytes = cold.available && cold.outcome === 'searched' ? cold.bounds.parsedBytes : 0;
    // Decoding normalizes a few fields, so the estimate is close, not exact.
    expect(Math.abs(parsedBytes - fileBytes) / fileBytes).toBeLessThan(0.05);
    expect(cold).toMatchObject({ bounds: { cacheHits: 0 } });
    expect(warm).toMatchObject({ bounds: { parsedBytes: 0, cacheHits: 1 } });
    expect(savedSessionId).toBeTruthy();
  });

  it('stops reading unsupported files once their charge spends the budget (PR 126 F-02)', async () => {
    const fs = new MemoryFileSystem();
    const rooms = [];
    for (const title of ['First', 'Second', 'Third']) {
      rooms.push(await saveRecallRoom(title, (session) => {
        session.setSessionScope('open');
      }, { fs, idPrefix: title.toLowerCase() }));
    }
    const { store, coordinator, log } = rooms[2];
    const directory = `${RECALL_ROOT}/prose-minion/sessions`;
    const named = [...fs.files.keys()].filter((file) =>
      file.startsWith(directory) && file.endsWith('.json') &&
      !file.endsWith('.summary.json') && !file.endsWith('/current.json'));
    expect(named).toHaveLength(3);
    for (const file of named) {
      // Valid JSON the codec refuses, beside an intact browser index.
      fs.files.set(file, new TextEncoder().encode(JSON.stringify({
        schemaVersion: 99,
        padding: 'x'.repeat(128 * 1024)
      })));
    }
    jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', {
      ...PROMPT_BUDGETS.workshopTranscriptRecall,
      searchSourceBytes: 64 * 1024
    });
    const reads = jest.spyOn(store, 'readNamed');

    const result = await new WorkshopTranscriptRecallService(store, coordinator, log)
      .search({ query: 'anything' });

    expect(result).toMatchObject({
      outcome: 'searched',
      bounds: {
        corpusSessions: 3,
        sessionsSearched: 0,
        unreadableSessions: 1,
        notSearchedByByteBudget: 2,
        parsedBytes: 0
      }
    });
    expect(reads).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it('counts a corrupt or oversized saved file without failing the search', async () => {
    const { fs, store, coordinator, savedSessionId } = await saveSentinelCorpus();
    const log = recallLog();
    const directory = `${RECALL_ROOT}/prose-minion/sessions`;
    const namedFile = [...fs.files.keys()].find((file) =>
      file.startsWith(directory) && file.endsWith('.json') &&
      !file.endsWith('.summary.json') && !file.endsWith('/current.json')
    )!;
    // A second, healthy session beside the damaged one.
    await store.saveNamed({
      ...recallSession({ sessionId: 'healthy', title: 'Healthy', turns: [] }),
      workshop: (await store.readNamed(savedSessionId))!.workshop
    });
    fs.files.set(namedFile, new TextEncoder().encode('{"schemaVersion": 2, "broken'));

    const service = new WorkshopTranscriptRecallService(store, coordinator, log);
    const corrupt = await service.search({ query: 'lighthouse' });

    expect(corrupt).toMatchObject({
      outcome: 'searched',
      bounds: { corpusSessions: 2, sessionsSearched: 1, unreadableSessions: 1 }
    });

    const tiny = new WorkshopSessionStore(fs, RECALL_WORKSPACE, log, undefined, {
      maximumFiles: 200,
      maximumFileBytes: 5 * 1024 * 1024,
      maximumExactFileBytes: 64,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    });
    const oversized = await new WorkshopTranscriptRecallService(tiny, coordinator, log)
      .search({ query: 'lighthouse' });

    expect(oversized).toMatchObject({
      outcome: 'searched',
      bounds: { corpusSessions: 2, sessionsSearched: 0, unreadableSessions: 2 }
    });
  });
});
