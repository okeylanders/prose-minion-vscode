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
  const mount = (pending: WorkshopMessageAttachmentSnapshot[] = []) => renderHook(
    (props: { pending: WorkshopMessageAttachmentSnapshot[] }) =>
      useWorkshopSelectedText({ seedReceiver: RECEIVER, pendingMessageAttachments: props.pending }),
    { initialProps: { pending } }
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
    expect(result.current.sendSnapshotId).toBeUndefined();
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
    expect(result.current.sendSnapshotId).toBe('snap-2');

    // A deselect clears the pill.
    act(() => result.current.handleSelectedTextCurrent(current(null)));
    expect(result.current.livePill).toBeNull();
    expect(result.current.sendSnapshotId).toBeUndefined();

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
    expect(result.current.sendSnapshotId).toBeUndefined();

    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-2'))));
    expect(result.current.livePill?.selection.snapshotId).toBe('snap-2');
    // The staged pill is removed: the first selection would be live again.
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    rerender({ pending: [] });
    expect(result.current.sendSnapshotId).toBe('snap-1');
  });

  it('draws the live pill disabled, with the reason, when the message has no room, and names nothing on a send', () => {
    const full = Array.from({ length: 7 }, (_, index) => file(`ta-${index + 1}`));
    const { result } = mount(full);
    act(() => result.current.setIncludeSelectedText(true));
    act(() => result.current.handleSelectedTextCurrent(current(summary('snap-1'))));
    expect(result.current.livePill).toEqual({ selection: summary('snap-1'), disabledReason: WORKSHOP_SELECTED_TEXT_FULL_REASON });
    expect(result.current.sendSnapshotId).toBeUndefined();
    expect(workshopLiveSelectedText(true, summary('snap-1'), full.slice(1))).toEqual({ selection: summary('snap-1') });
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
