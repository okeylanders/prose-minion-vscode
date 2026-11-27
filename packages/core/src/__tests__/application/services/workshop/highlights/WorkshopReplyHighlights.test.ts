import { createWorkshopRouteTestHarness, analysisResult } from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';
import type { WorkshopHighlightsDraft } from '@/utils/workshopReplyHighlights';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy, type WorkshopRunCompletionInput } from '@/application/services/workshop/WorkshopRunCompletion';
import { authorizeWorkshopReplyHighlights, type WorkshopHighlightProposalDetails } from '@/application/services/workshop/highlights/WorkshopReplyHighlights';
import type { WorkshopHighlightCounts } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { parseWorkshopPersistedSession, decodeWorkshopPersistedSessionCheckpoint } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopHighlightProposal } from '@/application/handlers/domain/workshop/WorkshopHighlightProposal';
import { MessageType, type WorkshopHighlightPrompt, type WorkshopExcerptSource, type WorkshopTurn } from '@messages';

const set = { title: 'Private title', places: [
  { start: { quote: 'Private quote' }, note: 'Private note' },
  { start: { quote: 'Another quote' }, note: 'Another note' }
] };
const source = { sourceUri: 'file:///chapters/private.md', relativePath: 'chapters/private.md' };
const frame = `<prose-minion-highlights>${JSON.stringify(set)}</prose-minion-highlights>`;
const counts: WorkshopHighlightCounts = { placed: 1, dropped: { unanchored: 0, ambiguous: 1, protected: 0, unordered: 0 } };
const requestId = 'writer-send';

function room(provenance: WorkshopExcerptSource = { kind: 'file', ...source }) {
  const session = new WorkshopSessionService(() => 42);
  const excerpt = session.setExcerpt({ text: 'Pinned text', source: provenance });
  session.beginPersonaMessage(requestId, 'Please mark the passages we discussed.');
  const authorizeExcerptReread = jest.fn(async () => ({
    kind: 'authorized' as const, fsPath: '/chapters/private.md', source: { kind: 'file' as const, ...source }
  }));
  const showOpen = jest.fn((turnId: string, _path: string, _label: string, _draft: WorkshopHighlightsDraft): WorkshopHighlightCounts | undefined => {
    expect(session.readRoomLedger().find((turn) => turn.id === turnId)?.highlights?.set).toEqual(set);
    return counts;
  });
  const log = jest.fn();
  const controller = new AbortController();
  const ask = jest.fn(async (_details: WorkshopHighlightProposalDetails, _signal: AbortSignal) => true);
  const prepare = (reply = frame) => authorizeWorkshopReplyHighlights({ reply, requestId, roomRevision: session.readRoomRevision(), excerpt,
    intake: { authorizeExcerptReread, toDisplayPath: () => source.relativePath }, editor: { showOpen, show: jest.fn(), clear: jest.fn(), retain: jest.fn() }, signal: controller.signal,
    persona: 'Jill', session, ask });
  const complete = (extra: Partial<WorkshopRunCompletionInput>, content = frame) => completeWorkshopRun({
    session, requestId, label: 'Jill',
    result: { toolName: 'workshop-test', content, conversationId: 'host-conversation', timestamp: new Date(0) },
    aborted: false, createsRetainedConversation: true, copy: workshopMessageCompletionCopy('Jill'), log,
    discardConversation: jest.fn(), readRetainedHistory: () => ({ messageCount: 2, contextSourceCount: 0 }),
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() },
    ...extra
  });
  return { session, authorizeExcerptReread, ask, showOpen, prepare, complete, log, controller };
}

