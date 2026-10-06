/**
 * Session recall's per-turn sub-adapter (ADR 2026-10-05 §7, D9, D11), over
 * the real store and coordinator with real saved sessions: each operation
 * from request to result, the turn's read limits, the window clamp, the
 * refusals, provenance, manifest rows, and cancellation.
 */

import {
  WorkshopTranscriptRecallCapability,
  WorkshopTranscriptRecallPort
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallRead } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { WORKSHOP_TRANSCRIPT_RECALL_FRAMING } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type {
  WorkshopCapabilityResult,
  WorkshopTranscriptRecallRequest
} from '@shared/types/workshopCapabilities';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  RecallExcerptCorpus,
  saveExcerptCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallExcerptFixtures';
import { saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const NOW = Date.parse('2026-10-08T14:30:00.000Z');

const windowOf = (freeInputTokens: number): CapabilityContextWindow => ({
  contextLength: 200_000,
  requestTokens: 200_000 - freeInputTokens - 20_000,
  outputTokens: 10_000,
  headroomTokens: 10_000,
  freeInputTokens
});

const replaceBudgets = (overrides: Partial<typeof PROMPT_BUDGETS.workshopTranscriptRecall>) =>
  jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', {
    ...PROMPT_BUDGETS.workshopTranscriptRecall,
    ...overrides
  });

const read = (...sessionIds: string[]): WorkshopTranscriptRecallRequest => ({
  capability: 'transcript.read',
  sessions: sessionIds.map((sessionId) => ({ sessionId }))
});

/** What formatEvidence would put in front of the model, measured as the preflight measures it. */
const evidenceTokens = (result: WorkshopCapabilityResult): number => {
  const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return estimateTextTokens(escaped(result.content ?? '')) + estimateTextTokens(escaped(JSON.stringify(result.metadata)));
};

let corpus: RecallExcerptCorpus;
let service: WorkshopTranscriptRecallService;

