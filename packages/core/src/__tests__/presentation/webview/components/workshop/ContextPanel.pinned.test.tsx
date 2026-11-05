/**
 * @jest-environment jsdom
 */

/**
 * The context sheet's pin marks and Pin from a pill (Pinned Context Slice
 * 4), through the real `useWorkshopPinnedContext`, `useWorkshopPinnedPills`
 * and `ContextPanel`, with the host played by hand:
 * - the mark follows the list in the same room: pinning shows it, unpinning
 *   clears it, with no change to the room's attachments;
 * - its accessible name and tooltip;
 * - Pin posts Slice 3's pin by attachment id; the mark appears and the
 *   button goes; a refusal shows at the pill;
 * - text notes, wizard pills and pinned pills offer no Pin; Remove is
 *   unchanged. *Alice*.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ContextPanel } from '@components/workshop/ContextPanel';
import { useWorkshopPinnedContext } from '@hooks/domain/workshop/useWorkshopPinnedContext';
import { useWorkshopPinnedPills } from '@hooks/domain/workshop/controllers/useWorkshopPinnedPills';
import {
  MessageType,
  type WorkshopContextAttachmentSnapshot,
  type WorkshopPinnedContextEntryView,
  type WorkshopPinnedContextMessage,
  type WorkshopPinnedContextPayload
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const ALICE: WorkshopPinnedContextEntryView = { path: 'Characters/alice.md', label: 'alice.md', group: 'characters', words: 3400, state: 'ready' };
const RABBIT: WorkshopPinnedContextEntryView = { path: 'Characters/the-white-rabbit.md', label: 'the-white-rabbit.md', group: 'characters', words: 1900, state: 'ready' };

function answer(requestId: string | null, entries: readonly WorkshopPinnedContextEntryView[], overrides: Partial<WorkshopPinnedContextPayload> = {}): WorkshopPinnedContextPayload {
  return {
    requestId,
    platform: 'posix',
    availability: { available: true },
    file: { state: 'ok' },
    revision: `rev-${entries.length}`,
    entries,
    totals: { words: entries.reduce((sum, entry) => sum + (entry.words ?? 0), 0), budgetWords: 100_000, files: entries.length, maxFiles: 20 },
    ...overrides
  };
}

const attachments: WorkshopContextAttachmentSnapshot[] = [
  { id: 'ctx-1', kind: 'file', origin: 'writer', label: 'alice.md', words: 3400, addedAt: 1, configuredResource: { group: 'characters', path: 'Characters/alice.md' }, relativePath: 'Characters/alice.md' },
  { id: 'ctx-2', kind: 'file', origin: 'writer', label: 'the-white-rabbit.md', words: 1900, addedAt: 2, relativePath: 'Characters/the-white-rabbit.md' },
  { id: 'ctx-3', kind: 'text', origin: 'writer', label: 'The clock always reads six', words: 200, addedAt: 3, content: 'The clock always reads six.' },
  { id: 'ctx-4', kind: 'file', origin: 'wizard', label: 'the-hatter.md', words: 2600, addedAt: 4, relativePath: 'Characters/the-hatter.md' }
];

let deliver: (payload: WorkshopPinnedContextPayload) => void = () => undefined;
const onRemove = jest.fn();

/** The sheet as WorkshopApp wires it, rendered with createElement (a camelCase name). */
function pinnedSheet(): React.ReactElement {
  const pinnedContext = useWorkshopPinnedContext({ attachments, running: false });
  const pinnedPills = useWorkshopPinnedPills({
    ...(pinnedContext.answer ? { answer: pinnedContext.answer } : {}),
    attachments,
    pinnableIds: pinnedContext.view.pinAttached.ids,
    pending: pinnedContext.pending,
    pinAttachments: pinnedContext.pinAttachments
  });
  deliver = (payload) => pinnedContext.handlePinnedContext(
    { type: MessageType.WORKSHOP_PINNED_CONTEXT, source: 'extension.workshop', payload, timestamp: 1 } as WorkshopPinnedContextMessage
  );
  return (
    <ContextPanel
      attachments={attachments}
      pendingDelivery={false}
      isRunning={false}
      onAddText={jest.fn()}
      onAddFile={jest.fn()}
      onRefreshFiles={jest.fn()}
      onOpenAttachment={jest.fn()}
      onRemove={onRemove}
      wizardRunning={false}
      onRunWizard={jest.fn()}
      onCancelWizard={jest.fn()}
      pinned={{ pills: pinnedPills.pills, onPin: pinnedPills.pin }}
    />
  );
}

