/** @jest-environment jsdom */

/**
 * The Bookmarks screen through the real App and the real host (Bookmark
 * Recall Slice 2, ADR 2026-11-05 D8): the App's messages routed through the
 * real router, slice composition, session and recall service (over an
 * in-memory corpus of saved sessions), and the host's replies delivered back.
 *
 * - Both entry points open the screen; it lists this conversation's
 *   bookmarks and the saved sessions', with search and groupings.
 * - Preview opens the read-only sheet over the screen, for a saved turn and
 *   for one of this conversation's; closing it returns focus to the row.
 * - Open session goes through Open's confirmation; declining it opens
 *   nothing.
 * - Open at bookmark opens the session and jumps to the turn, or previews it
 *   when it lies outside the loaded window; a refused Open jumps nowhere.
 * - Closing the screen returns focus to its opener, and a late answer to an
 *   earlier request is dropped.
 */

import './support/jsdomTextEncoding';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, MessageType } from '@messages';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  createWorkshopRouteTestHarness,
  message
} from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';
import {
  BOOKMARK_LABEL,
  bookmarkedCheckpoint,
  bookmarkedRoom
} from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';
import { recallLog } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the module's component export.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const TO_HOST = new Set<MessageType>([
  MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE,
  MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE,
  MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS,
  MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW,
  MessageType.WORKSHOP_REQUEST_TURN_PREVIEW,
  MessageType.WORKSHOP_OPEN_SESSION
]);
const TO_WEBVIEW = new Set<MessageType>([
  MessageType.WORKSHOP_SESSION_STATE,
  MessageType.WORKSHOP_SESSION_ACTION_RESULT,
  MessageType.WORKSHOP_BOOKMARK_PAGE,
  MessageType.WORKSHOP_LIVE_BOOKMARKS,
  MessageType.WORKSHOP_SAVED_TURN_PREVIEW,
  MessageType.WORKSHOP_TURN_PREVIEW,
  MessageType.ERROR
]);

const SAVED_REPLY = 'HOST-REPLY: Alice opens the little door.';

/** Saved sessions as a corpus port: two, each with the scripted room's bookmarked reply. */
function corpusOf(sessions: WorkshopPersistedSessionV2[]) {
  const summary = (session: WorkshopPersistedSessionV2) => ({
    sessionId: session.sessionId,
    title: session.title,
    updatedAt: session.updatedAt,
    timezone: session.temporal.timezone,
    hostPersonaId: session.summary.hostPersonaId,
    participantPersonaIds: session.summary.participantPersonaIds,
    turnCount: session.summary.turnCount
  });
  return {
    availability: () => ({ available: true as const }),
    list: jest.fn(async () => ({ sessions: sessions.map(summary), truncated: false })),
    readNamed: jest.fn(async (sessionId: string) => sessions.find((session) => session.sessionId === sessionId)),
    listPage: jest.fn(async (request: { after?: string; limit: number }) => {
      const ordered = sessions.filter((session) => request.after === undefined || session.sessionId < request.after)
        .sort((left, right) => (left.sessionId < right.sessionId ? 1 : -1));
      return { entries: ordered.map((session) => ({ cursor: session.sessionId, summary: summary(session) })), remaining: 0 };
    })
  };
}

