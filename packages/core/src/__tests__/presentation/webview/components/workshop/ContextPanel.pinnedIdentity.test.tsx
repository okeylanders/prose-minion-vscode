/** @jest-environment jsdom */

/**
 * A pill's Pin outcome belongs to the room and attachment that asked (PR
 * #213 F01), and the focus returns only to a pill whose own Pin held it as
 * it was removed (N01). Astra's review probe
 * (`docs/pr-reviews/probes/pr-213-pill-identity.test.tsx.txt`), promoted
 * with its assertions as written; the sheet now names its room, as
 * `WorkshopApp` does with the snapshot's `roomRevision`. Two cases are added:
 * a late success, and a late refusal, across a room replacement that attaches
 * the same file again under the same id. *Alice* and *Bob*.
 */

import { TextDecoder, TextEncoder } from 'node:util';
// jsdom lacks these; the real host harness in the first case encodes text.
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

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
import { harness as hostHarness } from '@/__tests__/application/handlers/domain/workshop/workshopPinnedContextHandlerHost';
import { WorkshopPinnedContextHandler } from '@handlers/domain/workshop/WorkshopPinnedContextHandler';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const alice: WorkshopContextAttachmentSnapshot = { id: 'ctx-1', kind: 'file', origin: 'writer', label: 'alice.md', relativePath: 'Characters/alice.md', words: 3, addedAt: 1 };
const bob: WorkshopContextAttachmentSnapshot = { id: 'ctx-1', kind: 'file', origin: 'writer', label: 'bob.md', relativePath: 'Characters/bob.md', words: 3, addedAt: 2 };

const entry = (path: string): WorkshopPinnedContextEntryView => ({ path, label: path.split('/').at(-1)!, words: 3, state: 'ready' });

const answer = (
  requestId: string | null,
  entries: readonly WorkshopPinnedContextEntryView[],
  extra: Partial<WorkshopPinnedContextPayload> = {}
): WorkshopPinnedContextPayload => ({
  requestId,
  platform: 'posix',
  availability: { available: true },
  file: { state: 'ok' },
  revision: `rev-${entries.length}`,
  entries,
  totals: { words: 3 * entries.length, budgetWords: 100_000, files: entries.length, maxFiles: 20 },
  ...extra
});

let deliver: (payload: WorkshopPinnedContextPayload) => void = () => undefined;

/** The sheet as `WorkshopApp` wires it, rendered with createElement (a camelCase name). */
function pinnedSheet({ attachments, room }: { attachments: WorkshopContextAttachmentSnapshot[]; room: number }): React.ReactElement {
  const context = useWorkshopPinnedContext({ attachments, running: false });
  const pills = useWorkshopPinnedPills({
    ...(context.answer ? { answer: context.answer } : {}),
    attachments,
    room,
    pinnableIds: context.view.pinAttached.ids,
    pending: context.pending,
    pinAttachments: context.pinAttachments
  });
  deliver = (payload) => context.handlePinnedContext(
    { type: MessageType.WORKSHOP_PINNED_CONTEXT, source: 'extension.workshop', timestamp: 1, payload } as WorkshopPinnedContextMessage
  );
  return (
    <>
      <button data-testid="elsewhere">Elsewhere</button>
      <ContextPanel
        attachments={attachments}
        pendingDelivery={false}
        isRunning={false}
        onAddText={jest.fn()}
        onAddFile={jest.fn()}
        onRefreshFiles={jest.fn()}
        onOpenAttachment={jest.fn()}
        onRemove={jest.fn()}
        wizardRunning={false}
        onRunWizard={jest.fn()}
        onCancelWizard={jest.fn()}
        pinned={{ pills: pills.pills, onPin: pills.pin }}
      />
    </>
  );
}

const sheet = (attachments: WorkshopContextAttachmentSnapshot[], room = 1) =>
  React.createElement(pinnedSheet, { attachments, room });

let vscode: ReturnType<typeof createMockVSCode>;
const lastId = (type: MessageType) => vscode.postMessage.mock.calls
  .map(([posted]: [{ type: MessageType; payload: { requestId: string } }]) => posted)
  .filter((posted) => posted.type === type)
  .at(-1)!.payload.requestId;

beforeEach(() => {
  vscode = createMockVSCode();
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
});

afterEach(() => jest.clearAllMocks());

function mount(room = 1) {
  const view = render(sheet([alice], room));
  act(() => deliver(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), [])));
  return view;
}

