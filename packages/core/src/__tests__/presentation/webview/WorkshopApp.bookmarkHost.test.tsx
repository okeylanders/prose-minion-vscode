/** @jest-environment jsdom */

/**
 * WorkshopApp bookmark renames against the real host (PR #189 F-01): the real
 * App, with its bookmark messages routed through the real router, slice
 * composition and session, and the host's replies delivered back to it.
 *
 * A submitted rename stays in its field, saving, until the host answers that
 * request. A refusal under the session-operation gate (held at its gate seam,
 * as a Refresh changed files waiting on persistence I/O holds it) gives the
 * draft back with the host's reason, and the label is unchanged. An accepted
 * rename closes the field onto the new label. Escape and a room replacement
 * still close the field.
 *
 * And the preview of a private exchange out of the window (PR #189 N-01):
 * the writer's and the instrument's turns, opened through the real preview
 * route once the room has passed the snapshot window, carry the label their
 * bubbles showed in it.
 */

import './support/jsdomTextEncoding';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  createWorkshopRouteTestHarness,
  message
} from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

/** The webview messages this bridge carries to the host. */
const TO_HOST = new Set<MessageType>([
  MessageType.WORKSHOP_SET_TURN_BOOKMARK,
  MessageType.WORKSHOP_RENAME_BOOKMARK,
  MessageType.WORKSHOP_REQUEST_TURN_PREVIEW
]);
/** The host messages it carries back. */
const TO_WEBVIEW = new Set<MessageType>([
  MessageType.WORKSHOP_SESSION_STATE,
  MessageType.WORKSHOP_RENAME_BOOKMARK_RESULT,
  MessageType.WORKSHOP_TURN_PREVIEW,
  MessageType.ERROR
]);

const GATE = 'Wait for the current session save or replacement to finish before changing the room.';

