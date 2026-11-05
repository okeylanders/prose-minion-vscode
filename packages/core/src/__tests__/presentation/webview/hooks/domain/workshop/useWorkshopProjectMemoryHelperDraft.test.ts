/** @jest-environment jsdom */

/**
 * The helper's draft in the memory sheet, as useWorkshopProjectMemory asks
 * for it and takes it (ADR 2026-11-05 D5; Helper Agent Slice 2):
 *
 * - a sheet opened from a turn asks by ids, never with text; a card's
 *   Edit…, a saved memory's edit and New ask nothing;
 * - only the answer to the open sheet's own request is taken: a late one,
 *   another sheet's, or one for a sheet closed or reopened since is not;
 * - fields the writer touched are kept, and the body never changes;
 * - any outcome but a draft leaves the fields as they were, with the quiet
 *   line; `off`, and the setting off, are silence (D5.7);
 * - Close, Save, another opening and unmount stop a draft still out
 *   (A-05), and a live request names its room (A-02). *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopProjectMemory } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { MessageType, type WorkshopMemoryDraftOutcome, type WorkshopTurn, type WorkshopTurnPreview } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const turn: WorkshopTurn = {
  id: 'turn-4-assistant-1008',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'The Cheshire Cat fades until only its grin is left.',
  timestamp: 1,
  memoryProposals: [{
    proposes: 'new', title: 'The grin stays', kind: 'canon', summary: 'The grin outlasts the Cat.', body: '', supersedes: [], state: 'pending'
  }]
};
const other: WorkshopTurn = { ...turn, id: 'turn-6-assistant-1010', content: 'The Duchess sneezes.', memoryProposals: undefined };
const saved: WorkshopTurnPreview = { kind: 'reply', speaker: 'Jill', content: 'The baby turns into a pig.', timestamp: 2 };
const DRAFT = { title: 'The grin outlasts the Cat', summary: 'The Cheshire Cat fades until only its grin is left.', kind: 'theme' as const };

const answer = (requestId: unknown, outcome: WorkshopMemoryDraftOutcome = 'drafted') => ({
  type: MessageType.WORKSHOP_MEMORY_DRAFT_RESULT,
  source: 'extension.workshop',
  payload: { requestId, outcome, ...(outcome === 'drafted' ? { draft: DRAFT } : {}) },
  timestamp: 9
}) as never;

describe('useWorkshopProjectMemory — the helper\'s draft', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const postedOf = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type)
    .map((message) => message.payload);
  const requests = () => postedOf(MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST);
  const cancels = () => postedOf(MessageType.WORKSHOP_MEMORY_DRAFT_CANCEL);
  const setting = (enabled: boolean) => ({
    type: MessageType.WORKSHOP_MEMORY_DRAFTS_SETTING, source: 'extension.workshop', payload: { enabled }, timestamp: 8
  }) as never;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('Save to memory… asks by the turn\'s id alone, shows it drafting, and fills the title, summary and kind', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));

    expect(requests()).toEqual([{ requestId: expect.any(String), turnId: turn.id }]);
    expect(hook.current.sheet?.helper).toMatchObject({ status: 'drafting', touched: [] });
    expect(hook.current.sheet?.draft).toMatchObject({ title: '', summary: '' });

    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    expect(hook.current.sheet?.draft).toMatchObject({ ...DRAFT, body: turn.content });
    expect(hook.current.sheet?.helper?.status).toBe('filled');
  });

  it('keeps every field the writer touched first, and never changes the body', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.updateDraft({ title: 'Alice\'s own title' }));
    act(() => hook.current.updateDraft({ kind: 'decision' }));
    act(() => hook.current.updateDraft({ body: 'Alice trimmed the note.' }));

    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    expect(hook.current.sheet?.draft).toMatchObject({
      title: 'Alice\'s own title',
      kind: 'decision',
      summary: DRAFT.summary,
      body: 'Alice trimmed the note.'
    });
  });

  it('keeps a field the writer emptied again: touching it is enough', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.updateDraft({ summary: 'A' }));
    act(() => hook.current.updateDraft({ summary: '' }));
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    expect(hook.current.sheet?.draft).toMatchObject({ title: DRAFT.title, summary: '' });
  });

  it('takes only the open sheet\'s own answer: never another request\'s, a late one, or one for a sheet reopened since', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    const first = requests()[0].requestId;
    act(() => hook.current.closeSheet());
    act(() => hook.current.handleMemoryDraftResult(answer(first)));
    expect(hook.current.sheet).toBeNull();

    // Reopened on the same turn: a new request, and the first's answer is not this sheet's.
    act(() => hook.current.saveTurn(turn));
    const second = requests()[1].requestId;
    expect(second).not.toBe(first);
    act(() => hook.current.handleMemoryDraftResult(answer(first)));
    act(() => hook.current.handleMemoryDraftResult(answer('ws-memory-someone-else-1')));
    expect(hook.current.sheet?.draft.title).toBe('');
    expect(hook.current.sheet?.helper?.status).toBe('drafting');

    // Another turn's sheet replaces it; the second's answer lands late.
    act(() => hook.current.closeSheet());
    act(() => hook.current.saveTurn(other));
    act(() => hook.current.handleMemoryDraftResult(answer(second)));
    expect(hook.current.sheet?.turnId).toBe(other.id);
    expect(hook.current.sheet?.draft.title).toBe('');

    // Its own answer, then the same answer again: taken once.
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[2].requestId)));
    act(() => hook.current.updateDraft({ title: 'Alice decides' }));
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[2].requestId)));
    expect(hook.current.sheet?.draft.title).toBe('Alice decides');
  });

  it.each(['unconfigured', 'refused', 'failed', 'malformed'] as const)(
    'leaves the sheet as it was on %s, with the quiet line',
    (outcome) => {
      const { result: hook } = renderHook(() => useWorkshopProjectMemory());
      act(() => hook.current.saveTurn(turn));
      act(() => hook.current.updateDraft({ summary: 'Alice wrote this' }));
      const before = hook.current.sheet!.draft;
      act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId, outcome)));
      expect(hook.current.sheet?.draft).toEqual(before);
      expect(hook.current.sheet?.helper?.status).toBe('failed');
    }
  );

  it('reads an `off` answer (the setting changed meanwhile) as silence: no line', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId, 'off')));
    expect(hook.current.sheet?.helper?.status).toBe('stopped');
    expect(hook.current.sheet?.draft).toMatchObject({ title: '', summary: '' });
  });

  it('Save freezes the fields: it stops the draft, tells the host, and a late answer changes nothing (A-02)', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    const asked = requests()[0].requestId;
    act(() => hook.current.updateDraft({ title: 'Alice saves first', summary: 'Before the draft.' }));
    act(() => hook.current.submitSheet());
    expect(hook.current.sheet?.saving).toBe(true);
    expect(hook.current.sheet?.helper?.status).toBe('stopped');
    expect(cancels()).toEqual([{ requestId: asked }]);
    const submitted = postedOf(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY)[0].draft;
    act(() => hook.current.handleMemoryDraftResult(answer(asked)));
    expect(hook.current.sheet?.draft).toEqual(submitted);
  });

  it('a successful Save closes the sheet; its late answer changes nothing', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    const asked = requests()[0].requestId;
    act(() => hook.current.updateDraft({ title: 'Alice saves', summary: 'Saved.' }));
    act(() => hook.current.submitSheet());
    const saveId = postedOf(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY)[0].requestId;
    act(() => hook.current.handleWriteResult({
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT, source: 'extension.workshop', payload: { requestId: saveId, ok: true }, timestamp: 3
    } as never));
    expect(hook.current.sheet).toBeNull();
    act(() => hook.current.handleMemoryDraftResult(answer(asked)));
    expect(hook.current.sheet).toBeNull();
  });

  it('stops a draft still out on Close, on another opening, on a switch to New, and on unmount (A-05)', () => {
    const { result: hook, unmount } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.closeSheet());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.saveTurn(other));
    act(() => hook.current.newMemory());
    act(() => hook.current.saveTurn(turn));
    unmount();
    const asked = requests().map((request) => request.requestId);
    expect(asked).toHaveLength(4);
    expect(new Set(asked).size).toBe(4);
    expect(cancels().map((cancel) => cancel.requestId)).toEqual(asked);
  });

  it('stops nothing that already answered', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    act(() => hook.current.closeSheet());
    expect(cancels()).toEqual([]);
  });

  it('asks the host whether drafting is on once mounted; off, a sheet asks for nothing and shows nothing (D5.7)', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    expect(postedOf(MessageType.WORKSHOP_REQUEST_MEMORY_DRAFTS_SETTING)).toHaveLength(1);
    act(() => hook.current.handleMemoryDraftsSetting(setting(false)));
    act(() => hook.current.saveTurn(turn));
    act(() => hook.current.closeSheet());
    act(() => hook.current.rememberSavedBookmark({ sessionId: 'saved-alice', sessionTitle: 'Down the hole', turnId: turn.id, message: saved }));
    expect(requests()).toEqual([]);
    expect(cancels()).toEqual([]);
    expect(hook.current.sheet?.helper).toBeUndefined();

    // Turned back on, the next opening asks again.
    act(() => hook.current.closeSheet());
    act(() => hook.current.handleMemoryDraftsSetting(setting(true)));
    act(() => hook.current.saveTurn(turn));
    expect(requests()).toHaveLength(1);
  });

  it('names the open room on a live turn\'s request, and the bookmark\'s own room outside the window (A-02)', () => {
    const { result: hook, rerender } = renderHook(({ roomRevision }) => useWorkshopProjectMemory({ roomRevision }), { initialProps: { roomRevision: 3 } });
    act(() => hook.current.saveTurn(turn));
    expect(requests()[0]).toEqual({ requestId: expect.any(String), turnId: turn.id, roomRevision: 3 });
    act(() => hook.current.closeSheet());
    rerender({ roomRevision: 4 });
    act(() => hook.current.saveTurn(turn));
    expect(requests()[1].roomRevision).toBe(4);
    act(() => hook.current.closeSheet());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 2, message: saved }));
    expect(requests()[2].roomRevision).toBe(2);
  });

  it('applies the answer to the sheet as it is when it lands: typing in the same moment wins (A-03)', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    act(() => {
      hook.current.updateDraft({ title: 'Alice types' });
      hook.current.handleMemoryDraftResult(answer(requests()[0].requestId));
    });
    expect(hook.current.sheet?.draft).toMatchObject({ title: 'Alice types', summary: DRAFT.summary, kind: DRAFT.kind });
  });

  it('counts a kind set back to its default as touched, and changes no supersession, pin or source (A-03)', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveTurn(turn));
    const before = hook.current.sheet!;
    act(() => hook.current.updateDraft({ kind: 'idea' }));
    act(() => hook.current.updateDraft({ kind: before.draft.kind }));
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    const after = hook.current.sheet!;
    expect(after.draft.kind).toBe(before.draft.kind);
    expect(after.helper?.touched).toEqual(['kind']);
    expect({ supersedes: after.draft.supersedes, pinned: after.draft.pinned, turnId: after.turnId, mode: after.mode, sourceLabel: after.sourceLabel })
      .toEqual({ supersedes: before.draft.supersedes, pinned: before.draft.pinned, turnId: before.turnId, mode: before.mode, sourceLabel: before.sourceLabel });
  });

  it('a card\'s Edit…, a saved memory\'s edit and New ask for nothing', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.editCard(turn, 0));
    expect(hook.current.sheet?.helper).toBeUndefined();
    act(() => hook.current.closeSheet());
    act(() => hook.current.editMemory('mem-1a9e04'));
    act(() => hook.current.closeSheet());
    act(() => hook.current.newMemory());
    expect(requests()).toEqual([]);
  });

  it('Remember this on a saved session\'s bookmark asks by session and turn', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberSavedBookmark({ sessionId: 'saved-alice', sessionTitle: 'Down the hole', turnId: turn.id, message: saved }));
    expect(requests()).toEqual([{ requestId: expect.any(String), turnId: turn.id, sessionId: 'saved-alice' }]);
    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    expect(hook.current.sheet?.draft).toMatchObject({ ...DRAFT, body: saved.content });
  });

  it('a room bookmark outside the window asks by its room, and the preview that lands later keeps the draft', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 7 }));
    expect(requests()).toEqual([{ requestId: expect.any(String), turnId: turn.id, roomRevision: 7 }]);
    const preview = vscode.postMessage.mock.calls
      .map(([message]: [{ type: MessageType; payload: { requestId: string } }]) => message)
      .find((message) => message.type === MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    expect(preview).toBeDefined();

    act(() => hook.current.handleMemoryDraftResult(answer(requests()[0].requestId)));
    act(() => hook.current.handleTurnPreview({
      type: MessageType.WORKSHOP_TURN_PREVIEW,
      source: 'extension.workshop',
      payload: { requestId: preview!.payload.requestId, turnId: turn.id, roomRevision: 7, turn: saved },
      timestamp: 10
    } as never));
    expect(hook.current.sheet).toMatchObject({ loading: false, draft: { ...DRAFT, body: saved.content } });
  });
});