beforeAll(async () => {
  corpus = await saveExcerptCorpus();
  service = new WorkshopTranscriptRecallService(corpus.store, corpus.coordinator, corpus.log);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const capabilityOver = (
  recall: WorkshopTranscriptRecallPort = service,
  signal: AbortSignal = new AbortController().signal
) => new WorkshopTranscriptRecallCapability(recall, corpus.log, { requestId: 'host-request', personaId: 'jill', signal }, () => NOW);

describe('each transcript.* operation, request to result', () => {
  it('lists sessions, privately: no manifest row, and no usage', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill({ capability: 'transcript.catalog', match: 'chapter 6.7' });

    expect(result).toMatchObject({
      capability: 'transcript.catalog',
      status: 'success',
      requestSummary: 'sessions matching “chapter 6.7”',
      metadata: { outcome: 'catalog', sessionCount: 3, matchingSessions: 3, matchMode: 'all-terms', truncated: false }
    });
    expect(result.content!.split('\n')[0]).toBe(WORKSHOP_TRANSCRIPT_RECALL_FRAMING);
    expect(result.content).toContain('Chapter 6.7 cliché pass');
    expect(result.content).not.toContain('Chapter 6.8 bridge');
    expect(result.usage).toBeUndefined();
    expect(capability.deliveredSources(result)).toEqual([]);
  });

  it('searches, privately, and fails plainly on a session it cannot name', async () => {
    const capability = capabilityOver();
    const found = await capability.fulfill({ capability: 'transcript.search', query: 'simile' });
    const unknown = await capability.fulfill({ capability: 'transcript.search', query: 'simile', sessionId: 'no-such-session' });

    expect(found).toMatchObject({ status: 'success', metadata: { outcome: 'searched', matchMode: 'all-terms' } });
    expect(found.content).toContain('DISCUSSION-CLICHE-SYNTHESIS-1: pass 1 flags the simile.');
    expect(capability.deliveredSources(found)).toEqual([]);
    expect(unknown).toMatchObject({ status: 'failed', metadata: { outcome: 'unknown-session', liveSession: false } });
    expect(unknown.content).toContain('No saved session in this workspace has id no-such-session.');
  });

  it('reads a session, with provenance that matches the rendered read and one Past session row', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill({
      capability: 'transcript.read',
      sessions: [{ sessionId: corpus.sessions.endings, turns: [{ from: 1, to: 99 }] }]
    });
    const expected = renderWorkshopRecallRead(
      await service.read({ sessions: [{ sessionId: corpus.sessions.endings, turns: [{ from: 1, to: 99 }] }] }),
      { now: NOW }
    );

    expect(result.content).toBe(expected.content);
    expect(result).toMatchObject({
      status: 'success',
      requestSummary: '“Chapter 6.7 endings” · turns 1-99',
      metadata: {
        outcome: 'read',
        detail: 'full',
        sessionCount: 1,
        limitedBy: 'read-budget',
        truncated: false,
        sessions: [{
          sessionId: corpus.sessions.endings,
          title: 'Chapter 6.7 endings',
          outcome: 'read',
          delivered: expected.sessions[0].delivered.map(({ from, to, firstTurnId, lastTurnId, entryCount }) =>
            ({ from, to, firstTurnId, lastTurnId, entryCount })),
          continuation: '',
          collapsedReports: 0
        }]
      }
    });
    const [delivered] = expected.sessions[0].delivered;
    expect(capability.deliveredSources(result)).toEqual([{
      kind: 'transcript',
      label: `“Chapter 6.7 endings” · turns ${delivered.from}-${delivered.to}`,
      sizeChars: expected.sessions[0].characters
    }]);
    expect(result.usage).toBeUndefined();
  });

  it('reads several sessions as one read, partial when one cannot be read, a row for each that delivered', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill(read(corpus.sessions.stock, 'no-such-session', corpus.sessions.endings));

    expect(result).toMatchObject({ status: 'partial', metadata: { outcome: 'read', detail: 'discussion', sessionCount: 2, sessionsNamed: 3 } });
    expect(result.requestSummary).toBe('3 saved sessions: “Stock & signature”, “Chapter 6.7 endings”');
    expect((result.metadata!.sessions as Array<{ outcome: string }>).map((session) => session.outcome))
      .toEqual(['read', 'unknown-session', 'read']);
    expect(capability.deliveredSources(result).map((source) => source.label)).toEqual([
      expect.stringMatching(/^“Stock & signature” · turns \d+-\d+$/),
      expect.stringMatching(/^“Chapter 6\.7 endings” · turns \d+-\d+$/)
    ]);
  });

  it('adds no row for a session read whose requested turns hold nothing visible', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill({
      capability: 'transcript.read',
      sessions: [{ sessionId: corpus.sessions.endings, turns: [{ from: 900, to: 950 }] }]
    });

    expect(result.status).toBe('success');
    expect(result.content).toContain('No visible turns in 900-950');
    expect(capability.deliveredSources(result)).toEqual([]);
  });

  it('fails a read that names no readable session, with no row', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill(read('no-such-session'));

    expect(result).toMatchObject({ status: 'failed', error: 'None of the named sessions could be read.' });
    expect(result.content).toContain('No saved session in this workspace has id no-such-session.');
    expect(capability.deliveredSources(result)).toEqual([]);
  });

  it('lists to-dos with the shown pairs as provenance, and one row naming the sessions listed', async () => {
    const capability = capabilityOver();
    const result = await capability.fulfill({ capability: 'transcript.todos', match: '6.7' });
    const expected = renderWorkshopRecallTodos(await service.todos({ match: '6.7' }), { now: NOW });

    expect(result.content).toBe(expected.content);
    expect(result).toMatchObject({
      status: 'success',
      requestSummary: 'open to-dos in sessions matching “6.7”',
      metadata: { outcome: 'todos', status: 'open', shown: expected.shown, sessionsShown: 3 }
    });
    expect(capability.deliveredSources(result)).toEqual([{
      kind: 'transcript',
      label: 'To-dos · “Chapter 6.7 endings”, “Chapter 6.7 cliché pass”, “Stock & signature”',
      sizeChars: expected.content.length
    }]);
    const none = await capability.fulfill({ capability: 'transcript.todos', status: 'dismissed' });
    expect(none.status).toBe('success');
    expect(capability.deliveredSources(none)).toEqual([]);
  });

  it('fails plainly when recall is unavailable', async () => {
    const unavailable = { available: false, reason: 'workspace-changed' } as const;
    const recall: WorkshopTranscriptRecallPort = {
      catalog: async () => unavailable,
      search: async () => unavailable,
      read: async () => unavailable,
      todos: async () => unavailable
    };
    const capability = capabilityOver(recall);

    for (const request of [
      { capability: 'transcript.catalog' },
      { capability: 'transcript.search', query: 'tide' },
      read('any'),
      { capability: 'transcript.todos' }
    ] as WorkshopTranscriptRecallRequest[]) {
      const result = await capability.fulfill(request);
      expect(result).toMatchObject({ status: 'failed', metadata: { outcome: 'unavailable', unavailableReason: 'workspace-changed' } });
      expect(result.content).toContain('session recall is off until the extension host reloads');
    }
  });
});

