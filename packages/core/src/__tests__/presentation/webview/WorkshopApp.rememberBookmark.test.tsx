/** @jest-environment jsdom */

/**
 * "Remember this" on a bookmark through the real App and the real host
 * (Bookmark Recall Slice 3, ADR 2026-11-05 D9): the App's messages routed
 * through the real router, slice composition, session, recall service and
 * Project Memory library, and the host's replies delivered back.
 *
 * - A saved session's row opens the sheet "From “Title”", prefilled with
 *   the host's message, and saves the session and turn as the source.
 * - This conversation's row on the Bookmarks screen saves from its message,
 *   naming the room.
 * - A Notes row in the window is Save to memory… on its bubble; one outside
 *   the window asks the host for its message first.
 *
 * *Alice*, made-up text.
 */

import './support/jsdomTextEncoding';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { createWorkshopRouteTestHarness, message } from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';
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
  MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS,
  MessageType.WORKSHOP_REQUEST_TURN_PREVIEW,
  MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY,
  MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY,
  MessageType.WORKSHOP_MEMORY_ESTIMATE
]);
const TO_WEBVIEW = new Set<MessageType>([
  MessageType.WORKSHOP_SESSION_STATE,
  MessageType.WORKSHOP_BOOKMARK_PAGE,
  MessageType.WORKSHOP_LIVE_BOOKMARKS,
  MessageType.WORKSHOP_TURN_PREVIEW,
  MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
  MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT,
  MessageType.ERROR
]);

const SAVED_REPLY = 'HOST-REPLY: Alice opens the little door.';
const LIVE_LABEL = 'The Hatter wants tea';

/** One saved session as a corpus port, with the scripted room's bookmarked reply. */
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
    readPagedSession: jest.fn(async (cursor: string, sessionId: string) =>
      (cursor === sessionId ? sessions.find((session) => session.sessionId === sessionId) : undefined)),
    listPage: jest.fn(async () => ({ entries: sessions.map((session) => ({ cursor: session.sessionId, summary: summary(session) })), remaining: 0 }))
  };
}

describe('WorkshopApp Remember this on a bookmark, against the real host (ADR 2026-11-05 D9)', () => {
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

  const bridged = async (options: { outsideWindow?: boolean } = {}) => {
    let clock = 10_000;
    const saved = [bookmarkedCheckpoint('alice-1', 'Tea party')];
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
    if (options.outsideWindow) {
      for (let index = 0; index < WORKSHOP_SNAPSHOT_TURN_WINDOW; index += 1) {
        harness.session.recordSessionMarker('resume', `Session resumed, pass ${index}`);
      }
    }
    // The rename posts a snapshot: the one the App opens with.
    const bookmarkId = harness.session.getSnapshot().bookmarks[0].id;
    await harness.router.route(message(MessageType.WORKSHOP_RENAME_BOOKMARK, { requestId: 'r-0', bookmarkId, label: LIVE_LABEL }) as never);

    let delivered = 0;
    const pump = async () => {
      for (let round = 0; round < 4; round += 1) {
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
    return { harness, reply, pump };
  };

  const openBrowser = async (pump: () => Promise<void>) => {
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    fireEvent.click(screen.getByText('Bookmarks…').closest('button') as HTMLButtonElement);
    await pump();
    return screen.getByRole('dialog', { name: 'Bookmarks' });
  };
  const memorySheet = () => screen.getByRole('dialog', { name: 'Save to project memory' });
  const fillAndSave = async (pump: () => Promise<void>) => {
    const sheet = memorySheet();
    fireEvent.change(within(sheet).getByRole('textbox', { name: /^Title/ }), { target: { value: 'Alice finds the door' } });
    fireEvent.change(within(sheet).getByRole('textbox', { name: /^Summary/ }), { target: { value: 'Alice opens the little door.' } });
    await pump();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save to memory' }));
    await pump();
  };
  const savedMemories = async (harness: Awaited<ReturnType<typeof bridged>>['harness']) => {
    const listing = await harness.memory.store.list();
    return listing.kind === 'listed' ? listing.memories.map((entry) => entry.memory) : [];
  };

  it('a saved session\'s row opens the sheet from “Title”, prefilled by the host, and saves its session and turn as the source', async () => {
    const { harness, pump } = await bridged();
    const dialog = await openBrowser(pump);
    const row = within(dialog).getByText('Tea party', { selector: '.pm-ws-session-row-meta span' }).closest('article') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: `Remember this: ${BOOKMARK_LABEL}` }));
    await pump();

    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
    const sheet = memorySheet();
    expect(within(sheet).getByText(/^From “Tea party”, /)).toBeTruthy();
    expect((within(sheet).getByRole('textbox', { name: /^Note/ }) as HTMLTextAreaElement).value).toBe(SAVED_REPLY);

    await fillAndSave(pump);
    expect(screen.queryByRole('dialog', { name: 'Save to project memory' })).toBeNull();
    const [memory] = await savedMemories(harness);
    expect(memory).toMatchObject({ origin: 'writer', sourceSession: 'alice-1', sourceTurns: [bookmarkedRoom().replyId], title: 'Alice finds the door' });
  });

  it('this conversation\'s row on the Bookmarks screen saves from its message, naming the room', async () => {
    const { harness, reply, pump } = await bridged();
    const dialog = await openBrowser(pump);
    fireEvent.click(within(dialog).getByRole('button', { name: `Remember this: ${LIVE_LABEL}` }));
    await pump();
    expect((within(memorySheet()).getByRole('textbox', { name: /^Note/ }) as HTMLTextAreaElement).value).toBe(reply.content);

    const sends = jest.spyOn(harness.router, 'route');
    await fillAndSave(pump);
    const save = sends.mock.calls.map(([entry]) => entry as { type: MessageType; payload: Record<string, unknown> })
      .find((entry) => entry.type === MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY)!;
    expect(save.payload).toMatchObject({ turnId: reply.id, roomRevision: harness.session.readRoomRevision() });
    const [memory] = await savedMemories(harness);
    expect(memory).toMatchObject({ origin: 'writer', sourceSession: 'live-room-0001', sourceTurns: [reply.id] });
  });

  it('a Notes row in the window is Save to memory… on its bubble', async () => {
    const { harness, reply, pump } = await bridged();
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    fireEvent.click(within(screen.getByLabelText('Session rail')).getByRole('button', { name: `Remember this: ${LIVE_LABEL}` }));
    await pump();
    expect((within(memorySheet()).getByRole('textbox', { name: /^Note/ }) as HTMLTextAreaElement).value).toBe(reply.content);
    expect(within(memorySheet()).getByText(/in this conversation/)).toBeTruthy();

    await fillAndSave(pump);
    const [memory] = await savedMemories(harness);
    expect(memory).toMatchObject({ sourceTurns: [reply.id] });
  });

  it('a Notes row outside the window asks the host for its message, then saves it', async () => {
    const { harness, reply, pump } = await bridged({ outsideWindow: true });
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    const rail = within(screen.getByLabelText('Session rail'));
    expect(rail.getByText('opens in reader')).toBeTruthy();
    fireEvent.click(rail.getByRole('button', { name: `Remember this: ${LIVE_LABEL}` }));
    await pump();
    expect((within(memorySheet()).getByRole('textbox', { name: /^Note/ }) as HTMLTextAreaElement).value).toBe(reply.content);

    await fillAndSave(pump);
    const [memory] = await savedMemories(harness);
    expect(memory).toMatchObject({ sourceSession: 'live-room-0001', sourceTurns: [reply.id] });
  });
});
