/**
 * Session recall wired into the persona capability (ADR 2026-10-05 §1,
 * §6, §7): a model's XML call decodes, dispatches to the sub-adapter over
 * the real recall service and real saved sessions, records a visible
 * artifact, and returns evidence in the quoted-record trust class. Hidden
 * bodies never reach that evidence, and a tool call quoted in a past reply
 * arrives escaped.
 */

import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopPersonaCapability,
  WorkshopPersonaCapabilityFactory
} from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  WORKSHOP_TRANSCRIPT_RECALL_EVIDENCE_FRAMING,
  WORKSHOP_TRANSCRIPT_RECALL_FRAMING,
  WORKSHOP_TRANSCRIPT_RECALL_REJECTED_COPY
} from '@/application/services/workshop/recall/WorkshopRecallCopy';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { saveExcerptCorpus, RecallExcerptCorpus } from '@/__tests__/application/services/workshop/recall/workshopRecallExcerptFixtures';
import {
  RECALL_ROOT,
  RECALL_SENTINELS,
  RECALL_VISIBLE_LABELS,
  saveRecallRoom,
  saveSentinelCorpus,
  SavedRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const TOOL_CALL_LITERAL =
  '<prose-minion-tool-call name="dictionary.lookup"><word>tide</word><context>a past reply</context>' +
  '<purpose>quoted</purpose></prose-minion-tool-call>';

const call = (operation: string, body: string): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;

interface Wired {
  readonly session: WorkshopSessionService;
  readonly capability: WorkshopPersonaCapability;
  readonly controller: AbortController;
  readonly log: { appendLine: jest.Mock };
}

/** A live room's persona turn, with session recall over `room`'s workspace. */
function wire(room: Pick<SavedRecallRoom, 'store' | 'coordinator' | 'log'>): Wired {
  const session = new WorkshopSessionService(() => Date.parse('2026-10-08T14:00:00.000Z'));
  session.setSessionScope('open');
  session.beginPersonaMessage('host-request', 'Pick up the 6.7 chats.');
  const controller = new AbortController();
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const recall = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);
  const capability = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
    session,
    log,
    recall
  ).create({
    requestId: 'host-request',
    excerptVersion: session.getExcerptVersion(),
    personaId: 'jill',
    owner: { kind: 'host' },
    signal: controller.signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
  return { session, capability, controller, log };
}

/** Decode a call as the engine does, then fulfill it. */
async function invoke(wired: Wired, xml: string, window?: CapabilityContextWindow) {
  const inspected = wired.capability.inspectRequest(xml);
  if (inspected.kind !== 'request') {
    throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
  }
  return { request: inspected.request, fulfillment: await wired.capability.fulfill(inspected.request, window) };
}

describe('transcript.* through the persona capability', () => {
  let corpus: RecallExcerptCorpus;

  beforeAll(async () => {
    corpus = await saveExcerptCorpus();
  });

  it('decodes, dispatches, records a Session Recall artifact, and frames the evidence as a quoted record', async () => {
    const wired = wire(corpus);
    const { fulfillment } = await invoke(wired, call('transcript.read', `<session>${corpus.sessions.endings}</session>`));
    const [turn] = wired.session.readRoomLedger().filter((candidate) => candidate.artifact === 'transcript_read');

    expect(fulfillment.evidence.startsWith(
      '<workshop-capability-result name="transcript.read" status="success" excerpt-version="0">'
    )).toBe(true);
    expect(fulfillment.evidence).toContain(`<content>${WORKSHOP_TRANSCRIPT_RECALL_FRAMING}`);
    expect(fulfillment.evidence.endsWith(`</workshop-capability-result>\n${WORKSHOP_TRANSCRIPT_RECALL_EVIDENCE_FRAMING}`)).toBe(true);
    expect(fulfillment.usage).toBeUndefined();
    expect(turn).toMatchObject({
      toolLabel: 'Session Recall',
      capability: { operation: 'transcript.read', status: 'success', requestSummary: '“Chapter 6.7 endings”' }
    });
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ id: turn.id, label: 'Session Recall', category: 'transcript.read' })]);
    expect(fulfillment.deliveredSources).toEqual([
      { kind: 'transcript', label: expect.stringMatching(/^“Chapter 6\.7 endings” · turns 1-\d+$/), sizeChars: expect.any(Number) }
    ]);
    expect(wired.log.appendLine.mock.calls.map(([line]) => String(line)).join('\n'))
      .toMatch(/capability=transcript\.read input=sessions=1; ranges=0; detail=default .*recallMetrics=outcome=read;sessions=1;/);
  });

  it('runs every operation, and publishes only reads and to-do lists with the committed reply', async () => {
    const wired = wire(corpus);
    const results = [];
    for (const xml of [
      call('transcript.catalog', '<match>chapter 6.7</match>'),
      call('transcript.search', '<query>simile</query><persona>Jill</persona>'),
      call('transcript.read', `<session turns="1-3">${corpus.sessions.stock}</session><session>${corpus.sessions.cliche}</session>`),
      call('transcript.todos', '<match>6.7</match><status>open</status>')
    ]) {
      results.push(await invoke(wired, xml));
    }
    expect(results.map(({ fulfillment }) => fulfillment.deliveredSources?.length)).toEqual([0, 0, 2, 1]);
    wired.session.completeRun('host-request', 'Here is where the 6.7 chats landed.', undefined, false, 'host-conversation');

    const recalled = wired.session.readRoomLedger().filter((turn) => turn.toolLabel === 'Session Recall');
    expect(recalled.map((turn) => [turn.artifact, turn.capability!.status, turn.capability!.publishedWithTurnId !== undefined]))
      .toEqual([
        ['transcript_catalog', 'success', false],
        ['transcript_search', 'success', false],
        ['transcript_read', 'success', true],
        ['transcript_todos', 'success', true]
      ]);
  });

  it('names the call in the status line, the ticker, and the log', () => {
    const { capability } = wire(corpus);
    const read: WorkshopCapabilityRequest = {
      capability: 'transcript.read',
      sessions: [{ sessionId: 'a' }, { sessionId: 'b' }, { sessionId: 'c' }]
    };

    expect(capability.statusMessage(read)).toBe('Jill is reading 3 saved sessions…');
    expect(capability.statusTicker(read)).toBe('Recall · 3 sessions');
    expect(capability.requestLogSummary(read)).toBe('sessions=3; ranges=0; detail=default');
    expect(capability.statusMessage({ capability: 'transcript.search', query: 'tide' }))
      .toBe('Jill is searching saved Workshop sessions for “tide”…');
    expect(capability.statusTicker({ capability: 'transcript.todos', status: 'all' })).toBe('Recall · all to-dos');
  });

  it('leaves a visible artifact for a refused call, and for one over the call limit', () => {
    const wired = wire(corpus);
    const refused = wired.capability.inspectRequest(
      call('transcript.read', '<session>a</session><session>b</session><turns>3</turns>')
    );
    expect(refused).toEqual({ kind: 'invalid', reason: 'ambiguous-turns', field: 'turns', operation: 'transcript.read' });
    if (refused.kind !== 'invalid') {
      throw new Error('expected a refusal');
    }
    const invalid = wired.capability.handleInvalidRequest(refused);
    const limited = wired.capability.handleCapabilityLimit({ capability: 'transcript.catalog' });
    const recorded = wired.session.readRoomLedger().filter((turn) => turn.toolLabel === 'Session Recall');

    expect(invalid).toHaveLength(1);
    expect(limited).toHaveLength(1);
    expect(recorded.map((turn) => [turn.capability!.status, turn.capability!.requestSummary, turn.content])).toEqual([
      ['rejected', 'transcript.read rejected (ambiguous-turns: turns)', WORKSHOP_TRANSCRIPT_RECALL_REJECTED_COPY.invalid],
      ['rejected', 'saved-session catalog', WORKSHOP_TRANSCRIPT_RECALL_REJECTED_COPY.limit]
    ]);
  });

  it('records a read over the turn’s read limit as rejected', async () => {
    const wired = wire(corpus);
    for (let index = 0; index < 3; index += 1) {
      await invoke(wired, call('transcript.read', `<session>${corpus.sessions.endings}</session>`));
    }
    const reads = wired.session.readRoomLedger().filter((turn) => turn.artifact === 'transcript_read');

    expect(reads.map((turn) => turn.capability!.status)).toEqual(['success', 'success', 'rejected']);
    expect(reads[2].content).toBe(
      'Only 2 transcript reads are allowed per user turn. Answer from the reads you have, ' +
        'and tell the writer which sessions and turns are left for your next turn.'
    );
  });

  it('passes the engine’s window to the clamp', async () => {
    const wired = wire(corpus);
    const { fulfillment } = await invoke(
      wired,
      call('transcript.read', `<session>${corpus.sessions.stock}</session><detail>full</detail>`),
      { contextLength: 100_000, requestTokens: 60_000, outputTokens: 10_000, headroomTokens: 5_000, freeInputTokens: 25_000 }
    );

    expect(fulfillment.evidence).toContain('half the room left in your context window.');
    expect(fulfillment.evidence).toContain('"limitedBy":"context-window"');
  });

  it('reports a cancelled call as cancelled', async () => {
    const wired = wire(corpus);
    wired.controller.abort();
    const { fulfillment } = await invoke(wired, call('transcript.catalog', ''));

    expect(fulfillment.evidence).toContain('<workshop-capability-result name="transcript.catalog" status="cancelled"');
    expect(fulfillment.deliveredSources).toEqual([]);
  });

  it('still refuses an operation outside the closed list', () => {
    const codec = new WorkshopCapabilityXmlCodec();
    expect(codec.inspect(call('transcript.delete', '<session>a</session>'))).toEqual({ kind: 'invalid', reason: 'unknown-capability' });
    expect(codec.inspect(call('memory.read', '<session>a</session>'))).toEqual({ kind: 'invalid', reason: 'unknown-capability' });
  });
});