describe('a turn’s read limits', () => {
  it('allows readsPerTurn reads; a read that failed still spent one', async () => {
    const capability = capabilityOver();
    const reading = jest.spyOn(service, 'read');

    await capability.fulfill(read('no-such-session'));
    await capability.fulfill(read(corpus.sessions.endings));
    const third = await capability.fulfill(read(corpus.sessions.endings));

    expect(PROMPT_BUDGETS.workshopTranscriptRecall.readsPerTurn).toBe(2);
    expect(reading).toHaveBeenCalledTimes(2);
    expect(third).toMatchObject({
      status: 'rejected',
      error: 'Only 2 transcript reads are allowed per user turn. Answer from the reads you have, ' +
        'and tell the writer which sessions and turns are left for your next turn.',
      metadata: { rejectionReason: 'recall-read-limit' }
    });
  });

  it('limits a second read to what the turn’s total has left, and says so', async () => {
    replaceBudgets({ readCharacters: 30_000, readCharactersPerTurn: 40_000 });
    const capability = capabilityOver();
    const first = await capability.fulfill({ capability: 'transcript.read', sessions: [{ sessionId: corpus.sessions.stock }], detail: 'full' });
    const used = first.content!.length;
    const second = await capability.fulfill({ capability: 'transcript.read', sessions: [{ sessionId: corpus.sessions.cliche }], detail: 'full' });

    expect(first.metadata).toMatchObject({ limitedBy: 'read-budget', truncated: true });
    expect(used).toBeLessThanOrEqual(30_000);
    expect(first.content).not.toContain('This read was limited');
    expect(second.metadata).toMatchObject({ limitedBy: 'per-turn-total', readLimit: 40_000 - used });
    expect(second.content!.length).toBeLessThanOrEqual(40_000 - used);
    expect(second.content!.split('\n').slice(1, 3)).toContain(
      `This read was limited to ${(40_000 - used).toLocaleString('en-US')} characters: earlier reads this turn used ` +
        `${used.toLocaleString('en-US')} of the 40,000-character total.`
    );
  });

  it('leaves a full second read after a large first read (D11, amended in Slice 4)', async () => {
    // The live 6.8 pass: a batch read used 147,948 of the then 150,000-character total, and the tail's read was refused.
    // With a total of one read, a large first read squeezes or refuses the second; now the second is a full read.
    const capability = capabilityOver();
    const batch = await capability.fulfill({
      capability: 'transcript.read',
      sessions: [{ sessionId: corpus.sessions.stock }, { sessionId: corpus.sessions.cliche }, { sessionId: corpus.sessions.endings }],
      detail: 'full'
    });
    const tail = await capability.fulfill({ capability: 'transcript.read', sessions: [{ sessionId: corpus.sessions.stock, turns: [{ from: 10, to: 18 }] }] });

    expect(batch.metadata).toMatchObject({ limitedBy: 'read-budget', truncated: true });
    expect(batch.content!.length).toBeGreaterThan(PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters / 2);
    expect(tail).toMatchObject({ status: 'success', metadata: { limitedBy: 'read-budget', readLimit: 150_000 } });
  });

  it('refuses a read the turn’s total has no minimum share left for, naming what is left (decision 2)', async () => {
    replaceBudgets({ readCharacters: 15_000, readCharactersPerTurn: 20_000 });
    const capability = capabilityOver();
    // From the first report, so the read's one entry is cut to fill its window.
    const first = await capability.fulfill({
      capability: 'transcript.read', sessions: [{ sessionId: corpus.sessions.stock, turns: [{ from: 5, to: 18 }] }], detail: 'full'
    });
    const left = 20_000 - first.content!.length;
    const reading = jest.spyOn(service, 'read');
    const second = await capability.fulfill(read(corpus.sessions.cliche, corpus.sessions.endings));

    expect(left).toBeLessThan(12_000);
    expect(reading).not.toHaveBeenCalled();
    expect(second).toMatchObject({
      status: 'rejected',
      requestSummary: '2 saved sessions',
      metadata: { rejectionReason: 'recall-read-total', charactersLeft: left, minimumCharacters: 12_000, sessionsNamed: 2 }
    });
    expect(second.error).toBe(
      `This read names 2 saved sessions and needs at least 12,000 characters (6,000 per session), but only ` +
        `${left.toLocaleString('en-US')} are left: earlier reads this turn used ${first.content!.length.toLocaleString('en-US')} ` +
        'of the 20,000-character total. Read fewer sessions at once, or answer from what you have ' +
        'and tell the writer which sessions and turns are left for your next turn.'
    );
    // A refusal before the service spends no read: with room again, the turn's second read still runs.
    replaceBudgets({ readCharacters: 15_000, readCharactersPerTurn: 100_000 });
    expect((await capability.fulfill(read(corpus.sessions.endings))).status).toBe('success');
  });
});