describe('a pill\'s Pin outcome and focus (PR #213 F01, N01)', () => {
  it('does not show the old room pin refusal on a different attachment reusing ctx-1', async () => {
    const h = hostHarness();
    h.write('Characters/alice.md', 'Alice belongs to the original room.');
    h.attachFile('Characters/alice.md', false);
    const replies: WorkshopPinnedContextPayload[] = [];
    const handler = new WorkshopPinnedContextHandler(
      { library: h.library, takeFirstRoomReport: () => undefined },
      h.session,
      h.shell as never,
      (async (message: { type: MessageType; payload: unknown }) => {
        if (message.type === MessageType.WORKSHOP_PINNED_CONTEXT) {
          replies.push(message.payload as WorkshopPinnedContextPayload);
        }
      }) as never,
      h.log,
      h.effects
    );
    const view = render(sheet(h.session.getContextAttachments(), h.session.readRoomRevision()));
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT), [])));
    act(() => deliver(answer(null, [], { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION })));
    fireEvent.click(screen.getByRole('button', { name: 'Pin alice.md for new sessions' }));
    const requestId = lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS);
    // The real handler captures room-1 synchronously, before its store read awaits.
    const pinning = handler.handlePinAttachments({
      type: MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS,
      source: 'webview.workshop',
      timestamp: 1,
      payload: { requestId, revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: ['ctx-1'] }
    });
    h.scope.current = () => ({ available: true, liveSessionId: 'room-2' });
    h.session.reset({ clearWorkingSet: true });
    expect(h.attachFile('Characters/bob.md', false)).toBe('ctx-1');
    view.rerender(sheet(h.session.getContextAttachments(), h.session.readRoomRevision()));
    await pinning;
    expect(replies[0]).toMatchObject({ requestId, ok: false, notice: { kind: 'refused', text: 'The workspace changed, so pinned context wasn’t changed.' } });
    act(() => deliver(replies[0]));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not move focus to a different room attachment when the old pin succeeds late', () => {
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Pin alice.md for new sessions' }));
    const requestId = lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS);
    view.rerender(sheet([bob]));
    expect(document.activeElement?.tagName).toBe('BODY');
    act(() => deliver(answer(requestId, [entry(alice.relativePath!), entry(bob.relativePath!)], { action: 'pin-attachments', ok: true })));
    expect(document.activeElement?.tagName).toBe('BODY');
  });

  it('does not take focus back after the user deliberately blurs the pending Pin', () => {
    mount();
    const pin = screen.getByRole('button', { name: 'Pin alice.md for new sessions' });
    pin.focus();
    fireEvent.click(pin);
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
    expect(document.activeElement?.tagName).toBe('BODY');
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS), [entry(alice.relativePath!)], { action: 'pin-attachments', ok: true })));
    expect(document.activeElement?.tagName).toBe('BODY');
  });

  it('preserves focus on another control while a pin lands', () => {
    mount();
    const pin = screen.getByRole('button', { name: 'Pin alice.md for new sessions' });
    pin.focus();
    fireEvent.click(pin);
    const elsewhere = screen.getByTestId('elsewhere');
    elsewhere.focus();
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS), [entry(alice.relativePath!)], { action: 'pin-attachments', ok: true })));
    expect(document.activeElement).toBe(elsewhere);
  });

  it('a Pin that keeps the focus until it lands gives it back to its own pill', () => {
    mount();
    const pin = screen.getByRole('button', { name: 'Pin alice.md for new sessions' });
    pin.focus();
    fireEvent.click(pin);
    expect(document.activeElement).toBe(pin);
    act(() => deliver(answer(lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS), [entry(alice.relativePath!)], { action: 'pin-attachments', ok: true })));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'alice.md, pinned' }));
  });

  it('a late success across a room replacement, with the same file under the same id, is not this room\'s landing', () => {
    const view = mount(1);
    const pin = screen.getByRole('button', { name: 'Pin alice.md for new sessions' });
    pin.focus();
    fireEvent.click(pin);
    const requestId = lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS);
    // A new room (New, Open, Branch, Rewind): the same file, the same id, the same attachment fields.
    view.rerender(sheet([alice], 2));
    const newPin = screen.getByRole('button', { name: 'Pin alice.md for new sessions' });
    newPin.focus();
    act(() => deliver(answer(requestId, [entry(alice.relativePath!)], { action: 'pin-attachments', ok: true })));
    // The mark follows the list, in any room; the landing and its focus don't cross rooms.
    expect(screen.getByRole('button', { name: 'alice.md, pinned' })).toBeTruthy();
    expect(document.activeElement?.tagName).toBe('BODY');
  });

  it('a late refusal across a room replacement, with the same file under the same id, is not shown in the new room', () => {
    const view = mount(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pin alice.md for new sessions' }));
    const requestId = lastId(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS);
    view.rerender(sheet([alice], 2));
    act(() => deliver(answer(requestId, [], {
      action: 'pin-attachments',
      ok: false,
      notice: { kind: 'refused', text: 'The workspace changed, so pinned context wasn’t changed.' }
    })));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pin alice.md for new sessions' })).toBeTruthy();
  });
});