describe('ContextPanel: pinned context marks', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posts = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([posted]: [{ type: MessageType; payload: Record<string, unknown> }]) => posted)
    .filter((posted) => posted.type === type);
  const lastId = (type: MessageType) => posts(type)[posts(type).length - 1].payload.requestId as string;
  const marks = () => screen.queryAllByRole('img', { name: 'Pinned' });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  const mount = (entries: readonly WorkshopPinnedContextEntryView[]) => {
    const view = render(React.createElement(pinnedSheet));
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), entries)));
    return view;
  };

  it('the mark follows the list in the same room: pinning shows it, unpinning clears it', () => {
    mount([ALICE]);
    expect(marks()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'alice.md, pinned' })).toBeTruthy();

    act(() => deliver(answer(null, [ALICE, RABBIT])));
    expect(marks()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'the-white-rabbit.md, pinned' })).toBeTruthy();

    act(() => deliver(answer(null, [RABBIT])));
    expect(marks()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'alice.md' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'alice.md, pinned' })).toBeNull();
  });

  it('the head counts the pills that show the mark: as today at 0 and before the answer, then "· 1 pinned", "· 2 pinned"', () => {
    const { container } = render(React.createElement(pinnedSheet));
    const count = () => container.querySelector('.pm-ws-ctx-count')?.textContent;
    expect(count()).toBe('4 attachments');

    act(() => deliver(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), [])));
    expect(count()).toBe('4 attachments');

    act(() => deliver(answer(null, [ALICE])));
    expect(count()).toBe('4 attachments · 1 pinned');

    act(() => deliver(answer(null, [ALICE, RABBIT, { path: 'Places/wonderland.md', label: 'wonderland.md', words: 2900, state: 'ready' }])));
    expect(count()).toBe('4 attachments · 2 pinned');
  });

  it('names the pill ", pinned", draws the accent mark after the word count, and describes it with the tooltip', () => {
    const { container } = mount([ALICE]);
    const open = screen.getByRole('button', { name: 'alice.md, pinned' });
    const pill = open.closest('.pm-ws-ctx-pill')!;
    expect(pill.classList.contains('pm-ws-ctx-pill-pinned')).toBe(true);
    const size = pill.querySelector('.pm-ws-ctx-pill-size')!;
    expect(size.nextElementSibling?.getAttribute('aria-label')).toBe('Pinned');

    const tip = container.querySelector(`#${open.getAttribute('aria-describedby')}`)!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.textContent).toBe('Pinned: attached to every new session. Removing it here removes it from this conversation only.');
    expect(screen.getByRole('button', { name: 'Remove alice.md' })).toBeTruthy();
  });

  it('Pin from a pill pins by attachment id, then the mark appears and the button goes', () => {
    mount([ALICE]);
    const pin = screen.getByRole('button', { name: 'Pin the-white-rabbit.md for new sessions' });
    pin.focus();
    fireEvent.click(pin);

    const posted = posts(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS);
    expect(posted).toHaveLength(1);
    expect(posted[0].payload).toMatchObject({ attachmentIds: ['ctx-2'], revision: 'rev-1' });
    expect((screen.getByRole('button', { name: 'Pin the-white-rabbit.md for new sessions' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => deliver(answer(lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS), [ALICE, RABBIT], { action: 'pin-attachments', ok: true })));
    expect(screen.getByRole('button', { name: 'the-white-rabbit.md, pinned' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Pin the-white-rabbit\.md/ })).toBeNull();
    expect(marks()).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'the-white-rabbit.md, pinned' }));
  });

  it('a refusal shows where the pill is, and the next pin clears it', () => {
    mount([ALICE]);
    fireEvent.click(screen.getByRole('button', { name: 'Pin the-white-rabbit.md for new sessions' }));
    const words = 'Can’t pin the-white-rabbit.md: pinned context would come to about 101,900 of 100,000 words.';
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS), [ALICE], {
      action: 'pin-attachments', ok: false, notice: { kind: 'refused', text: words }
    })));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(words);
    const pin = screen.getByRole('button', { name: 'Pin the-white-rabbit.md for new sessions' });
    expect(pin.getAttribute('aria-describedby')).toBe(alert.id);
    expect(alert.previousElementSibling?.contains(pin)).toBe(true);

    fireEvent.click(pin);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('text notes, wizard pills and pinned pills offer no Pin, and a pinned pill no Unpin', () => {
    mount([ALICE]);
    const pins = screen.getAllByRole('button', { name: /^Pin .* for new sessions$/ });
    expect(pins.map((button) => button.getAttribute('aria-label'))).toEqual(['Pin the-white-rabbit.md for new sessions']);
    expect(screen.queryByRole('button', { name: /unpin/i })).toBeNull();
  });

  it('Remove on a pinned pill is unchanged', () => {
    mount([ALICE]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove alice.md' }));
    expect(onRemove).toHaveBeenCalledWith('ctx-1');
    expect(posts(MessageType.WORKSHOP_UNPIN_CONTEXT)).toHaveLength(0);
  });

  it('with no list to change, there is no mark and no Pin', () => {
    mount([ALICE]);
    act(() => deliver(answer(null, [ALICE], {
      availability: { available: false, reason: 'no-workspace', words: 'Open a folder.' },
      revision: null
    })));
    expect(marks()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /for new sessions$/ })).toBeNull();
  });
});
