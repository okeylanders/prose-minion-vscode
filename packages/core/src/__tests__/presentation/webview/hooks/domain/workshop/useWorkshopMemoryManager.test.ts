/** @jest-environment jsdom */

/**
 * useWorkshopMemoryManager (epic Slice 4b): the listing is taken only for
 * the request still pending; each action posts its own route (the
 * manager's, or Slice 3's Forget and edit) under a minted id; only its own
 * answers are taken; a refused Always load in full lands on its row; a
 * rename reads the memory, then edits it; nothing persists. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopMemoryManager } from '@hooks/domain/workshop/useWorkshopMemoryManager';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { memoryEntry } from './memory/workshopMemoryFixtures';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const envelope = (type: MessageType, payload: Record<string, unknown>) => ({ type, source: 'extension.workshop', payload, timestamp: 2 }) as never;
const LISTED = memoryEntry({ entryKey: 'key-watch', id: 'mem-7f3c21', title: 'The Rabbit’s watch runs backward' });

describe('useWorkshopMemoryManager', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);
  const lastId = (type: MessageType) => posted(type)[posted(type).length - 1].payload.requestId as string;
  const listing = (requestId: string, memories = [LISTED]) => envelope(MessageType.WORKSHOP_MEMORY_LISTING, {
    requestId, workspace: { kind: 'available' }, saved: memories.length, memories, unreadable: [], conflicts: []
  });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('takes only the listing still pending: a late answer never replaces a newer one', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.requestListing());
    const first = lastId(MessageType.WORKSHOP_MEMORY_LIST);
    act(() => result.current.requestListing());
    const second = lastId(MessageType.WORKSHOP_MEMORY_LIST);
    act(() => result.current.handleListing(listing(second, [])));
    expect(result.current.listing?.memories).toEqual([]);
    act(() => result.current.handleListing(listing(first)));
    expect(result.current.listing?.memories).toEqual([]);
    expect(result.current.listingPending).toBe(false);
    expect(result.current.persistedState).toEqual({});
  });

  it('the manager asks with its query; the tab, closed manager, asks with none', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.openManager());
    act(() => result.current.setQuery('rabbit'));
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST).map((entry) => entry.payload.query)).toEqual(['', 'rabbit']);
    act(() => result.current.closeManager());
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST).map((entry) => entry.payload.query)).toEqual(['', 'rabbit', '']);
    expect(result.current.managerOpen).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('each action posts its own route under its own id, and a landed write lists again', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.openManager());
    act(() => result.current.handleListing(listing(lastId(MessageType.WORKSHOP_MEMORY_LIST))));

    act(() => result.current.toggleLoadInFull('mem-7f3c21', true));
    act(() => result.current.remove('mem-7f3c21'));
    act(() => result.current.openFile('key-watch'));
    act(() => result.current.openFolder());
    expect(posted(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION).map((entry) => {
      const { requestId: _requestId, ...rest } = entry.payload;
      return rest;
    })).toEqual([
      { action: 'set-load-in-full', memoryId: 'mem-7f3c21', loadInFull: true },
      { action: 'delete', memoryId: 'mem-7f3c21' },
      { action: 'open-file', entryKey: 'key-watch' },
      { action: 'open-folder' }
    ]);
    act(() => result.current.archive('mem-7f3c21'));
    act(() => result.current.restore('mem-7f3c21'));
    expect(posted(MessageType.WORKSHOP_MEMORY_FORGET).map((entry) => entry.payload.action)).toEqual(['forget', 'restore']);
    expect(result.current.actionPending).toBe(true);

    const lists = posted(MessageType.WORKSHOP_MEMORY_LIST).length;
    const [toggle] = posted(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION);
    act(() => result.current.handleManagerResult(envelope(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT, { requestId: toggle.payload.requestId, ok: true })));
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(lists + 1);
    const [forget] = posted(MessageType.WORKSHOP_MEMORY_FORGET);
    act(() => result.current.noteWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: forget.payload.requestId, ok: false, error: 'Another VS Code window is editing that memory.' })));
    expect(result.current.actionError).toBe('Another VS Code window is editing that memory.');
  });

  it('a refused Always load in full lands on its row with the total it would have made', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.openManager());
    act(() => result.current.handleListing(listing(lastId(MessageType.WORKSHOP_MEMORY_LIST))));
    act(() => result.current.toggleLoadInFull('mem-7f3c21', true));
    act(() => result.current.handleManagerResult(envelope(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT, {
      requestId: lastId(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION),
      ok: false,
      error: 'Can’t load this one in full.',
      budget: { thisTokens: 300, totalTokens: 5_080, budgetTokens: 5_000, refused: true }
    })));
    expect(result.current.refusal).toEqual({ entryKey: 'key-watch', wouldBeTokens: 5_080 });
    expect(result.current.actionError).toBeUndefined();
  });

  it('ignores answers it never asked for', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.handleManagerResult(envelope(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT, { requestId: 'other', ok: false, error: 'x' })));
    act(() => result.current.noteWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: 'sheet-1', ok: true })));
    act(() => result.current.noteEditData(envelope(MessageType.WORKSHOP_MEMORY_EDIT_DATA, { requestId: 'sheet-2', memoryId: 'mem-7f3c21' })));
    expect(result.current.actionError).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(0);
    expect(posted(MessageType.WORKSHOP_MEMORY_UPDATE)).toHaveLength(0);
  });

  it('a sheet write that lands while the manager is open lists again', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.openManager());
    act(() => result.current.noteWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: 'sheet-1', ok: true })));
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(2);
  });

  it('a rename reads the memory, then edits it with the new title and everything else as read', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.rename('mem-7f3c21', 'The Rabbit’s watch always runs backward'));
    const read = lastId(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT);
    const draft = { title: 'The Rabbit’s watch runs backward', kind: 'canon', summary: 'From chapter 3 on.', body: 'Settled.', supersedes: ['mem-1a9e04'], pinned: true };
    act(() => result.current.noteEditData(envelope(MessageType.WORKSHOP_MEMORY_EDIT_DATA, { requestId: read, memoryId: 'mem-7f3c21', draft })));
    expect(posted(MessageType.WORKSHOP_MEMORY_UPDATE).map((entry) => entry.payload)).toEqual([
      expect.objectContaining({ memoryId: 'mem-7f3c21', patch: { ...draft, title: 'The Rabbit’s watch always runs backward' } })
    ]);
  });

  it('a rename whose read is refused says why and edits nothing', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.rename('mem-7f3c21', 'New title'));
    act(() => result.current.noteEditData(envelope(MessageType.WORKSHOP_MEMORY_EDIT_DATA, {
      requestId: lastId(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT), memoryId: 'mem-7f3c21', error: 'That memory is no longer in the folder.'
    })));
    expect(posted(MessageType.WORKSHOP_MEMORY_UPDATE)).toHaveLength(0);
    expect(result.current.actionError).toBe('That memory is no longer in the folder.');
    expect(result.current.actionPending).toBe(false);
  });

  it('Open memory folder: only the newest press says how it went, and closing the settings clears its error (PR #202 F04)', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.setSettingsVisible(true));
    act(() => result.current.openFolder());
    const first = lastId(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION);
    act(() => result.current.openFolder());
    const second = lastId(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION);
    act(() => result.current.handleManagerResult(envelope(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT, { requestId: first, ok: false, error: 'Old.' })));
    expect(result.current.folder).toEqual({ pending: true });
    act(() => result.current.handleManagerResult(envelope(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT, { requestId: second, ok: false, error: 'The memory folder couldn’t be opened.' })));
    expect(result.current.folder).toEqual({ pending: false, error: 'The memory folder couldn’t be opened.' });
    // Pressed from the settings, the manager closed: its own alert stays empty.
    expect(result.current.actionError).toBeUndefined();
    act(() => result.current.setSettingsVisible(false));
    expect(result.current.folder).toEqual({ pending: false });
  });

  it('another hook’s write refreshes the listing only while the manager or the settings show it (PR #202 N01)', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    const write = () => act(() => result.current.noteWriteResult(envelope(MessageType.WORKSHOP_MEMORY_WRITE_RESULT, { requestId: 'sheet-1', ok: true })));
    write();
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(0);
    act(() => result.current.setSettingsVisible(true));
    write();
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(1);
    act(() => result.current.setSettingsVisible(false));
    write();
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(1);
  });

  it('openManager with a memory marks it until the manager closes (PR #202 N02)', () => {
    const { result } = renderHook(() => useWorkshopMemoryManager());
    act(() => result.current.openManager('mem-7f3c21'));
    expect(result.current.focusMemoryId).toBe('mem-7f3c21');
    act(() => result.current.closeManager());
    expect(result.current.focusMemoryId).toBeUndefined();
  });
});