describe('continuations and hints, followed together exactly as written', () => {
  let corpus: RecallExcerptCorpus;

  beforeAll(async () => {
    corpus = await saveExcerptCorpus();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** The evidence's text as the model reads it: unescaped. */
  const readable = (evidence: string): string =>
    evidence.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  it('every continuation of a read of several sessions, in one call, keeps its detail and continues', async () => {
    jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', { ...PROMPT_BUDGETS.workshopTranscriptRecall, readCharacters: 24_000 });
    const first = await invoke(wire(corpus), call('transcript.read',
      `<session>${corpus.sessions.stock}</session><session>${corpus.sessions.cliche}</session><detail>full</detail>`));
    const continuations = [...readable(first.fulfillment.evidence).matchAll(/Continue with (<session turns="[^"]+">[^<]+<\/session> <detail>\w+<\/detail>)/g)]
      .map(([, written]) => written);
    expect(continuations).toHaveLength(2);

    const next = await invoke(wire(corpus), call('transcript.read', continuations.join(' ')));
    expect(next.request).toMatchObject({ capability: 'transcript.read', detail: 'full' });
    expect(next.fulfillment.evidence).toContain('status="success"');
    expect(next.fulfillment.evidence).toContain('Read of 2 saved sessions, in the order asked, in full detail.');
    // Each continues at its first unread report, shown in full rather than collapsed.
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[0].body.slice(0, 200));
    expect(next.fulfillment.evidence).toContain(corpus.reports.cliche[0].body.slice(0, 200));
  });

  it('two chats’ collapsed reports, in one call, read in full', async () => {
    const first = await invoke(wire(corpus), call('transcript.read',
      `<session>${corpus.sessions.stock}</session><session>${corpus.sessions.cliche}</session>`));
    const hints = [...readable(first.fulfillment.evidence).matchAll(/read it in full with (<session turns="\d+">([^<]+)<\/session> <detail>full<\/detail>)\]/g)];
    const written = [corpus.sessions.stock, corpus.sessions.cliche].map((id) => hints.find(([, , sessionId]) => sessionId === id)![1]);

    const next = await invoke(wire(corpus), call('transcript.read', written.join('\n')));
    expect(next.request).toMatchObject({ detail: 'full' });
    expect(next.fulfillment.evidence).not.toContain('read it in full with');
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[0].body.slice(0, 200));
    expect(next.fulfillment.evidence).toContain(corpus.reports.cliche[0].body.slice(0, 200));
  });

  it('two hints naming one session of a batch combine their ranges; written side by side, they name it twice (PR 130 F-02)', async () => {
    const first = await invoke(wire(corpus), call('transcript.read',
      `<session>${corpus.sessions.stock}</session><session>${corpus.sessions.cliche}</session>`));
    const stock = [...readable(first.fulfillment.evidence).matchAll(/read it in full with (<session turns="(\d+)">([^<]+)<\/session> <detail>full<\/detail>)\]/g)]
      .filter(([, , , sessionId]) => sessionId === corpus.sessions.stock)
      .slice(0, 2);
    expect(stock).toHaveLength(2);

    // Each names its session; one call names a session once, so the literal pair is refused.
    expect(wire(corpus).capability.inspectRequest(call('transcript.read', stock.map(([, written]) => written).join('\n'))))
      .toEqual({ kind: 'invalid', reason: 'duplicate-session', field: 'session', operation: 'transcript.read' });
    // Combined into one session with both ranges, it reads both reports in full.
    const turns = stock.map(([, , turn]) => turn).join(', ');
    const next = await invoke(wire(corpus), call('transcript.read',
      `<session turns="${turns}">${corpus.sessions.stock}</session> <detail>full</detail>`));
    expect(next.fulfillment.evidence).not.toContain('read it in full with');
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[0].body.slice(0, 200));
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[1].body.slice(0, 200));
  });

  it('two collapsed reports of a one-session read, beside their session, read in full', async () => {
    const first = await invoke(wire(corpus), call('transcript.read',
      `<session>${corpus.sessions.stock}</session><detail>discussion</detail>`));
    const written = [...readable(first.fulfillment.evidence).matchAll(/read it in full with (<turns>\d+<\/turns> <detail>full<\/detail>)\]/g)]
      .slice(0, 2).map(([, hint]) => hint);
    expect(written).toHaveLength(2);

    const next = await invoke(wire(corpus), call('transcript.read', `<session>${corpus.sessions.stock}</session>${written.join(' ')}`));
    expect(next.fulfillment.evidence).not.toContain('read it in full with');
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[0].body.slice(0, 200));
    expect(next.fulfillment.evidence).toContain(corpus.reports.stock[1].body.slice(0, 200));
  });

  it('a one-session hint and that read’s discussion continuation, followed together, are refused rather than collapsing the report again', async () => {
    // A report, then more discussion than one 8,000-character read holds.
    const report = `LONG-CHAT-REPORT ${'The beat lands on a stock gesture. '.repeat(40)}`;
    const long = await saveRecallRoom('Long chat', (session, advance) => {
      session.setExcerpt({
        text: 'The laughter was raucous.',
        source: { kind: 'file', sourceUri: `file://${RECALL_ROOT}/drafts/long.md`, relativePath: 'drafts/long.md' }
      });
      session.setSessionScope('excerpt');
      advance(60_000);
      session.beginToolRun('stock-and-signature', 'long-report');
      session.completeToolReport('long-report', report, 'conv-long-report', undefined, false, []);
      for (let reply = 1; reply <= 6; reply += 1) {
        advance(60_000);
        session.beginPersonaMessage(`long-${reply}`, `Question ${reply}?`);
        advance(60_000);
        session.completeRun(`long-${reply}`, `LONG-CHAT-REPLY-${reply} ${'word '.repeat(400)}`, undefined, false, 'runtime-long');
      }
    }, { idPrefix: 'long' });
    jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall', { ...PROMPT_BUDGETS.workshopTranscriptRecall, readCharacters: 8_000 });
    const session = `<session>${long.savedSessionId}</session>`;
    const first = readable((await invoke(wire(long), call('transcript.read', `${session}<detail>discussion</detail>`))).fulfillment.evidence);
    const hint = /read it in full with (<turns>\d+<\/turns> <detail>full<\/detail>)\]/.exec(first)![1];
    const continuation = /Continue with (<turns>[^<]+<\/turns> <detail>discussion<\/detail>)\./.exec(first)![1];

    // Together they ask for two details; the codec refuses that instead of reading the report collapsed again.
    expect(wire(long).capability.inspectRequest(call('transcript.read', `${session}${hint} ${continuation}`)))
      .toEqual({ kind: 'invalid', reason: 'conflicting-detail', field: 'detail', operation: 'transcript.read' });
    // Each followed in its own read works as written.
    const whole = await invoke(wire(long), call('transcript.read', `${session}${hint}`));
    expect(whole.fulfillment.evidence).toContain('LONG-CHAT-REPORT The beat lands');
    const next = readable((await invoke(wire(long), call('transcript.read', `${session}${continuation}`))).fulfillment.evidence);
    expect(next).toContain('Discussion detail:');
    expect(next).toMatch(/LONG-CHAT-REPLY-\d/);
  });
});

