/** @jest-environment jsdom */

/**
 * useWorkshopProjectMemory (ADR 2026-11-04 D6; Slice 3): each action posts
 * its route under a minted request id; only the answer to a request still
 * pending is taken, so a late answer never closes a sheet opened since; a
 * refusal keeps the writer's draft; the estimate is the host's. Nothing
 * persists. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopProjectMemory, workshopMemoryNoteFromTurn } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { MessageType, type WorkshopTurn } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const reply: WorkshopTurn = {
  id: 'turn-4-assistant-1008',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'Good.',
  timestamp: 1,
  memoryProposal: {
    title: 'The Rabbit\'s watch runs backward',
    kind: 'canon',
    summary: 'From chapter 3 on.',
    body: 'Settled at the tea party.',
    supersedes: [{ id: 'mem-1a9e04', title: 'The watch stops at six' }],
    state: 'pending'
  }
};

const result = (payload: Record<string, unknown>) => ({
  type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT, source: 'extension.workshop', payload, timestamp: 2
}) as never;

describe('useWorkshopProjectMemory', () => {
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

  it('a card\'s Save posts its action, marks the turn busy, and takes its answer', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.saveCard(reply.id));
    const [sent] = posted(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION);
    expect(sent.payload).toMatchObject({ turnId: reply.id, action: 'save', requestId: expect.any(String) });
    expect(hook.current.busyTurnIds.has(reply.id)).toBe(true);

    act(() => hook.current.handleWriteResult(result({ requestId: sent.payload.requestId, ok: false, error: 'No folder.' })));
    expect(hook.current.busyTurnIds.has(reply.id)).toBe(false);
    expect(hook.current.cardErrors.get(reply.id)).toBe('No folder.');
  });

  it('Edit… opens the sheet from the proposal, asks the host\'s estimate, and saves the edited version', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.editCard(reply));
    expect(hook.current.sheet).toMatchObject({ mode: 'card', draft: { title: 'The Rabbit\'s watch runs backward', supersedes: ['mem-1a9e04'], pinned: false } });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const [estimate] = posted(MessageType.WORKSHOP_MEMORY_ESTIMATE);
    act(() => hook.current.handleEstimateResult({
      type: MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT,
      source: 'extension.workshop',
      payload: { requestId: estimate.payload.requestId, estimate: { thisTokens: 60, totalTokens: 60, budgetTokens: 5_000, refused: false } },
      timestamp: 3
    } as never));
    expect(hook.current.sheet?.estimate?.thisTokens).toBe(60);

    act(() => hook.current.updateDraft({ title: 'The watch runs backward' }));
    act(() => hook.current.submitSheet());
    const [save] = posted(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION);
    expect(save.payload).toMatchObject({ action: 'save', turnId: reply.id, edited: { title: 'The watch runs backward' } });
    expect(hook.current.sheet?.saving).toBe(true);

    act(() => hook.current.handleWriteResult(result({ requestId: save.payload.requestId, ok: true, memoryId: 'mem-7f3c2a' })));
    expect(hook.current.sheet).toBeNull();
  });

  it('a refusal keeps the draft and shows why, with the budget\'s numbers', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.newMemory());
    act(() => hook.current.updateDraft({ title: 'Tea at six', summary: 'Always.', pinned: true }));
    act(() => hook.current.submitSheet());
    const [create] = posted(MessageType.WORKSHOP_MEMORY_CREATE);
    act(() => hook.current.handleWriteResult(result({
      requestId: create.payload.requestId, ok: false, error: 'Can\'t save this.', budget: { thisTokens: 900, totalTokens: 5_400, budgetTokens: 5_000, refused: true }
    })));
    expect(hook.current.sheet).toMatchObject({ saving: false, error: 'Can\'t save this.', draft: { title: 'Tea at six' }, estimate: { refused: true } });
  });

  it('a late answer to an earlier sheet never closes the sheet opened since', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.newMemory());
    act(() => hook.current.updateDraft({ title: 'First', summary: 'S' }));
    act(() => hook.current.submitSheet());
    const [first] = posted(MessageType.WORKSHOP_MEMORY_CREATE);
    act(() => hook.current.closeSheet());
    act(() => hook.current.saveTurn(reply));
    act(() => hook.current.handleWriteResult(result({ requestId: first.payload.requestId, ok: true, memoryId: 'mem-7f3c2a' })));
    expect(hook.current.sheet).toMatchObject({ mode: 'turn', turnId: reply.id, draft: { body: 'Good.' } });
  });

  it('Edit on a receipt asks for the memory and fills the sheet from the host\'s answer only', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.editMemory('mem-7f3c2a'));
    expect(hook.current.sheet).toMatchObject({ mode: 'memory', loading: true });
    const [request] = posted(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT);
    const edit = (requestId: unknown) => ({
      type: MessageType.WORKSHOP_MEMORY_EDIT_DATA,
      source: 'extension.workshop',
      payload: { requestId, memoryId: 'mem-7f3c2a', draft: { title: 'T', kind: 'canon', summary: 'S', body: 'B', supersedes: [], pinned: true }, replaces: [] },
      timestamp: 4
    } as never);
    act(() => hook.current.handleEditData(edit('someone-else')));
    expect(hook.current.sheet?.loading).toBe(true);
    act(() => hook.current.handleEditData(edit(request.payload.requestId)));
    expect(hook.current.sheet).toMatchObject({ loading: false, draft: { title: 'T', pinned: true } });
    act(() => hook.current.submitSheet());
    expect(posted(MessageType.WORKSHOP_MEMORY_UPDATE)[0].payload).toMatchObject({ memoryId: 'mem-7f3c2a', patch: { title: 'T' } });
  });

  it('Forget and Restore post the receipt route', () => {
    const { result: hook } = renderHook(() => useWorkshopProjectMemory());
    act(() => hook.current.forget('mem-7f3c2a'));
    act(() => hook.current.restore('mem-7f3c2a'));
    expect(posted(MessageType.WORKSHOP_MEMORY_FORGET).map((message) => message.payload.action)).toEqual(['forget', 'restore']);
    expect(hook.current.persistedState).toEqual({});
  });

  it('a bubble\'s note is its text, cut at the body\'s bound', () => {
    expect(workshopMemoryNoteFromTurn('  Short.  ')).toBe('Short.');
    expect(workshopMemoryNoteFromTurn('a'.repeat(9_000))).toHaveLength(8_000);
  });
});