describe('the context window clamp (D11)', () => {
  it('leaves the read budget standing when the window is unknown or roomy', async () => {
    const unknown = await capabilityOver().fulfill(read(corpus.sessions.stock, corpus.sessions.cliche));
    const roomy = await capabilityOver().fulfill(read(corpus.sessions.stock, corpus.sessions.cliche), windowOf(1_000_000));

    expect(unknown.metadata).toMatchObject({ limitedBy: 'read-budget', readLimit: 150_000 });
    expect(roomy.metadata).toMatchObject({ limitedBy: 'read-budget', readLimit: 150_000 });
    expect(roomy.content).toBe(unknown.content);
    expect(unknown.content).not.toContain('This read was limited');
  });

  it('limits a read to half the room left in the window, says so, and fits it', async () => {
    const window = windowOf(20_000);
    const result = await capabilityOver().fulfill({
      capability: 'transcript.read', sessions: [{ sessionId: corpus.sessions.stock }], detail: 'full'
    }, window);

    expect(result.metadata).toMatchObject({ limitedBy: 'context-window', truncated: true });
    expect(result.content).toContain('characters, half the room left in your context window.');
    expect(evidenceTokens(result)).toBeLessThanOrEqual(10_000);
    expect(result.content!.length).toBeLessThanOrEqual(result.metadata!.readLimit as number);
  });

  it('renders again smaller when dense text costs more than its characters suggest', async () => {
    const dense = await saveRecallRoom('Dense notes', (session, advance) => {
      session.setSessionScope('open');
      for (let index = 1; index <= 6; index += 1) {
        advance(60_000);
        session.beginPersonaMessage(`dense-${index}`, `第${index}问：${'界'.repeat(4_000)}`);
        advance(60_000);
        session.completeRun(`dense-${index}`, `第${index}答：${'灯'.repeat(6_000)}`, undefined, false, 'runtime-host');
      }
    }, { fs: corpus.fs, idPrefix: 'dense' });
    const recall = new WorkshopTranscriptRecallService(dense.store, dense.coordinator, dense.log);
    const result = await capabilityOver(recall).fulfill(read(dense.savedSessionId), windowOf(20_000));

    // A first guess of four characters a token would be 40,000 characters, about 30,000 tokens of this text.
    expect(result.metadata).toMatchObject({ limitedBy: 'context-window' });
    expect(result.metadata!.readLimit as number).toBeLessThan(40_000);
    expect(evidenceTokens(result)).toBeLessThanOrEqual(10_000);
    expect(result.content).toContain('界界界');
  });

  describe('sessions of different density, read together (PR 130 review F-01)', () => {
    const CHINESE = '灯塔守护者在黎明时分划船出海，海水冰冷而平静。';
    const ENGLISH = 'The keeper rows out at dawn, and the lighthouse lamp turns over the cold, flat water. ';
    const ESCAPED = '<keeper id="a&b">dawn</keeper> & <lamp>turns</lamp> ';
    let ids: { dense: string; plain: string; markup: string };
    let recall: WorkshopTranscriptRecallService;

    beforeAll(async () => {
      const save = (title: string, prefix: string, text: string) => saveRecallRoom(title, (session, advance) => {
        session.setSessionScope('open');
        advance(60_000);
        session.beginPersonaMessage(`${prefix}-1`, text);
        advance(60_000);
        session.completeRun(`${prefix}-1`, `${title}: noted.`, undefined, false, 'runtime-host');
      }, { fs: corpus.fs, idPrefix: prefix });
      const dense = await save('Dense chapter', 'mixed-dense', CHINESE.repeat(Math.ceil(33_000 / CHINESE.length)).slice(0, 33_000));
      const plain = await save('Plain chapter', 'mixed-plain', ENGLISH.repeat(1_400));
      const markup = await save('Markup chapter', 'mixed-markup', ESCAPED.repeat(2_000));
      ids = { dense: dense.savedSessionId, plain: plain.savedSessionId, markup: markup.savedSessionId };
      recall = new WorkshopTranscriptRecallService(markup.store, markup.coordinator, markup.log);
    });

    const both = (second: string): WorkshopTranscriptRecallRequest => ({
      capability: 'transcript.read',
      sessions: [{ sessionId: ids.dense, turns: [{ from: 2, to: 2 }] }, { sessionId: second, turns: [{ from: 2, to: 2 }] }],
      detail: 'full'
    });

    it('never refuses a read a smaller window could deliver', async () => {
      const control = await capabilityOver(recall).fulfill(both(ids.plain), windowOf(60_000));
      const larger = await capabilityOver(recall).fulfill(both(ids.plain), windowOf(66_000));

      expect(control.status).toBe('success');
      expect(evidenceTokens(control)).toBeLessThanOrEqual(30_000);
      expect(larger.status).toBe('success');
      expect(evidenceTokens(larger)).toBeLessThanOrEqual(33_000);
      expect(larger.content!.length).toBeGreaterThanOrEqual(control.content!.length);
    });

    it.each([
      ['English', 'plain'],
      ['escape-heavy', 'markup']
    ] as const)('delivers a fitting read beside %s text at every window from 20K to 80K free tokens', async (_label, second) => {
      for (let free = 20_000; free <= 80_000; free += 4_000) {
        const result = await capabilityOver(recall).fulfill(both(ids[second]), windowOf(free));
        expect({ free, status: result.status }).toEqual({ free, status: 'success' });
        expect(evidenceTokens(result)).toBeLessThanOrEqual(Math.floor(free / 2));
        expect((result.metadata!.sessions as Array<{ delivered: unknown[] }>).every((session) => session.delivered.length > 0)).toBe(true);
      }
    });
  });

  it('refuses a read whose window leaves less than a minimum share per session, before reading (decision 2)', async () => {
    const reading = jest.spyOn(service, 'read');
    const result = await capabilityOver().fulfill(
      read(corpus.sessions.stock, corpus.sessions.cliche, corpus.sessions.endings),
      windowOf(8_000)
    );

    expect(reading).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'rejected',
      metadata: { rejectionReason: 'recall-context-window', charactersLeft: 16_000, minimumCharacters: 18_000, sessionsNamed: 3 }
    });
    expect(result.error).toBe(
      'This read names 3 saved sessions and needs at least 18,000 characters (6,000 per session), but only 16,000 ' +
        'are left: half the room left in your context window. Read fewer sessions at once, or answer from what you have ' +
        'and tell the writer which sessions and turns you could not read.'
    );
  });

  it('refuses after reading when dense text leaves no minimum share once measured, and that read counts', async () => {
    const dense = await saveRecallRoom('Denser notes', (session, advance) => {
      session.setSessionScope('open');
      advance(60_000);
      session.beginPersonaMessage('dense-1', '界'.repeat(8_000));
      advance(60_000);
      session.completeRun('dense-1', '灯'.repeat(8_000), undefined, false, 'runtime-host');
    }, { fs: corpus.fs, idPrefix: 'denser' });
    const recall = new WorkshopTranscriptRecallService(dense.store, dense.coordinator, dense.log);
    const reading = jest.spyOn(recall, 'read');
    const capability = capabilityOver(recall);
    // Half the window is 1,600 tokens: 6,400 characters at first guess, but this text costs about 0.75 a character.
    // From the dense message, so it opens the window and is cut to fill it.
    const result = await capability.fulfill({
      capability: 'transcript.read', sessions: [{ sessionId: dense.savedSessionId, turns: [{ from: 2, to: 3 }] }]
    }, windowOf(3_200));

    expect(reading).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'rejected',
      metadata: { rejectionReason: 'recall-context-window', minimumCharacters: 6_000, halfWindowTokens: 1_600 }
    });
    // Measured, the minimum itself costs more than half the window: the refusal says so, in numbers.
    const { charactersLeft, minimumTokens } = result.metadata as { charactersLeft: number; minimumTokens: number };
    expect(minimumTokens).toBeGreaterThan(1_600);
    expect(charactersLeft).toBe(Math.floor(6_000 * (1_600 / minimumTokens)));
    expect(result.error).toBe(
      'This read names 1 saved session and needs at least 6,000 characters (6,000 per session), but half the room ' +
        `left in your context window holds only about ${charactersLeft.toLocaleString('en-US')} characters of these ` +
        `sessions: the minimum read measured ${minimumTokens.toLocaleString('en-US')} tokens against 1,600. Answer from what you have, ` +
        'and tell the writer which sessions and turns you could not read.'
    );
  });
});

describe('cancellation', () => {
  it('propagates a cancellation before or during a call', async () => {
    const before = new AbortController();
    before.abort();
    await expect(capabilityOver(service, before.signal).fulfill(read(corpus.sessions.stock)))
      .rejects.toMatchObject({ name: 'AbortError' });

    const during = new AbortController();
    const recall: WorkshopTranscriptRecallPort = {
      ...service,
      catalog: service.catalog.bind(service),
      search: service.search.bind(service),
      todos: service.todos.bind(service),
      read: async (request, signal) => {
        const result = await service.read(request, signal);
        during.abort();
        return result;
      }
    };
    await expect(capabilityOver(recall, during.signal).fulfill(read(corpus.sessions.stock)))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('lets the service’s own cancellation reject the call', async () => {
    const controller = new AbortController();
    const recall: WorkshopTranscriptRecallPort = {
      catalog: service.catalog.bind(service),
      search: service.search.bind(service),
      read: service.read.bind(service),
      todos: async (request, signal) => {
        controller.abort();
        return service.todos(request, signal);
      }
    };
    await expect(capabilityOver(recall, controller.signal).fulfill({ capability: 'transcript.todos' }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