describe('WorkshopApp bookmark rename against the real host (PR #189 F-01)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  /** A room with one bookmarked reply, its snapshot on screen, and Notes open. */
  const bridged = async ({ writerToo = false } = {}) => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Look at the lantern beat.' }) as never);
    const ledger = harness.session.readRoomLedger();
    const reply = ledger.find((turn) => turn.participant === 'host')!;
    const writer = ledger.find((turn) => turn.participant === 'writer' && turn.kind === 'message')!;
    for (const turn of writerToo ? [writer, reply] : [reply]) {
      await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: turn.id, bookmarked: true }) as never);
    }

    let delivered = 0;
    /** Carries the webview's bookmark messages to the host, then the host's replies back. */
    const pump = async () => {
      await act(async () => {
        const sent = vscode.postMessage.mock.calls.map(([entry]: [{ type: MessageType }]) => entry);
        vscode.postMessage.mockClear();
        for (const entry of sent.filter((candidate) => TO_HOST.has(candidate.type))) {
          await harness.router.route(entry as never);
        }
        const replies = harness.postMessage.mock.calls.slice(delivered).map(([entry]) => entry);
        delivered = harness.postMessage.mock.calls.length;
        for (const entry of replies.filter((candidate) => TO_WEBVIEW.has(candidate.type))) {
          window.dispatchEvent(new MessageEvent('message', { data: entry }));
        }
      });
    };

    render(<WorkshopApp />);
    await pump();
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    const bookmarks = harness.session.getSnapshot().bookmarks;
    // With the writer's message too, the reply is second in thread order.
    const bookmark = bookmarks.at(-1)!;
    return { harness, bookmark, bookmarks, pump };
  };

  const rail = () => screen.getByLabelText('Session rail');
  const field = () => within(rail()).getByRole('textbox', { name: 'Bookmark name' }) as HTMLInputElement;
  const startRename = (label: string, draft: string) => {
    fireEvent.click(within(rail()).getByRole('button', { name: `Rename bookmark: ${label}` }));
    fireEvent.change(field(), { target: { value: draft } });
  };

  it('keeps the draft and shows the host\'s reason when the gate refuses it', async () => {
    const { harness, bookmark, pump } = await bridged();
    startRename(bookmark.label, 'The quiet father');
    harness.persistence.isSessionOperationPending.mockReturnValue(true);

    fireEvent.click(within(rail()).getByRole('button', { name: 'Save' }));
    // Sent and waiting: the field says so, and Save cannot send twice.
    expect(within(rail()).getByRole('status').textContent).toBe('Saving…');
    expect((within(rail()).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await pump();

    expect(field().value).toBe('The quiet father');
    expect(within(rail()).getByRole('alert').textContent).toBe(GATE);
    expect(harness.session.getSnapshot().bookmarks[0].label).toBe(bookmark.label);

    // Once the gate is free, the same draft saves.
    harness.persistence.isSessionOperationPending.mockReturnValue(false);
    fireEvent.click(within(rail()).getByRole('button', { name: 'Save' }));
    await pump();
    expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(harness.session.getSnapshot().bookmarks[0].label).toBe('The quiet father');
    expect(within(rail()).getByRole('button', { name: 'Rename bookmark: The quiet father' })).toBeTruthy();
  });

  it('closes the field onto the new label once the host accepts it', async () => {
    const { harness, bookmark, pump } = await bridged();
    startRename(bookmark.label, 'The quiet father');

    fireEvent.submit(field().form!);
    expect(field().value).toBe('The quiet father');
    await pump();

    expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(harness.session.getSnapshot().bookmarks[0].label).toBe('The quiet father');
    expect(document.activeElement).toBe(
      within(rail()).getByRole('button', { name: 'Rename bookmark: The quiet father' })
    );
  });

  it('closes on a reset to the default, which a snapshot alone could not tell from no change', async () => {
    const { harness, bookmark, pump } = await bridged();
    startRename(bookmark.label, 'Named');
    fireEvent.submit(field().form!);
    await pump();
    startRename('Named', '');

    fireEvent.submit(field().form!);
    await pump();

    expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(harness.session.getSnapshot().bookmarks[0].label).toBe(bookmark.label);
  });

  it('still closes on Escape, sending nothing', async () => {
    const { harness, bookmark, pump } = await bridged();
    startRename(bookmark.label, 'Second thoughts');

    fireEvent.keyDown(field(), { key: 'Escape' });
    await pump();

    expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(harness.posted(MessageType.WORKSHOP_RENAME_BOOKMARK_RESULT)).toEqual([]);
  });

  it('still closes the field when the room is replaced', async () => {
    const { harness, bookmark, pump } = await bridged();
    startRename(bookmark.label, 'Old room draft');

    await act(async () => {
      await harness.router.route(message(MessageType.WORKSHOP_RESET_SESSION, { start: 'carry' }) as never);
    });
    await pump();

    expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
  });

  describe('one rename at a time, bound to its row (PR #189 F-03)', () => {
    const renameButton = (label: string) =>
      within(rail()).getByRole('button', { name: `Rename bookmark: ${label}` }) as HTMLButtonElement;
    const labels = (harness: { session: { getSnapshot: () => { bookmarks: Array<{ label: string }> } } }) =>
      harness.session.getSnapshot().bookmarks.map((entry) => entry.label);

    it('while A waits, B cannot open; A\'s acceptance closes A and leaves B as it was', async () => {
      const { harness, bookmarks, pump } = await bridged({ writerToo: true });
      const [first, second] = bookmarks;
      startRename(second.label, 'The quiet father');
      fireEvent.submit(field().form!);

      const other = renameButton(first.label);
      expect(other.disabled).toBe(true);
      expect(other.title).toBe('Wait for the rename in progress to finish');
      fireEvent.click(other);
      // Still A's field, with A's draft, saving.
      expect(within(rail()).getAllByRole('textbox', { name: 'Bookmark name' })).toHaveLength(1);
      expect(field().value).toBe('The quiet father');
      expect(field().readOnly).toBe(true);

      await pump();
      expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
      expect(labels(harness)).toEqual([first.label, 'The quiet father']);
      expect(document.activeElement).toBe(renameButton('The quiet father'));
      expect(renameButton(first.label).disabled).toBe(false);
    });

    it('while A waits, B cannot open; A\'s refusal comes back to A, with A\'s draft', async () => {
      const { harness, bookmarks, pump } = await bridged({ writerToo: true });
      const [first, second] = bookmarks;
      startRename(second.label, 'The quiet father');
      harness.persistence.isSessionOperationPending.mockReturnValue(true);
      fireEvent.submit(field().form!);
      fireEvent.click(renameButton(first.label));

      await pump();
      expect(within(rail()).getAllByRole('textbox', { name: 'Bookmark name' })).toHaveLength(1);
      expect(field().value).toBe('The quiet father');
      expect(within(rail()).getByRole('alert').textContent).toBe(GATE);
      // The open field is A's: B's row still offers its own Rename.
      expect(renameButton(first.label).disabled).toBe(false);
      expect(within(rail()).queryByRole('button', { name: `Rename bookmark: ${second.label}` })).toBeNull();
      expect(labels(harness)).toEqual([first.label, second.label]);
    });

    it('Escape while A waits closes A and drops its late answer, touching no other row', async () => {
      const { harness, bookmarks, pump } = await bridged({ writerToo: true });
      const [first, second] = bookmarks;
      startRename(second.label, 'Second thoughts');
      fireEvent.submit(field().form!);
      fireEvent.keyDown(field(), { key: 'Escape' });
      expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();

      startRename(first.label, 'Draft for B');
      await pump();

      // The host kept A's name; its answer reached no field.
      expect(labels(harness)).toEqual([first.label, 'Second thoughts']);
      expect(field().value).toBe('Draft for B');
      expect(field().readOnly).toBe(false);
      expect(within(rail()).queryByRole('alert')).toBeNull();
    });

    it('a room replacement while A waits closes the field, and the answer opens nothing', async () => {
      const { harness, bookmark, pump } = await bridged();
      startRename(bookmark.label, 'Old room draft');
      fireEvent.submit(field().form!);

      await act(async () => {
        await harness.router.route(message(MessageType.WORKSHOP_RESET_SESSION, { start: 'carry' }) as never);
      });
      await pump();

      expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
      expect(within(rail()).queryByRole('alert')).toBeNull();
    });

    it('renames one row, then the other, each in turn', async () => {
      const { harness, bookmarks, pump } = await bridged({ writerToo: true });
      const [first, second] = bookmarks;
      startRename(first.label, 'The question');
      fireEvent.submit(field().form!);
      await pump();
      startRename(second.label, 'The answer');
      fireEvent.submit(field().form!);
      await pump();

      expect(labels(harness)).toEqual(['The question', 'The answer']);
      expect(within(rail()).queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    });
  });

  describe('a private exchange out of the window (PR #189 N-01)', () => {
    it('previews the writer\'s and the instrument\'s turns with the labels their bubbles showed', async () => {
      const harness = createWorkshopRouteTestHarness();
      await harness.pin();
      await harness.runProse();
      await harness.router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as never);
      await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Why the pacing flag?' }) as never);
      const ledger = harness.session.readRoomLedger();
      const writer = ledger.filter((turn) => turn.role === 'user' && turn.kind === 'message').at(-1)!;
      const reply = ledger.at(-1)!;
      expect(reply.participant).toBe('tool');
      for (const turn of [writer, reply]) {
        await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: turn.id, bookmarked: true }) as never);
      }

      let delivered = 0;
      const pump = async () => {
        await act(async () => {
          const sent = vscode.postMessage.mock.calls.map(([entry]: [{ type: MessageType }]) => entry);
          vscode.postMessage.mockClear();
          for (const entry of sent.filter((candidate) => TO_HOST.has(candidate.type))) {
            await harness.router.route(entry as never);
          }
          const replies = harness.postMessage.mock.calls.slice(delivered).map(([entry]) => entry);
          delivered = harness.postMessage.mock.calls.length;
          for (const entry of replies.filter((candidate) => TO_WEBVIEW.has(candidate.type))) {
            window.dispatchEvent(new MessageEvent('message', { data: entry }));
          }
        });
      };
      render(<WorkshopApp />);
      await pump();

      // In the window, each bubble says who heard it.
      const bubbleLabel = (turnId: string) => document
        .querySelector(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"] .pm-ws-private-thread-label`)
        ?.textContent?.trim();
      const inWindow = { [writer.id]: bubbleLabel(writer.id), [reply.id]: bubbleLabel(reply.id) };
      expect(inWindow[writer.id]).toBe('Private · you + Prose');
      expect(inWindow[reply.id]).toBe('Private · you + Prose');

      // The room moves on past the snapshot window.
      for (let i = 0; i < WORKSHOP_SNAPSHOT_TURN_WINDOW; i += 1) {
        harness.session.recordSessionMarker('resume', `Session resumed, pass ${i}`);
      }
      await act(async () => {
        await harness.router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as never);
      });
      await pump();
      fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
      const summaries = harness.session.getSnapshot().bookmarks;
      expect(summaries.map((summary) => summary.inWindow)).toEqual([false, false]);

      for (const summary of summaries) {
        fireEvent.click(within(screen.getByLabelText('Session rail'))
          .getByRole('button', { name: `${summary.label}: open it in the reader` }));
        await pump();
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).queryByText('Loading the message…')).toBeNull();
        expect(sheet.querySelector('.pm-ws-private-thread-label')?.textContent?.trim()).toBe(inWindow[summary.turnId]);
        fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
        await act(async () => { await Promise.resolve(); });
      }
    });
  });
});
