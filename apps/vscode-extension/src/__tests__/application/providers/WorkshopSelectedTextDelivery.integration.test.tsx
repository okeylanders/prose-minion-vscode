/** @jest-environment jsdom */
/* eslint-disable no-restricted-imports -- this test drives the real Workshop webview receiver, selected-text handler, snapshot service and session, which the host-side barrel does not export (the webview ships in its own bundle). */

/**
 * Selected Text from the editor to the Workshop composer, end to end (ADR
 * 2026-11-14 D12, D14): the real WorkshopPanelProvider and its seed
 * delivery, the real WorkshopSelectedTextHandler over the real
 * EditorSelectionSnapshots (on a fake editor port) and a real
 * WorkshopSessionService, behind a small routing shim for the panel's
 * MessageHandler, and the production WorkshopApp as the receiver, with every
 * message from the host to the webview held in a queue the test releases.
 *
 * The command's seed stages only on a granted claim; an accept without a
 * grant stages nothing; a reloaded webview releases the old grant as
 * `reset`; `full` and `duplicate` are the Workshop's own refusals. The
 * toggle watches, the live pill is drawn from the pushed metadata, the send
 * names the snapshot and the room, and a hidden tab hears nothing. The
 * selection is from "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import * as vscode from 'vscode';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, Platform, WorkshopSeedOutcome } from '@prose-minion/core';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType
} from '@messages';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

/** What the shim's handler works over, shared across panels as the real bundle's services are. */
const shared: {
  session?: import('@/application/services/workshop/WorkshopSessionService').WorkshopSessionService;
  snapshots?: import('@/application/services/workshop/selection/EditorSelectionSnapshots').EditorSelectionSnapshots;
  readySession?: (pending: unknown[]) => unknown;
} = {};

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export names and stylesheet modules. */
jest.mock('@prose-minion/core', () => {
  // The whole barrel cannot load under jest, so the real modules it would export are required directly.
  const messages = jest.requireActual('@messages');
  const delivery = jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery');
  const { WorkshopSelectedTextHandler } = jest.requireActual(
    '@/application/handlers/domain/workshop/WorkshopSelectedTextHandler'
  );
  const { MessageRouter } = jest.requireActual('@handlers/MessageRouter');
  return {
    MessageType: messages.MessageType,
    coerceWebviewErrorText: messages.coerceWebviewErrorText,
    SURFACE_WORKSHOP: 'workshop',
    WORKSHOP_SEED_TIMEOUT_MS: delivery.WORKSHOP_SEED_TIMEOUT_MS,
    WorkshopSeedDelivery: delivery.WorkshopSeedDelivery,
    // The panel's MessageHandler: Selected Text's three routes reach the real handler; nothing else is routed.
    MessageHandler: jest.fn((_services: unknown, postMessage: (message: unknown) => Promise<void>) => {
      const session = shared.session!;
      const handler = new WorkshopSelectedTextHandler(shared.snapshots!, session, postMessage, { appendLine: jest.fn() }, {
        postSessionState: () => {
          void postMessage(shared.readySession!(session.getSnapshot().pendingMessageAttachments));
        },
        markDirty: jest.fn(),
        isRoomRunActive: () => false
      });
      const router = new MessageRouter();
      handler.registerRoutes(router, (type: string, route: (message: never) => Promise<void>) => router.register(type, route));
      const routed = [
        messages.MessageType.WORKSHOP_STAGE_SELECTED_TEXT,
        messages.MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT,
        messages.MessageType.WORKSHOP_SELECTED_TEXT_WATCH
      ];
      return {
        handleMessage: async (message: { type: string }) => {
          if (routed.includes(message.type)) {
            await router.route(message);
          }
        },
        setWorkshopSurfaceVisible: (visible: boolean) => handler.setVisible(visible),
        flushCachedResults: jest.fn(),
        dispose: () => handler.dispose()
      };
    })
  };
});
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));
jest.mock('@hooks/useVSCodeApi');
jest.mock('@/presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('@/presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('@/presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('@/presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('@/presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('@/presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
jest.mock('@/presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));
/* eslint-enable @typescript-eslint/naming-convention */

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { EditorSelectionSnapshots } from '@/application/services/workshop/selection/EditorSelectionSnapshots';
import {
  ALICE_TEXT,
  FakeEditorSelection,
  aliceSelection,
  recordingLog
} from '@/__tests__/application/services/workshop/selection/selectedTextFixtures';

const ROOM_REVISION = 4;
const readySession = (pendingMessageAttachments: unknown[] = []) => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      roomRevision: ROOM_REVISION,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments,
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      turns: [],
      turnRewindability: {},
      totalTurns: 0,
      truncatedTurns: 0,
      roomHasMemory: false,
      participants: {
        host: { personaId: 'jill', hasConversation: false },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});
shared.readySession = readySession;

interface HostPanel {
  visible: boolean;
  receive: (message: unknown) => void;
  disposed: () => void;
  viewStateChanged: () => void;
  outbox: unknown[];
}

describe('Selected Text from the Workshop panel provider to the Workshop composer', () => {
  let panels: HostPanel[];
  let fromWebview: Array<{ type: string; payload: Record<string, unknown> }>;
  let editor: FakeEditorSelection;
  let workshop: WorkshopPanelProvider;
  let unsettled: symbol;
  let unmountApp: () => void;
  let persisted: Record<string, unknown>;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
    shared.session = new WorkshopSessionService(() => 1);
    editor = new FakeEditorSelection();
    let minted = 0;
    shared.snapshots = new EditorSelectionSnapshots(editor, recordingLog(), { mintId: () => `snap-${++minted}` });
    panels = [];
    fromWebview = [];
    persisted = {};
    unsettled = Symbol('unsettled');
    const disposable = { dispose: jest.fn() };
    Object.assign(vscode.workspace, { onDidChangeConfiguration: jest.fn(() => disposable) });
    Object.assign(vscode.window, {
      createWebviewPanel: jest.fn(() => {
        const record = { visible: true, outbox: [] } as unknown as HostPanel;
        panels.push(record);
        return {
          get visible() {
            return record.visible;
          },
          webview: {
            options: {},
            html: '',
            postMessage: jest.fn(async (message: unknown) => {
              record.outbox.push(message);
              return true;
            }),
            onDidReceiveMessage: jest.fn((callback: (message: unknown) => void) => {
              record.receive = callback;
              return disposable;
            })
          },
          onDidChangeViewState: jest.fn((callback: () => void) => {
            record.viewStateChanged = callback;
            return disposable;
          }),
          onDidDispose: jest.fn((callback: () => void) => {
            record.disposed = callback;
            return disposable;
          }),
          reveal: jest.fn(),
          dispose: jest.fn()
        };
      })
    });
    workshop = new WorkshopPanelProvider(
      vscode.Uri.file('/extension'),
      {} as CoreServices,
      { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
      {} as Platform
    );
  });

  afterEach(() => {
    workshop.dispose();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    for (let round = 0; round < 5; round += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };
  const mountApp = () => {
    unmountApp = render(<WorkshopApp />).unmount;
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: readySession(shared.session!.getSnapshot().pendingMessageAttachments) }));
    });
  };
  const openWorkshop = async () => {
    workshop.openOrReveal();
    const panel = panels.at(-1)!;
    (useVSCodeApi as jest.Mock).mockReturnValue({
      postMessage: jest.fn((message: { type: string; payload: Record<string, unknown> }) => {
        fromWebview.push(message);
        panel.receive(message);
      }),
      getState: jest.fn(() => persisted),
      setState: jest.fn((state: Record<string, unknown>) => { persisted = state; })
    });
    mountApp();
    await flush();
    return panel;
  };
  const reloadWebview = async () => {
    unmountApp();
    mountApp();
    await flush();
  };
  const release = async (panel: HostPanel, count = panel.outbox.length) => {
    for (let index = 0; index < count; index += 1) {
      const message = panel.outbox.shift();
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
      });
      await flush();
    }
  };
  const drain = async (panel: HostPanel) => {
    while (panel.outbox.length > 0) {
      await release(panel, 1);
    }
  };
  const heldTypes = (panel: HostPanel) => panel.outbox.map((message) => (message as { type: string }).type);
  const staged = () => shared.session!.collectMessageAttachments();
  const sent = (type: MessageType) => fromWebview.filter((message) => message.type === type).map((message) => message.payload);
  const stagedPills = () => Array.from(document.querySelectorAll('.pm-ws-comp-attachment:not(.pm-ws-comp-attachment-live)'));
  const livePill = () => document.querySelector('.pm-ws-comp-attachment-live');
  /** The command: capture at the gesture, then offer the snapshot's id. */
  const addSelection = async (over = {}) => {
    editor.select(aliceSelection(over));
    const snapshot = shared.snapshots!.capture()!;
    let outcome: WorkshopSeedOutcome | symbol = unsettled;
    void workshop.stageSelectedText(snapshot.id).then((settled) => {
      outcome = settled;
    });
    await flush();
    return () => outcome;
  };

  describe('the command\'s seed', () => {
    it('claims before it stages: the offer carries no text, and the pill appears only after the grant', async () => {
      const panel = await openWorkshop();
      const outcome = await addSelection();
      expect(panel.outbox).toEqual([expect.objectContaining({
        type: MessageType.WORKSHOP_SELECTED_TEXT_OFFERED,
        payload: { deliveryId: expect.any(String) }
      })]);

      await release(panel);
      expect(staged()).toEqual([]);
      expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
      await drain(panel);
      expect(staged()).toEqual([expect.objectContaining({ label: 'Selected Text', content: ALICE_TEXT })]);
      expect(outcome()).toEqual({ opened: true });
      expect(stagedPills().map((pill) => pill.textContent)).toEqual([expect.stringContaining('alice-ch3.md · lines 40–44')]);
      expect(sent(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT)).toEqual([
        { deliveryId: expect.any(String), receiver: sent(MessageType.WORKSHOP_SEED_RECEIVER).at(-1)!.receiver }
      ]);
      // Nothing the webview was sent, and nothing it sent, holds the selection's text.
      expect(JSON.stringify(fromWebview)).not.toContain('hookah');
    });

    it('drops an accept for an offer whose claim was never granted, and the offer still stages through its own claim', async () => {
      const panel = await openWorkshop();
      const outcome = await addSelection();
      const offered = panel.outbox[0] as { payload: { deliveryId: string } };
      panel.receive({
        type: MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT,
        source: 'webview.workshop.selected-text',
        payload: { deliveryId: offered.payload.deliveryId, receiver: sent(MessageType.WORKSHOP_SEED_RECEIVER).at(-1)!.receiver },
        timestamp: 0
      });
      await flush();
      expect(staged()).toEqual([]);
      await drain(panel);
      expect(outcome()).toEqual({ opened: true });
      expect(staged()).toHaveLength(1);
    });

    it('a reloaded receiver: the old grant is released as reset, nothing stages, and the next selection stages', async () => {
      const panel = await openWorkshop();
      const first = await addSelection();
      await release(panel);
      expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
      await reloadWebview();
      expect(first()).toEqual({ opened: false, reason: 'reset' });
      await drain(panel);
      expect(staged()).toEqual([]);

      const second = await addSelection({ startLine: 50, endLine: 51 });
      await drain(panel);
      expect(second()).toEqual({ opened: true });
      expect(staged().map((attachment) => attachment.selectedText?.startLine)).toEqual([50]);
    });

    it('refuses the same snapshot as a duplicate, and an eighth attachment as full', async () => {
      const panel = await openWorkshop();
      await addSelection();
      await drain(panel);
      // The same selection captured again is the same snapshot.
      const again = await addSelection();
      await drain(panel);
      expect(again()).toEqual({ opened: false, reason: 'duplicate' });
      expect(staged()).toHaveLength(1);

      for (let line = 2; line <= 7; line += 1) {
        await addSelection({ startLine: line, endLine: line });
        await drain(panel);
      }
      expect(staged()).toHaveLength(7);
      const over = await addSelection({ startLine: 90, endLine: 91 });
      await drain(panel);
      expect(over()).toEqual({ opened: false, reason: 'full' });
      expect(staged()).toHaveLength(7);
    });
  });

  describe('the toggle', () => {
    const toggle = () => screen.getByRole('switch', { name: 'Include selected text' });
    const typeAndSend = (text: string) => {
      const composer = screen.getAllByRole('textbox').find((element) => element.tagName === 'TEXTAREA') as HTMLTextAreaElement;
      fireEvent.change(composer, { target: { value: text } });
      fireEvent.keyDown(composer, { key: 'Enter' });
    };

    it('is off by default: nothing is watched, pushed or sent with a message', async () => {
      const panel = await openWorkshop();
      expect(toggle().getAttribute('aria-checked')).toBe('false');
      editor.change(aliceSelection());
      act(() => { jest.advanceTimersByTime(1_000); });
      await drain(panel);
      expect(sent(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([]);
      expect(livePill()).toBeNull();
      typeAndSend('No selection with this.');
      expect(sent(MessageType.WORKSHOP_SEND_MESSAGE)).toEqual([{ text: 'No selection with this.' }]);
    });

    it('shows the selection live as a pill, and the send names the snapshot it showed and the room', async () => {
      const panel = await openWorkshop();
      editor.select(aliceSelection());
      fireEvent.click(toggle());
      await flush();
      expect(sent(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }]);
      expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SELECTED_TEXT_CURRENT]);
      // The push is metadata and a one-line preview: never the whole text.
      expect(JSON.stringify(panel.outbox)).not.toContain('hookah');
      await drain(panel);
      expect(livePill()?.textContent).toContain('alice-ch3.md · lines 40–44');
      expect(persisted.includeSelectedText).toBe(true);

      // The selection moves on in the editor; its push has not reached the webview yet.
      act(() => { jest.advanceTimersByTime(1_000); });
      editor.change(aliceSelection({ text: 'Who are YOU?', startLine: 50, endLine: 50 }));
      typeAndSend('Is the silence doing enough here?');
      expect(sent(MessageType.WORKSHOP_SEND_MESSAGE)).toEqual([
        { text: 'Is the silence doing enough here?', selectedTextSnapshotId: 'snap-1', roomRevision: ROOM_REVISION }
      ]);
      // The host still holds what the pill showed.
      expect(shared.snapshots!.find('snap-1')?.text).toBe(ALICE_TEXT);

      await drain(panel);
      expect(livePill()?.textContent).toContain('line 50');
      fireEvent.click(toggle());
      await flush();
      expect(sent(MessageType.WORKSHOP_SELECTED_TEXT_WATCH)).toEqual([{ on: true }, { on: false }]);
      expect(livePill()).toBeNull();
    });

    it('hides the live pill when its snapshot is staged by hand: one selection, one pill', async () => {
      const panel = await openWorkshop();
      editor.select(aliceSelection());
      fireEvent.click(toggle());
      await flush();
      await drain(panel);
      expect(livePill()).not.toBeNull();

      const outcome = await addSelection();
      await drain(panel);
      expect(outcome()).toEqual({ opened: true });
      expect(stagedPills()).toHaveLength(1);
      expect(livePill()).toBeNull();
    });

    it('pushes nothing to a hidden tab, and the current selection once when it is visible again', async () => {
      const panel = await openWorkshop();
      editor.select(aliceSelection());
      fireEvent.click(toggle());
      await flush();
      await drain(panel);

      panel.visible = false;
      panel.viewStateChanged();
      act(() => { jest.advanceTimersByTime(1_000); });
      editor.change(aliceSelection({ text: 'Who are YOU?', startLine: 50, endLine: 50 }));
      act(() => { jest.advanceTimersByTime(1_000); });
      expect(heldTypes(panel)).not.toContain(MessageType.WORKSHOP_SELECTED_TEXT_CURRENT);

      panel.visible = true;
      panel.viewStateChanged();
      await flush();
      expect(heldTypes(panel).filter((type) => type === MessageType.WORKSHOP_SELECTED_TEXT_CURRENT)).toHaveLength(1);
      await drain(panel);
      expect(livePill()?.textContent).toContain('line 50');
    });
  });
});