describe('session recall visibility, through the capability’s evidence', () => {
  let evidence: string;

  beforeAll(async () => {
    const first = await saveSentinelCorpus();
    const second = await saveSentinelCorpus({ fs: first.fs, idPrefix: 'second' });
    // A past reply that quotes a tool call: recalled, it must stay inert text.
    const literal = await saveRecallRoom('Quoted call', (session, advance) => {
      session.setSessionScope('open');
      advance(60_000);
      session.beginPersonaMessage('literal-1', 'How would you look up a word?');
      advance(60_000);
      session.completeRun('literal-1', `Like this: ${TOOL_CALL_LITERAL}`, undefined, false, 'runtime-literal');
    }, { fs: first.fs, idPrefix: 'literal' });
    const ids = [first.savedSessionId, second.savedSessionId, literal.savedSessionId];
    const calls = [
      call('transcript.catalog', ''),
      call('transcript.catalog', '<match>lighthouse</match>'),
      ...['lighthouse', 'letters keeper', 'keeper-notes', 'tide tables', 'sentinel', 'dictionary lookup']
        .map((query) => call('transcript.search', `<query>${query}</query>`)),
      call('transcript.read', ids.map((id) => `<session>${id}</session>`).join('')),
      call('transcript.read', `<session>${first.savedSessionId}</session><detail>full</detail>`),
      call('transcript.todos', '<status>all</status>')
    ];
    const outputs: string[] = [];
    // Two reads per turn: give each call a fresh turn.
    for (const xml of calls) {
      outputs.push((await invoke(wire(literal), xml)).fulfillment.evidence);
    }
    evidence = outputs.join('\n');
  });

  it.each(Object.entries(RECALL_SENTINELS))('never returns the %s', (_field, sentinel) => {
    expect(evidence).not.toContain(sentinel);
  });

  it('still returns the labels and lines a reader sees', () => {
    expect(evidence).toContain(RECALL_VISIBLE_LABELS.reply);
    expect(evidence).toContain(RECALL_VISIBLE_LABELS.writerText);
    expect(evidence).toContain(`Attached: ${RECALL_VISIBLE_LABELS.attachment}`);
  });

  it('escapes a tool call quoted in a past reply, so it can never execute', () => {
    expect(evidence).not.toContain('<prose-minion-tool-call');
    expect(evidence).toContain('Like this: &lt;prose-minion-tool-call name="dictionary.lookup"&gt;&lt;word&gt;tide&lt;/word&gt;');
    expect(new WorkshopCapabilityXmlCodec().inspect(evidence)).toEqual({ kind: 'none' });
  });
});
