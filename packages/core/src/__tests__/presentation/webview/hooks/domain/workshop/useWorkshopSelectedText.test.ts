/** @jest-environment jsdom */

/**
 * useWorkshopSelectedText (ADR 2026-11-14 D12, D14, D17): the toggle is a
 * per-window preference, off by default; while it is on the hook watches
 * and holds the newest pushed selection as the live pill; the pill hides
 * when its snapshot is already staged and is disabled when the message is
 * full; a seed is claimed before it is accepted. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopSelectedText, workshopLiveSelectedText } from '@hooks/domain/workshop/useWorkshopSelectedText';
import {
  MessageType,
  WORKSHOP_SELECTED_TEXT_FULL_REASON,
  type WorkshopMessageAttachmentSnapshot,
  type WorkshopSelectedTextSummary
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const RECEIVER = 'workshop-receiver-1';
const summary = (snapshotId: string, over: Partial<WorkshopSelectedTextSummary> = {}): WorkshopSelectedTextSummary => ({
  snapshotId,
  displayName: 'alice-ch3.md',
  startLine: 40,
  endLine: 44,
  words: 62,
  preview: 'The Caterpillar and Alice looked at each other',
  ...over
});
const current = (selection: WorkshopSelectedTextSummary | null) =>
  ({ type: MessageType.WORKSHOP_SELECTED_TEXT_CURRENT, source: 'extension.workshop.selected-text', payload: { selection }, timestamp: 1 }) as never;
const file = (id: string): WorkshopMessageAttachmentSnapshot => ({ id, label: `${id}.md`, words: 10 });
const stagedSelection = (id: string, snapshotId: string): WorkshopMessageAttachmentSnapshot => ({
  id, label: 'Selected Text', words: 62, relativePath: 'alice-ch3.md', selectedText: { snapshotId, startLine: 40, endLine: 44 }
});

describe('useWorkshopSelectedText', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posts = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([posted]: [{ type: MessageType; payload: Record<string, unknown> }]) => posted)
    .filter((posted) => posted.type === type)
    .map((posted) => posted.payload);
  const mount = (pending: WorkshopMessageAttachmentSnapshot[] = [], roomRevision = 1) => renderHook(
    (props: { pending: WorkshopMessageAttachmentSnapshot[]; roomRevision?: number }) =>
      useWorkshopSelectedText({ seedReceiver: RECEIVER, roomRevision: props.roomRevision ?? roomRevision, pendingMessageAttachments: props.pending }),
    { initialProps: { pending } as { pending: WorkshopMessageAttachmentSnapshot[]; roomRevision?: number } }
  );

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });
  afterEach(() => jest.clearAllMocks());

  it('is off by default: no watch, no pill, nothing named on a send, and the preference is what it persists', () => {
    const { result } = mount();
    expect(result.current.includeSelectedText).toBe(false);
    expect(result.current.livePill).toBeNull();
    expect(result.current.sendSelection).toBeUndefined();
    expect(result.current.persistedState).toEqual({ includeSelectedText: false });
    expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([]);
    // A push that arrives while it is off is nobody's.
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    expect(result.current.livePill).toBeNull();
  });

  it('watches while on, shows the newest pushed selection, and stops watching when turned off or unmounted', () => {
    const { result, unmount } = mount();
    act(() => result.current.setIncludeSelectedText(true));
    expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }]);
    expect(result.current.persistedState).toEqual({ includeSelectedText: true });

    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-2', { startLine: 50, endLine: 50 }))));
    expect(result.current.livePill).toEqual({ selection: summary('snap-2', { startLine: 50, endLine: 50 }) });
    expect(result.current.sendSelection).toEqual({ snapshotId: 'snap-2', roomRevision: 1 });

    // A deselect clears the pill.
    act(() => result.current.handleSelectedTextCurrent(current(null)));
    expect(result.current.livePill).toBeNull();
    expect(result.current.sendSelection).toBeUndefined();

    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-3'))));
    act(() => result.current.setIncludeSelectedText(false));
    expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }, { on: false }]);
    expect(result.current.livePill).toBeNull();

    act(() => result.current.setIncludeSelectedText(true));
    unmount();
    expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }, { on: false }, { on: true }, { on: false }]);
  });

  it('starts watching at mount when the window remembered the toggle on', () => {
    vscode.getState.mockReturnValue({ includeSelectedText: true });
    const { result } = mount();
    expect(result.current.includeSelectedText).toBe(true);
    expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }]);
  });

  it('does not draw or send the live pill when its snapshot is already staged, and draws another selection beside it', () => {
    const { result, rerender } = mount([stagedSelection('ta-1', 'snap-1')]);
    act(() => result.current.setIncludeSelectedText(true));
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    expect(result.current.livePill).toBeNull();
    expect(result.current.sendSelection).toBeUndefined();

    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-2'))));
    expect(result.current.livePill?.selection.snapshotId).toBe('snap-2');
    // The staged pill is removed: the first selection would be live again.
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    rerender({ pending: [] });
    expect(result.current.sendSelection).toEqual({ snapshotId: 'snap-1', roomRevision: 1 });
  });

  it('draws the live pill disabled, with the reason, when the message has no room, and names nothing on a send', () => {
    const full = Array.from({ length: 7 }, (_, index) => file(`ta-${index + 1}`));
    const { result } = mount(full);
    act(() => result.current.setIncludeSelectedText(true));
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    expect(result.current.livePill).toEqual({ selection: summary('snap-1'), disabledReason: WORKSHOP_SELECTED_TEXT_FULL_REASON });
    expect(result.current.sendSelection).toBeUndefined();
    expect(workshopLiveSelectedText(true, summary('snap-1'), full.slice(1))).toEqual({ selection: summary('snap-1') });
  });

  describe('a pill belongs to the room it was drawn in (ADR 2026-11-14 D14; PR #264 P2)', () => {
    it('stamps the pill with the room on screen when it arrived, and a send names that room', () => {
      const { result } = mount([], 7);
      act(() => result.current.setIncludeSelectedText(true));
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      expect(result.current.sendSelection).toEqual({ snapshotId: 'snap-1', roomRevision: 7 });
    });

    it('drops the pill when the room on screen changes, asks the host again, and shows a pill only from a push in the new room', () => {
      const { result, rerender } = mount([], 1);
      act(() => result.current.setIncludeSelectedText(true));
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      // A send racing the replacement, before the webview has heard of it, names room 1: the host refuses it.
      const racing = result.current.sendSelection;
      expect(racing).toEqual({ snapshotId: 'snap-1', roomRevision: 1 });
      expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }]);

      // New, Open, Rewind or Branch landed: the room on screen is room 2.
      rerender({ pending: [], roomRevision: 2 });
      expect(result.current.livePill).toBeNull();
      expect(result.current.sendSelection).toBeUndefined();
      // The host is asked for the current selection again; its answer is a fresh draw.
      expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }, { on: true }]);

      // The same snapshot pushed again is a pill drawn in room 2, and is sent as room 2's.
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      expect(result.current.livePill?.selection.snapshotId).toBe('snap-1');
      expect(result.current.sendSelection).toEqual({ snapshotId: 'snap-1', roomRevision: 2 });
      // Nothing ever named the old pill under the new room's revision.
      expect(racing).toEqual({ snapshotId: 'snap-1', roomRevision: 1 });
    });

    it('never offers an old room\'s pill for a send, even in the render the room changed in', () => {
      const seen: Array<ReturnType<typeof useWorkshopSelectedText>['sendSelection']> = [];
      const { result, rerender } = renderHook(
        (props: { roomRevision: number }) => {
          const hook = useWorkshopSelectedText({ seedReceiver: RECEIVER, roomRevision: props.roomRevision, pendingMessageAttachments: [] });
          seen.push(hook.sendSelection);
          return hook;
        },
        { initialProps: { roomRevision: 1 } }
      );
      act(() => result.current.setIncludeSelectedText(true));
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      seen.length = 0;
      rerender({ roomRevision: 2 });
      // Every render since the change: no pill, so nothing to send.
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((selection) => selection === undefined)).toBe(true);
    });

    it('asks nothing of the host on a room change while the toggle is off', () => {
      const { rerender } = mount([], 1);
      rerender({ pending: [], roomRevision: 2 });
      expect(posts(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([]);
    });

    it('drops a push that arrived for the first room when the first session state names another', () => {
      // The window remembered the toggle on; the watch answers before the session snapshot does.
      vscode.getState.mockReturnValue({ includeSelectedText: true });
      const { result, rerender } = mount([], 0);
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      rerender({ pending: [], roomRevision: 5 });
      expect(result.current.livePill).toBeNull();
      act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
      expect(result.current.sendSelection).toEqual({ snapshotId: 'snap-1', roomRevision: 5 });
    });
  });

  it('claims an offered selection before accepting it, accepts once under its receiver, and answers the provider', () => {
    const { result } = mount();
    act(() => result.current.handleSelectedTextOffered({ payload: { deliveryId: 'selected-text-1' } } as never));
    expect(posts(MessageType.WORKSHOP_SEED_CLAIM)).toEqual([{ kind: 'selected-text', deliveryId: 'selected-text-1', receiver: RECEIVER }]);
    expect(posts(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toEqual([]);

    // Another kind's grant is not this hook's.
    act(() => result.current.handleSeedClaimResult({ payload: { kind: 'lightbox-tile', deliveryId: 'selected-text-1', granted: true } } as never));
    expect(posts(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toEqual([]);
    act(() => result.current.handleSeedClaimResult({ payload: { kind: 'selected-text', deliveryId: 'selected-text-1', granted: true } } as never));
    expect(posts(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toEqual([{ deliveryId: 'selected-text-1', receiver: RECEIVER }]);
    expect(result.current.staging).toBe('selected-text-1');

    act(() => result.current.handleSelectedTextStaged({ payload: { deliveryId: 'selected-text-1', staged: false, reason: 'full' } } as never));
    expect(posts(MessageType.WORKSHOP_SEED_ANSWER)).toEqual([
      { kind: 'selected-text', deliveryId: 'selected-text-1', opened: false, reason: 'full', receiver: RECEIVER }
    ]);
    expect(result.current.staging).toBeNull();
    expect(posts(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toHaveLength(1);
  });

  it('drops a denied claim without a word', () => {
    const { result } = mount();
    act(() => result.current.handleSelectedTextOffered({ payload: { deliveryId: 'selected-text-1' } } as never));
    act(() => result.current.handleSeedClaimResult({ payload: { kind: 'selected-text', deliveryId: 'selected-text-1', granted: false, reason: 'timeout' } } as never));
    expect(posts(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toEqual([]);
    expect(posts(MessageType.WORKSHOP_SEED_ANSWER)).toEqual([]);
  });
});