describe('highlights on a writer-directed Workshop reply', () => {
  async function routedRoom() {
    const showOpen = jest.fn(() => counts);
    const harness = createWorkshopRouteTestHarness({ workshopHighlights: { showOpen, show: jest.fn(), retain: jest.fn(), clear: jest.fn() } });
    const notification = jest.spyOn(harness.shell, 'showInformationMessage');
    const proposals = new Map<string, WorkshopHighlightPrompt>();
    let waiting: ((prompt: WorkshopHighlightPrompt) => void) | undefined;
    harness.postMessage.mockImplementation(async (message) => {
      const prompt = message.type === MessageType.WORKSHOP_SESSION_STATE && message.payload.highlightPrompt;
      if (prompt?.kind === 'proposal' && !proposals.has(prompt.promptId)) {
        proposals.set(prompt.promptId, prompt);
        waiting?.(prompt);
        waiting = undefined;
      }
    });
    const nextProposal = () => new Promise<WorkshopHighlightPrompt>((resolve) => { waiting = resolve; });
    const answer = (prompt: WorkshopHighlightPrompt, choice: 'apply' | 'skip') => harness.router.route({
      type: MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT, source: 'webview.workshop', timestamp: 2,
      payload: { promptId: prompt.promptId, roomRevision: prompt.roomRevision, choice }
    });
    const path = 'Characters/raven.md';
    await harness.router.route({ type: MessageType.WORKSHOP_SET_EXCERPT, timestamp: 0, source: 'webview.workshop', payload: {
      text: 'Raven looks at the token.', source: { kind: 'editor-selection', sourceUri: `file:///ws/${path}`, relativePath: path }
    } });
    const send = (text: string) => harness.handler.handleSendMessage({
      type: MessageType.WORKSHOP_SEND_MESSAGE, source: 'webview.workshop', timestamp: 1, payload: { text }
    });
    const invite = () => harness.handler.handleInviteGuest({
      type: MessageType.WORKSHOP_INVITE_GUEST, source: 'webview.workshop', timestamp: 1,
      payload: { personaId: 'margot', openingMessage: 'Hello. What do you think of this scene?' }
    });
    return { harness, showOpen, notification, proposals, nextProposal, answer, path, send, invite };
  }

  it('draws an approved composer reply and asks again before retaining a later set', async () => {
    const { harness, notification, proposals, nextProposal, answer, path, send, showOpen } = await routedRoom();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult(frame, { conversationId: 'host-conv' }));
    const offered = nextProposal();
    const requested = send('Marca esos pasajes.');
    const prompt = await offered;
    expect(prompt).toEqual({ kind: 'proposal', persona: 'Jill', title: 'Private title', count: 2,
      displayPath: path, roomRevision: harness.session.readRoomRevision(), promptId: expect.any(String) });
    expect(showOpen).not.toHaveBeenCalled();
    expect(harness.session.readRoomLedger().some(turn => turn.highlights)).toBe(false);
    await harness.router.route({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', timestamp: 2, payload: {} });
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.highlightPrompt).toEqual(prompt);
    await answer(prompt, 'apply');
    await requested;
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(showOpen).toHaveBeenCalledWith(reply.id, `/ws/${path}`, 'Jill', set);
    expect(reply.highlights?.set).toEqual(set);
    expect(JSON.stringify(harness.postMessage.mock.calls)).toContain('highlightSummary');
    expect(JSON.stringify(harness.postMessage.mock.calls)).not.toMatch(/Private quote|Private note/);

    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`The scene works.\n${frame}`, { conversationId: 'host-conv' }));
    const another = nextProposal();
    const unsolicited = send('Just critique the pacing.');
    const second = await another;
    expect(second.promptId).not.toBe(prompt.promptId);
    await answer(prompt, 'apply');
    await answer(second, 'skip');
    await unsolicited;
    const critique = harness.session.readRoomLedger().at(-1)!;
    expect(critique.content).toBe('The scene works.');
    expect(critique.highlights).toBeUndefined();
    expect(critique.trailerOutcomes?.highlights?.rejected).toEqual([{ reason: 'skipped', count: 1 }]);
    expect(proposals.size).toBe(2);
    expect(notification).not.toHaveBeenCalled();
    expect(showOpen).toHaveBeenCalledTimes(1);
    harness.handler.dispose();
  });

  it.each([
    ['a greeting', 'Hi there!', false],
    ['a malformed set', '<prose-minion-highlights>{}</prose-minion-highlights>', false],
    ['an unsolicited set', frame, true]
  ] as const)('retains a guest opening with %s without drawing', async (_case, content, offered) => {
    const { harness, notification, proposals, nextProposal, answer, invite, showOpen } = await routedRoom();
    harness.service.startWorkshopGuestConversation.mockResolvedValueOnce(analysisResult(content, { conversationId: 'guest-conv' }));
    const question = offered ? nextProposal() : undefined;
    const joined = invite();
    if (question) {
      await answer(await question, 'skip');
    }
    await joined;
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(reply.participant).toBe('guest');
    expect(reply.highlights).toBeUndefined();
    expect(showOpen).not.toHaveBeenCalled();
    expect(proposals.size).toBe(offered ? 1 : 0);
    expect(notification).not.toHaveBeenCalled();
    if (offered) {
      expect(reply.trailerOutcomes?.highlights?.rejected).toEqual([{ reason: 'skipped', count: 1 }]);
    }
    harness.handler.dispose();
  });

  it('lets Stop release an unanswered Workshop question and ignores a late Apply', async () => {
    const { prepare, controller, ask, showOpen } = room();
    const broker = new WorkshopHighlightProposal(jest.fn());
    ask.mockImplementation((details, signal) => broker.ask(details, signal));
    const pending = prepare();
    await Promise.resolve();
    const prompt = broker.current()!;
    expect(prompt.kind).toBe('proposal');
    controller.abort();
    expect(await pending).toBeUndefined();
    expect(broker.current()).toBeUndefined();
    broker.answer({ ...prompt, choice: 'apply' });
    expect(showOpen).not.toHaveBeenCalled();
  });

  it('checks room ownership before the prompt, after Apply, and on adoption of exactly the approved reply', async () => {
    const before = room();
    const pending = before.prepare();
    before.session.invalidatePendingRoomReads();
    expect(await pending).toBeUndefined();
    expect(before.ask).not.toHaveBeenCalled();

    const after = room();
    after.ask.mockImplementation(async () => {
      after.session.abandonRun(requestId);
      return true;
    });
    expect(await after.prepare()).toBeUndefined();
    expect(after.showOpen).not.toHaveBeenCalled();

    const swapped = room();
    const target = await swapped.prepare();
    const changed = swapped.complete({ highlights: target }, frame.replace('Private title', 'Different set'));
    expect(changed?.highlights).toBeUndefined();
    expect(swapped.showOpen).not.toHaveBeenCalled();
  });

  it('keeps the chip on a mixed reaction and highlights reply', async () => {
    const { prepare, complete, session } = room();
    const mixed = `<prose-minion-reaction>heart</prose-minion-reaction>\n${frame}`;
    const turn = complete({ highlights: await prepare(mixed), reactionsOpen: true }, mixed)!;
    expect(turn.reactionOnly).toBeUndefined();
    expect(turn.highlights?.set).toEqual(set);
    expect(turn.content).toContain('proposed highlights');
    expect(session.readRoomReactions()).toHaveLength(1);
  });

  it.each<WorkshopExcerptSource['kind']>(['file', 'editor-selection'])('binds a %s source, draws after adoption and returns only counts', async (kind) => {
    const { session, prepare, complete, showOpen, authorizeExcerptReread, log } = room({ kind: kind as 'file' | 'editor-selection', ...source });
    const turn = complete({ highlights: await prepare() })!;
    expect(authorizeExcerptReread).toHaveBeenCalledWith({ kind: 'file', ...source });
    expect(showOpen).toHaveBeenCalledWith(turn.id, '/chapters/private.md', turn.personaLabel, set);
    expect(turn.content).toBe('Proposed highlights.');
    expect(turn.highlights).toEqual({ source, set });
    const view = workshopTurnForWebview(turn);
    expect(view.highlightSummary).toEqual({ title: set.title, count: 2 });
    expect(JSON.stringify(view)).not.toMatch(/private\.md|Private quote|Private note|trailerOutcomes/);
    const outcomes = workshopTrailerOutcomesFrameFor(session.readRoomLedger(), { kind: 'host' });
    expect(outcomes).toContain('1 placed, 1 dropped (ambiguous)');
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Example', exportedAt: 42 });
    expect(transcript.entries.filter((entry) => entry.kind === 'event' && entry.text === 'Kept 2 highlights.')).toHaveLength(1);
    expect(JSON.stringify([outcomes, log.mock.calls, transcript])).not.toMatch(/Private (title|note|quote)|private\.md/);
  });

  it('keeps closed files for Show and counts them separately from failed placements', async () => {
    const { prepare, complete, showOpen } = room();
    showOpen.mockReturnValue(undefined);
    const turn = complete({ highlights: await prepare() })!;
    expect(turn.highlights).toEqual({ source, set });
    expect(turn.trailerOutcomes?.highlights).toEqual({ placed: 0, closed: 2, dropped: [], rejected: [] });
  });

  it('counts an editor failure and retains the reply for Show', async () => {
    const { prepare, complete, showOpen, log } = room();
    showOpen.mockImplementation(() => { throw new Error('Private note'); });
    const turn = complete({ highlights: await prepare() })!;
    expect(turn.highlights).toEqual({ source, set });
    expect(turn.trailerOutcomes?.highlights?.dropped).toEqual([{ reason: 'display-failed', count: 2 }]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('Private note');
  });

  it('refuses unsupported, manual, unauthorized or superseded targets and strips the frame', async () => {
    for (const state of ['no-target', 'manual', 'unreadable', 'different-request', 'stale-excerpt', 'stale-room']) {
      const { session, authorizeExcerptReread, prepare, complete, showOpen } = room(state === 'manual' ? { kind: 'manual' } : undefined);
      if (state === 'unreadable') { authorizeExcerptReread.mockRejectedValue(new Error('private.md')); }
      const content = `A reply.\n${frame}`;
      const target = state === 'no-target' ? undefined : await prepare(content);
      if (state === 'stale-room') { session.invalidatePendingRoomReads(); }
      const highlights = target && { ...target,
        requestId: state === 'different-request' ? 'another-run' : target.requestId,
        excerptVersion: state === 'stale-excerpt' ? target.excerptVersion + 1 : target.excerptVersion };
      const turn = complete({ highlights }, content)!;
      expect(turn.content).toBe('A reply.');
      expect(turn.highlights).toBeUndefined();
      expect(turn.trailerOutcomes?.highlights?.rejected).toEqual([{ reason: 'unavailable', count: 1 }]);
      expect(showOpen).not.toHaveBeenCalled();
    }
  });

  it('discards cancelled and zombie runs without drawing', async () => {
    for (const state of ['aborted', 'zombie']) {
      const { session, prepare, complete, showOpen } = room();
      const highlights = await prepare();
      if (state === 'zombie') { session.abandonRun(requestId); }
      expect(complete({ highlights, aborted: state === 'aborted' })).toBeUndefined();
      expect(showOpen).not.toHaveBeenCalled();
    }
  });
});