describe('WorkshopApp Bookmarks screen against the real host (ADR 2026-11-05 D8)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    __resetOverlayFocusStateForTests();
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

  const bridged = async () => {
    let clock = 10_000;
    const saved = [bookmarkedCheckpoint('alice-1', 'Tea party'), bookmarkedCheckpoint('alice-2', 'The garden')];
    const harness = createWorkshopRouteTestHarness({
      sessionNow: () => (clock += 1_000),
      bookmarkBrowser: (session) => new WorkshopTranscriptRecallService(
        corpusOf(saved),
        { recallScope: () => harness.persistence.recallScope() },
        recallLog(),
        { liveRoom: new WorkshopLiveRoomBookmarkReader(session, () => 'UTC') }
      )
    });
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'What does the Hatter want?' }) as never);
    const reply = harness.session.readRoomLedger().find((turn) => turn.participant === 'host')!;
    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: reply.id, bookmarked: true }) as never);
    const liveLabel = harness.session.getSnapshot().bookmarks[0].label;

    let delivered = 0;
    const pump = async () => {
      for (let round = 0; round < 3; round += 1) {
        await act(async () => {
          jest.runOnlyPendingTimers();
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
      }
    };

    render(<WorkshopApp />);
    await pump();
    return { harness, reply, liveLabel, saved, pump };
  };

  /** Let a closing overlay hand focus back: its restore runs after the closing commit. */
  const settleFocus = async () => {
    for (let round = 0; round < 3; round += 1) {
      await act(async () => {
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });
    }
  };
  /** The preview sheet's read-only body. */
  const sheetText = (sheet: HTMLElement) => (sheet.querySelector('textarea') as HTMLTextAreaElement).value;
  const screenDialog = () => screen.getByRole('dialog', { name: 'Bookmarks' });
  const openFromMenu = async (pump: () => Promise<void>) => {
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    fireEvent.click(screen.getByText('Bookmarks…').closest('button') as HTMLButtonElement);
    await pump();
  };
  const openFromNotes = async (pump: () => Promise<void>) => {
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    const opener = within(screen.getByLabelText('Session rail')).getByRole('button', { name: 'All bookmarks…' });
    opener.focus();
    fireEvent.click(opener);
    await pump();
    return opener;
  };

  it('opens from the sessions menu with this conversation\'s bookmarks and every saved session\'s, searchable and grouped', async () => {
    const { liveLabel, pump } = await bridged();
    await openFromMenu(pump);
    const dialog = screenDialog();

    expect(within(dialog).getByText(liveLabel)).toBeTruthy();
    expect(within(dialog).getAllByText(BOOKMARK_LABEL)).toHaveLength(2);
    expect(within(dialog).getByText('Bookmarks from all 2 saved sessions.')).toBeTruthy();
    expect(within(dialog).getByText('Tea party')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /^Rename / })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Delete / })).toBeNull();

    // Search covers labels and the whole message.
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search bookmarks' }), { target: { value: 'little door' } });
    expect(within(dialog).queryByText(liveLabel)).toBeNull();
    expect(within(dialog).getAllByText(BOOKMARK_LABEL)).toHaveLength(2);
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search bookmarks' }), { target: { value: '' } });

    // Group by session: one group per saved session, named by its title.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Session' }));
    const groups = [...dialog.querySelectorAll('.pm-ws-sessions-group-label')].map((label) => label.firstChild?.textContent?.trim());
    expect(groups).toEqual(['The garden', 'Tea party']);
  });

  it('opens from the Notes tab, and returns focus there when it closes', async () => {
    const { pump } = await bridged();
    const opener = await openFromNotes(pump);
    expect(screenDialog()).toBeTruthy();
    fireEvent.click(within(screenDialog()).getByRole('button', { name: 'Close bookmarks' }));
    await settleFocus();
    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('previews a saved turn and one of this conversation\'s over the screen, and returns focus to the row', async () => {
    const { reply, liveLabel, pump } = await bridged();
    await openFromMenu(pump);

    const savedPreview = within(screenDialog()).getAllByRole('button', { name: `Preview ${BOOKMARK_LABEL}` })[0];
    savedPreview.focus();
    fireEvent.click(savedPreview);
    await pump();
    let sheet = screen.getAllByRole('dialog').at(-1)!;
    expect(sheetText(sheet)).toBe(SAVED_REPLY);
    expect(within(sheet).getByText(/from the saved session “The garden”/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await settleFocus();
    expect(screenDialog()).toBeTruthy();
    expect(document.activeElement).toBe(savedPreview);

    fireEvent.click(within(screenDialog()).getByRole('button', { name: `Preview ${liveLabel}` }));
    await pump();
    sheet = screen.getAllByRole('dialog').at(-1)!;
    expect(sheetText(sheet)).toBe(reply.content);
    expect(within(sheet).getByText('A bookmarked message from this conversation, read-only.')).toBeTruthy();
  });

  it('shows one of this conversation\'s bookmarks in the thread, closing the screen', async () => {
    const { reply, liveLabel, pump } = await bridged();
    await openFromMenu(pump);
    fireEvent.click(within(screenDialog()).getByRole('button', { name: `Show ${liveLabel} in the thread` }));
    await settleFocus();
    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
    expect(document.activeElement?.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE)).toBe(reply.id);
  });

  it('opens a session only through Open\'s confirmation, and a declined one opens nothing', async () => {
    const { harness, pump } = await bridged();
    await openFromMenu(pump);
    fireEvent.click(within(screenDialog()).getByRole('button', { name: 'Open session Tea party' }));
    await pump();
    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
    const confirm = screen.getByRole('dialog', { name: 'Open “Tea party”?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await pump();
    expect(harness.persistence.openNamed).not.toHaveBeenCalled();

    await openFromMenu(pump);
    fireEvent.click(within(screenDialog()).getByRole('button', { name: 'Open session Tea party' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Open “Tea party”?' })).getByRole('button', { name: 'Open session' }));
    await pump();
    expect(harness.persistence.openNamed).toHaveBeenCalledWith('alice-1', expect.any(Function));
  });

  /** Open hydrates the saved room into the live session, as the coordinator would. */
  const openHydrates = (harness: Awaited<ReturnType<typeof bridged>>['harness'], saved: WorkshopPersistedSessionV2, then?: () => void) => {
    harness.persistence.openNamed.mockImplementation(async (sessionId: string) => {
      expect(sessionId).toBe(saved.sessionId);
      harness.session.hydrateCommittedState(saved.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
      then?.();
      return { restored: true, degradedConversationKeys: [] };
    });
  };

  const openAtBookmark = async (pump: () => Promise<void>, title: string) => {
    await openFromMenu(pump);
    const row = within(screenDialog()).getByText(title, { selector: '.pm-ws-session-row-meta span' }).closest('article')!;
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: `Open at bookmark ${BOOKMARK_LABEL}` }));
    fireEvent.click(within(screen.getByRole('dialog', { name: `Open “${title}”?` })).getByRole('button', { name: 'Open session' }));
    await pump();
  };

  it('opens the session at the bookmark: the opened room\'s bubble takes focus', async () => {
    const { harness, saved, pump } = await bridged();
    openHydrates(harness, saved[0]);
    await openAtBookmark(pump, 'Tea party');
    const replyId = bookmarkedRoom().replyId;
    expect(harness.session.readRoomLedger().some((turn) => turn.id === replyId)).toBe(true);
    expect(document.activeElement?.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE)).toBe(replyId);
  });

  it('previews the turn instead when it lies outside the opened room\'s window', async () => {
    const { harness, saved, pump } = await bridged();
    openHydrates(harness, saved[0], () => {
      for (let index = 0; index < WORKSHOP_SNAPSHOT_TURN_WINDOW; index += 1) {
        harness.session.recordSessionMarker('resume', `Session resumed, pass ${index}`);
      }
    });
    await openAtBookmark(pump, 'Tea party');
    const sheet = screen.getAllByRole('dialog').at(-1)!;
    expect(sheetText(sheet)).toBe(SAVED_REPLY);
    expect(within(sheet).getByText('Outside the loaded window')).toBeTruthy();
  });

  it('jumps nowhere when Open is refused', async () => {
    const { harness, reply, pump } = await bridged();
    harness.persistence.openNamed.mockRejectedValue(new Error('The saved file changed on disk.'));
    await openAtBookmark(pump, 'Tea party');
    expect(harness.session.readRoomLedger().some((turn) => turn.id === reply.id)).toBe(true);
    expect(document.activeElement?.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE) ?? null).toBeNull();
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('drops a late answer to an earlier request', async () => {
    const { pump } = await bridged();
    await openFromMenu(pump);
    const late = {
      type: MessageType.WORKSHOP_BOOKMARK_PAGE,
      source: 'extension.workshop',
      payload: {
        requestId: 'ws-bookmark-browser-stale-1',
        roomRevision: 0,
        page: {
          sessions: [{ sessionId: 'ghost', title: 'A stale page', savedAt: '', bookmarks: [] }],
          read: 99, unreadable: 0, unreadableSessions: [], remaining: 0
        }
      },
      timestamp: 1
    };
    await act(async () => { window.dispatchEvent(new MessageEvent('message', { data: late })); });
    expect(within(screenDialog()).getByText('Bookmarks from all 2 saved sessions.')).toBeTruthy();
  });
});
