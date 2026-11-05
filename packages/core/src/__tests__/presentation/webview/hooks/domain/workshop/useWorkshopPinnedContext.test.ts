/** @jest-environment jsdom */

/**
 * useWorkshopPinnedContext (Pinned Context Slice 3): the list is asked for
 * at mount; only the answer to the request waiting is taken, and a push
 * only while none waits; every change names the revision on screen; "In
 * this conversation" and the missing count follow the room's attachments;
 * the template well's open state is the one thing persisted. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopPinnedContext } from '@hooks/domain/workshop/useWorkshopPinnedContext';
import { MessageType, type WorkshopContextAttachmentSnapshot, type WorkshopPinnedContextPayload } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

function answer(requestId: string | null, overrides: Partial<WorkshopPinnedContextPayload> = {}): WorkshopPinnedContextPayload {
  return {
    requestId,
    platform: 'posix',
    availability: { available: true },
    file: { state: 'ok' },
    revision: 'rev-1',
    entries: [
      { path: 'Characters/alice.md', label: 'alice.md', group: 'characters', words: 3400, state: 'ready' },
      { path: 'Project/brief.md', label: 'brief.md', words: 1850, state: 'ready' }
    ],
    totals: { words: 5250, budgetWords: 100_000, files: 2, maxFiles: 20 },
    ...overrides
  };
}

const message = (payload: WorkshopPinnedContextPayload) =>
  ({ type: MessageType.WORKSHOP_PINNED_CONTEXT, source: 'extension.workshop', payload, timestamp: 1 }) as never;

const attachment = (id: string, relativePath: string): WorkshopContextAttachmentSnapshot => ({
  id,
  kind: 'file',
  origin: 'writer',
  label: relativePath.split('/').pop()!,
  words: 10,
  relativePath
} as WorkshopContextAttachmentSnapshot);

describe('useWorkshopPinnedContext', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posts = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([posted]: [{ type: MessageType; payload: Record<string, unknown> }]) => posted)
    .filter((posted) => posted.type === type);
  const lastId = (type: MessageType) => posts(type)[posts(type).length - 1].payload.requestId as string;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('asks for the list when it mounts, and the menu\'s count is 0 until the host answers', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    expect(posts(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)).toHaveLength(1);
    expect(result.current.pinnedFileCount).toBe(0);
    expect(result.current.pending).toBe(true);
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)))));
    expect(result.current.pinnedFileCount).toBe(2);
    expect(result.current.pending).toBe(false);
  });

  it('ignores a stale answer, and a push while a request waits', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    const first = lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT);
    act(() => result.current.requestList());
    const second = lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT);

    act(() => result.current.handlePinnedContext(message(answer(first, { revision: 'stale' }))));
    act(() => result.current.handlePinnedContext(message(answer(null, { revision: 'pushed' }))));
    expect(result.current.answer).toBeUndefined();

    act(() => result.current.handlePinnedContext(message(answer(second))));
    expect(result.current.answer?.revision).toBe('rev-1');

    act(() => result.current.handlePinnedContext(message(answer(null, { revision: 'pushed' }))));
    expect(result.current.answer?.revision).toBe('pushed');
  });

  it('names the revision on screen in every change, and none before the host answers', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    expect(result.current.unpin('Characters/alice.md')).toBeUndefined();
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)))));

    act(() => { result.current.unpin('Characters/alice.md'); });
    act(() => { result.current.move('Project/brief.md', 'up'); });
    act(() => { result.current.pinResources([{ group: 'characters', path: 'Characters/the-hatter.md' }]); });
    act(() => { result.current.pinAttachments(['ctx-3']); });
    expect(posts(MessageType.WORKSHOP_UNPIN_CONTEXT)[0].payload).toMatchObject({ revision: 'rev-1', entryPath: 'Characters/alice.md' });
    expect(posts(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT)[0].payload).toMatchObject({ revision: 'rev-1', entryPath: 'Project/brief.md', direction: 'up' });
    expect(posts(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES)[0].payload).toMatchObject({ revision: 'rev-1', items: [{ group: 'characters', path: 'Characters/the-hatter.md' }] });
    expect(posts(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS)[0].payload).toMatchObject({ revision: 'rev-1', attachmentIds: ['ctx-3'] });
  });

  it('asks the host to pick a file without holding the tab, and takes the pick\'s answer when it comes', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)))));
    act(() => { result.current.pinPickedFile(); });
    const pick = posts(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE)[0].payload;
    expect(pick).toEqual({ requestId: expect.any(String), revision: 'rev-1' });
    expect(result.current.pending).toBe(false);

    act(() => result.current.handlePinnedContext(message(answer(pick.requestId as string, { revision: 'rev-2', action: 'pin-file', ok: true }))));
    expect(result.current.answer?.revision).toBe('rev-2');
  });

  it('derives "In this conversation" and the missing count from the room, and follows it', () => {
    const { result, rerender } = renderHook(
      ({ attachments }) => useWorkshopPinnedContext({ attachments, running: false }),
      { initialProps: { attachments: [attachment('ctx-1', 'Characters/alice.md'), attachment('ctx-2', 'Notes/garden.md')] } }
    );
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)))));

    expect(result.current.view.rows.map((row) => row.here)).toEqual([true, false]);
    expect(result.current.view.attachMissing.count).toBe(1);
    expect(result.current.view.pinAttached.ids).toEqual(['ctx-2']);

    rerender({ attachments: [attachment('ctx-1', 'Characters/alice.md'), attachment('ctx-4', 'Project/brief.md')] });
    expect(result.current.view.rows.map((row) => row.here)).toEqual([true, true]);
    expect(result.current.view.attachMissing.count).toBe(0);
    expect(result.current.view.pinAttached.ids).toEqual([]);
    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
  });

  it('persists only whether the template well is open, starting open, and restores it', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    expect(result.current.persistedState).toEqual({ pinnedContextNoteOpen: true });
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT)))));
    act(() => result.current.toggleNote());
    expect(result.current.noteOpen).toBe(false);
    expect(result.current.persistedState).toEqual({ pinnedContextNoteOpen: false });

    vscode.getState.mockReturnValue({ pinnedContextNoteOpen: false });
    const reloaded = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    expect(reloaded.result.current.noteOpen).toBe(false);
  });

  it.each(['older answer last', 'older answer first'] as const)(
    'orders overlapping changes by the store observation, not by reply order (%s; PR #210 F03)', (order) => {
      const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
      act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), { observation: 1 }))));
      let pick = '';
      let unpin = '';
      act(() => { pick = result.current.pinPickedFile()!; });
      act(() => { unpin = result.current.unpin('Characters/alice.md')!; });
      // The pick's list was read before the unpin committed (observation 2); the unpin's after (3).
      const stale = message(answer(pick, { observation: 2, action: 'pin-file', ok: true }));
      const fresh = message(answer(unpin, { observation: 3, revision: 'rev-2', action: 'unpin', ok: true, entries: [answer(null).entries[1]] }));
      const replies = order === 'older answer last' ? [fresh, stale] : [stale, fresh];
      replies.forEach((reply) => act(() => result.current.handlePinnedContext(reply)));

      expect(result.current.answer?.revision).toBe('rev-2');
      expect(result.current.pinnedFileCount).toBe(1);
      expect(result.current.pendingRequestIds).toEqual([]);
    });

  it('settles an older answer and shows its own outcome, over the newer list', () => {
    const { result } = renderHook(() => useWorkshopPinnedContext({ attachments: [], running: false }));
    act(() => result.current.handlePinnedContext(message(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), { observation: 5 }))));
    let pin = '';
    act(() => { pin = result.current.pinResources([{ group: 'characters', path: 'Characters/the-hatter.md' }])!; });
    act(() => result.current.handlePinnedContext(message(answer(pin, {
      observation: 4, revision: 'older', action: 'pin-resources', ok: false, notice: { kind: 'refused', text: 'Pinned context holds at most 20 files.' }
    }))));
    expect(result.current.answer).toMatchObject({ revision: 'rev-1', requestId: pin, ok: false, notice: { kind: 'refused', text: 'Pinned context holds at most 20 files.' } });
    expect(result.current.pending).toBe(false);
  });
});
