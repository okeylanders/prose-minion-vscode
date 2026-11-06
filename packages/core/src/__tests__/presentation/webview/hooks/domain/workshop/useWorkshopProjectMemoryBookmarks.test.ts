/** @jest-environment jsdom */

/**
 * "Remember this" on a bookmark, as useWorkshopProjectMemory opens and
 * saves it (Bookmark Recall Slice 3; ADR 2026-11-05 D9):
 *
 * - a room bookmark in the window is Save to memory… on its turn, unchanged;
 * - one outside it prefills from the host's message (the row's, or a turn
 *   preview the hook asks for) and saves naming its room;
 * - a saved session's bookmark opens `saved-turn` and saves by session and
 *   turn through its own route;
 * - every answer is correlated by request id. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopProjectMemory } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { MessageType, type WorkshopTurn, type WorkshopTurnPreview } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
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
  content: 'The grin stays after the Cat goes.',
  timestamp: 1
};

const reply: WorkshopTurnPreview = { kind: 'reply', speaker: 'Jill', content: '  The baby turns into a pig.  ', timestamp: 2 };
const writer: WorkshopTurnPreview = { kind: 'writer', speaker: 'You', content: 'Keep the pig.', timestamp: 3 };

const envelope = (type: MessageType, payload: Record<string, unknown>) => ({ type, source: 'extension.workshop', payload, timestamp: 9 }) as never;

describe('useWorkshopProjectMemory — Remember this on a bookmark', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('a room bookmark in the window is Save to memory… on its turn, unchanged', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 3, turn }));
    expect(hook.current.sheet).toMatchObject({ mode: 'turn', turnId: turn.id, sourceLabel: 'Jill', draft: { body: turn.content } });
    expect(hook.current.sheet?.roomRevision).toBeUndefined();

    act(() => hook.current.updateDraft({ title: 'The grin', summary: 'It stays.' }));
    act(() => hook.current.submitSheet());
    const [sent] = posted(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY);
    expect(sent.payload).not.toHaveProperty('roomRevision');
    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toEqual([]);
  });

  it('a room bookmark outside the window prefills from the row\'s message and saves naming its room', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 3, message: reply }));
    expect(hook.current.sheet).toMatchObject({
      mode: 'turn', turnId: turn.id, roomRevision: 3, loading: false, sourceLabel: 'Jill', draft: { body: 'The baby turns into a pig.' }
    });

    act(() => hook.current.updateDraft({ title: 'The pig', summary: 'The baby is a pig.' }));
    act(() => hook.current.submitSheet());
    const [sent] = posted(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY);
    expect(sent.payload).toMatchObject({ turnId: turn.id, roomRevision: 3, draft: { title: 'The pig', body: 'The baby turns into a pig.' } });

    act(() => hook.current.handleWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: sent.payload.requestId, ok: true, memoryId: 'mem-0000c1' })));
    expect(hook.current.sheet).toBeNull();
  });

  it('a Notes row outside the window asks the host for its message, and takes only its own answer', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 3 }));
    expect(hook.current.sheet).toMatchObject({ mode: 'turn', loading: true, roomRevision: 3 });
    const [asked] = posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    expect(asked.payload).toEqual({ requestId: expect.any(String), turnId: turn.id, roomRevision: 3 });

    // Another request's answer, and one for another room, change nothing.
    act(() => hook.current.handleTurnPreview(envelope(MessageType.WORKSHOP_TURN_PREVIEW, { requestId: 'someone-else', turnId: turn.id, roomRevision: 3, turn: writer })));
    act(() => hook.current.handleTurnPreview(envelope(MessageType.WORKSHOP_TURN_PREVIEW, { requestId: asked.payload.requestId, turnId: turn.id, roomRevision: 4, turn: writer })));
    expect(hook.current.sheet).toMatchObject({ loading: true, draft: { body: '' } });

    act(() => hook.current.handleTurnPreview(envelope(MessageType.WORKSHOP_TURN_PREVIEW, { requestId: asked.payload.requestId, turnId: turn.id, roomRevision: 3, turn: writer })));
    expect(hook.current.sheet).toMatchObject({ loading: false, sourceLabel: 'your message', draft: { body: 'Keep the pig.' } });
  });

  it('a refused preview leaves the sheet with the host\'s reason', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 3 }));
    const [asked] = posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    act(() => hook.current.handleTurnPreview(envelope(MessageType.WORKSHOP_TURN_PREVIEW, {
      requestId: asked.payload.requestId, turnId: turn.id, roomRevision: 3, error: 'The room changed.'
    })));
    expect(hook.current.sheet).toMatchObject({ loading: false, error: 'The room changed.' });
  });

  it('a late preview for a sheet closed since changes nothing', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.rememberRoomBookmark({ turnId: turn.id, roomRevision: 3 }));
    const [asked] = posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    act(() => hook.current.closeSheet());
    act(() => hook.current.newMemory());
    act(() => hook.current.handleTurnPreview(envelope(MessageType.WORKSHOP_TURN_PREVIEW, { requestId: asked.payload.requestId, turnId: turn.id, roomRevision: 3, turn: writer })));
    expect(hook.current.sheet).toMatchObject({ mode: 'new', draft: { body: '' } });
  });

  it('a saved session\'s bookmark opens saved-turn, prefilled and capped, and saves by session and turn', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    const long: WorkshopTurnPreview = { ...reply, content: 'a'.repeat(PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters + 50) };
    act(() => hook.current.rememberSavedBookmark({ sessionId: 'saved-0042', sessionTitle: 'The Duchess\'s kitchen', turnId: 'turn-7-assistant-1', message: long }));
    expect(hook.current.sheet).toMatchObject({
      mode: 'saved-turn', sessionId: 'saved-0042', sessionTitle: 'The Duchess\'s kitchen', turnId: 'turn-7-assistant-1', sourceLabel: 'Jill'
    });
    expect(hook.current.sheet?.draft.body).toHaveLength(PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters);

    act(() => hook.current.updateDraft({ title: 'The pig', summary: 'The baby is a pig.', body: 'Short.' }));
    act(() => hook.current.submitSheet());
    const [sent] = posted(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY);
    expect(sent.payload).toEqual({
      requestId: expect.any(String),
      sessionId: 'saved-0042',
      turnId: 'turn-7-assistant-1',
      draft: expect.objectContaining({ title: 'The pig', body: 'Short.' })
    });
    expect(hook.current.sheet?.saving).toBe(true);

    // Another request's answer is not this sheet's; its own refusal keeps the draft.
    act(() => hook.current.handleWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: 'other', ok: true })));
    expect(hook.current.sheet?.saving).toBe(true);
    act(() => hook.current.handleWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, {
      requestId: sent.payload.requestId, ok: false, error: 'That message is no longer in its saved session.'
    })));
    expect(hook.current.sheet).toMatchObject({ saving: false, error: 'That message is no longer in its saved session.', draft: { title: 'The pig' } });
  });
});
