import { createWorkshopRouteTestHarness, analysisResult } from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';
import type { WorkshopHighlightsDraft } from '@/utils/workshopReplyHighlights';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy, type WorkshopRunCompletionInput } from '@/application/services/workshop/WorkshopRunCompletion';
import { authorizeWorkshopReplyHighlights } from '@/application/services/workshop/highlights/WorkshopReplyHighlights';
import type { WorkshopHighlightCounts } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { parseWorkshopPersistedSession, decodeWorkshopPersistedSessionCheckpoint } from '@/application/services/workshop/WorkshopPersistedSession';
import { MessageType, type WorkshopExcerptSource, type WorkshopTurn } from '@messages';

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
  const prepare = () => authorizeWorkshopReplyHighlights(frame, requestId, session.readRoomRevision(), excerpt,
    { authorizeExcerptReread }, { showOpen, show: jest.fn(), clear: jest.fn(), retain: jest.fn() }, controller.signal);
  const complete = (extra: Partial<WorkshopRunCompletionInput>, content = frame) => completeWorkshopRun({
    session, requestId, label: 'Jill',
    result: { toolName: 'workshop-test', content, conversationId: 'host-conversation', timestamp: new Date(0) },
    aborted: false, createsRetainedConversation: true, copy: workshopMessageCompletionCopy('Jill'), log,
    discardConversation: jest.fn(), readRetainedHistory: () => ({ messageCount: 2, contextSourceCount: 0 }),
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() },
    ...extra
  });
  return { session, authorizeExcerptReread, showOpen, prepare, complete, log, controller };
}

describe('highlights on a writer-directed Workshop reply', () => {
  it('sends a composer message through the real room, authorizes the captured file and posts only the summary', async () => {
    const showOpen = jest.fn(() => counts);
    const harness = createWorkshopRouteTestHarness({ workshopHighlights: { showOpen, show: jest.fn(), retain: jest.fn(), clear: jest.fn() } });
    const path = 'Characters/raven.md';
    await harness.router.route({ type: MessageType.WORKSHOP_SET_EXCERPT, timestamp: 0, source: 'webview.workshop', payload: {
      text: 'Raven looks at the token.', source: { kind: 'editor-selection', sourceUri: `file:///ws/${path}`, relativePath: path }
    } });
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult(frame, { conversationId: 'host-conv' }));
    await harness.handler.handleSendMessage({
      type: MessageType.WORKSHOP_SEND_MESSAGE, source: 'webview.workshop', timestamp: 1, payload: { text: 'Marca esos pasajes.' }
    });
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(showOpen).toHaveBeenCalledWith(reply.id, `/ws/${path}`, 'Jill', set);
    expect(reply.highlights?.set).toEqual(set);
    expect(JSON.stringify(harness.postMessage.mock.calls)).toContain('highlightSummary');
    expect(JSON.stringify(harness.postMessage.mock.calls)).not.toMatch(/Private quote|Private note/);
    harness.handler.dispose();
  });

  it('keeps the chip on a mixed reaction and highlights reply', async () => {
    const { prepare, complete, session } = room();
    const mixed = `<prose-minion-reaction>heart</prose-minion-reaction>\n${frame}`;
    const turn = complete({ highlights: await prepare(), reactionsOpen: true }, mixed)!;
    expect(turn.reactionOnly).toBeUndefined();
    expect(turn.highlights?.set).toEqual(set);
    expect(turn.content).toContain('requested highlights');
    expect(session.readRoomReactions()).toHaveLength(1);
  });

  it.each<WorkshopExcerptSource['kind']>(['file', 'editor-selection'])('binds a %s source, draws after adoption and returns only counts', async (kind) => {
    const { session, prepare, complete, showOpen, authorizeExcerptReread, log } = room({ kind: kind as 'file' | 'editor-selection', ...source });
    const turn = complete({ highlights: await prepare() })!;
    expect(authorizeExcerptReread).toHaveBeenCalledWith({ kind: 'file', ...source });
    expect(showOpen).toHaveBeenCalledWith(turn.id, '/chapters/private.md', turn.personaLabel, set);
    expect(turn.content).toBe('Requested highlights.');
    expect(turn.highlights).toEqual({ source, set });
    const view = workshopTurnForWebview(turn);
    expect(view.highlightSummary).toEqual({ title: set.title, count: 2 });
    expect(JSON.stringify(view)).not.toMatch(/private\.md|Private quote|Private note|trailerOutcomes/);
    const outcomes = workshopTrailerOutcomesFrameFor(session.readRoomLedger(), { kind: 'host' });
    expect(outcomes).toContain('1 placed, 1 dropped (ambiguous)');
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Example', exportedAt: 42 });
    expect(transcript.entries.filter((entry) => entry.kind === 'event' && entry.text === 'Requested 2 highlights.')).toHaveLength(1);
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
      const target = state === 'no-target' ? undefined : await prepare();
      if (state === 'stale-room') { session.invalidatePendingRoomReads(); }
      const highlights = target && { ...target,
        requestId: state === 'different-request' ? 'another-run' : target.requestId,
        excerptVersion: state === 'stale-excerpt' ? target.excerptVersion + 1 : target.excerptVersion };
      const turn = complete({ highlights }, `A reply.\n${frame}`)!;
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