// An authentic v2 room written by the build before group-match support, including its passage-search cards.
const fixture = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-group-match.json'));
function saved(edit: (turn: WorkshopTurn) => void = () => {}) {
  const document = JSON.parse(fixture);
  edit(document.workshop.turns.find((turn: WorkshopTurn) => turn.participant === 'host' && turn.role === 'assistant'));
  return document;
}

describe('persisted highlight records', () => {
  it('hydrates and reserializes the authentic pre-feature room byte-for-byte', () => {
    expect(fixture).not.toContain('highlights');
    expect(JSON.stringify(parseWorkshopPersistedSession(saved()))).toBe(fixture);
    expect(decodeWorkshopPersistedSessionCheckpoint(saved()).session.workshop.turns.length).toBeGreaterThan(0);
  });

  it('round-trips redraw data, including counts and closed reasons', async () => {
    const { prepare, complete } = room();
    const committed = complete({ highlights: await prepare() })!;
    const document = saved((reply) => {
      reply.highlights = committed.highlights;
      reply.trailerOutcomes = committed.trailerOutcomes;
    });
    const decoded = decodeWorkshopPersistedSessionCheckpoint(document).session.workshop.turns as WorkshopTurn[];
    expect(decoded.find((reply) => reply.highlights)?.highlights).toEqual(committed.highlights);
    expect(JSON.stringify(parseWorkshopPersistedSession(document))).toBe(JSON.stringify(document));
  });

  it.each([
    { source, set: { ...set, path: '/other/file' } },
    { source: { ...source, path: '/other/file' }, set },
    { source: { ...source, sourceUri: 'https://example.invalid' }, set },
    { source, set: { ...set, places: [{ ...set.places[0], offset: 1 }] } },
    { source, set: { ...set, places: [] } },
    { source, set, extra: true }
  ])('refuses malformed persisted source and payloads', (record) => {
    expect(() => parseWorkshopPersistedSession(saved((reply) => Object.assign(reply, { highlights: record })))).toThrow();
  });

  it('refuses webview-only fields, writer-owned records and arbitrary outcome reasons', () => {
    for (const patch of [
      { highlightSummary: { title: 'set', count: 2 } },
      { participant: 'writer', role: 'user', highlights: { source, set } },
      { trailerOutcomes: { highlights: { placed: 0, closed: 0, rejected: [], dropped: [{ reason: 'Private note', count: 1 }] } } }
    ]) {
      expect(() => parseWorkshopPersistedSession(saved((reply) => Object.assign(reply, patch)))).toThrow();
    }
  });
});
