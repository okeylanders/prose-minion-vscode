/** @jest-environment jsdom */
/* eslint-disable no-restricted-imports -- this test drives the real Workshop webview receiver, tile handler and session, which the host-side barrel does not export (the webview ships in its own bundle). */

/**
 * A Lightbox tile staged in the Workshop, end to end (ADR 2026-10-19 D11;
 * Lightbox Slice 4): the real WorkshopPanelProvider and its seed delivery,
 * the real WorkshopLightboxTileHandler over a real WorkshopSessionService
 * behind a small routing shim for the panel's MessageHandler, and the
 * production WorkshopApp as the receiver, with every message from the host
 * to the webview held in a queue the test releases.
 *
 * A tile stages only on a granted claim; one that timed out, was replaced or
 * lost its panel never stages, even when its message was already sent; a
 * grant crossing the panel's close stays `closed`; a reloaded webview
 * (F-08) releases the old grant as `reset`, and the next tile stages. An
 * open sheet and the composer's draft are never disturbed. The reading is of
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import * as vscode from 'vscode';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, Platform, WORKSHOP_SEED_TIMEOUT_MS, WorkshopSeedOutcome } from '@prose-minion/core';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type WorkshopLightboxTile
} from '@messages';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

/** The one session the shim's tile handler stages into, shared across panels as the real bundle's is. */
const shared: {
  session?: import('@/application/services/workshop/WorkshopSessionService').WorkshopSessionService;
  /** The Workshop session state the shim posts, with the session's staged attachments. */
  readySession?: (pending: unknown[]) => unknown;
} = {};

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export names and stylesheet modules. */
jest.mock('@prose-minion/core', () => {
  // The whole barrel cannot load under jest, so the real modules it would export are required directly.
  const messages = jest.requireActual('@messages');
  const delivery = jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery');
  const { WorkshopLightboxTileHandler } = jest.requireActual(
    '@/application/handlers/domain/workshop/WorkshopLightboxTileHandler'
  );
  const { MessageRouter } = jest.requireActual('@handlers/MessageRouter');
  return {
    MessageType: messages.MessageType,
    coerceWebviewErrorText: messages.coerceWebviewErrorText,
    SURFACE_WORKSHOP: 'workshop',
    WORKSHOP_SEED_TIMEOUT_MS: delivery.WORKSHOP_SEED_TIMEOUT_MS,
    WorkshopSeedDelivery: delivery.WorkshopSeedDelivery,
    // The panel's MessageHandler: the tile's two routes reach the real tile handler; nothing else is routed.
    MessageHandler: jest.fn((_services: unknown, postMessage: (message: unknown) => Promise<void>) => {
      const log = { appendLine: jest.fn() };
      const session = shared.session!;
      const postSessionState = () => {
        void postMessage(shared.readySession!(session.getSnapshot().pendingMessageAttachments));
      };
      const handler = new WorkshopLightboxTileHandler(session, postMessage, log, {
        postSessionState,
        markDirty: jest.fn(),
        isRoomRunActive: () => false
      });
      const router = new MessageRouter();
      handler.registerRoutes(router, (type: string, route: (message: never) => Promise<void>) => router.register(type, route));
      const routed = [messages.MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE, messages.MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE];
      return {
        handleMessage: async (message: { type: string }) => {
          if (routed.includes(message.type)) {
            await router.route(message);
          }
        },
        flushCachedResults: jest.fn(),
        dispose: jest.fn()
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

const DRAFT = 'Down, down, down. Would the fall never come to an end!';

const tile = (tileId: string, title: string): WorkshopLightboxTile => ({
  origin: 'lightbox',
  boardId: 'board-1',
  tileId,
  kindLabel: 'Open door',
  lensLabel: 'Spark',
  title,
  claim: 'What if the jar labelled ORANGE MARMALADE came back, full this time?',
  points: [],
  quotes: [{ paragraph: 5, text: 'it was labelled “ORANGE MARMALADE”' }],
  sourceLabel: 'Drafts/alice-chapter-1.md'
});
const JAR = tile('tile-c-spark-1', 'The empty jar');
const LATE = tile('tile-c-spark-2', 'Late for what?');

const readySession = (pendingMessageAttachments: unknown[] = []) => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      roomRevision: 1,
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
  outbox: unknown[];
}

describe('a Lightbox tile from the Workshop panel provider to the Workshop composer', () => {
  let panels: HostPanel[];
  let fromWebview: unknown[];
  let workshop: WorkshopPanelProvider;
  let unsettled: symbol;
  let unmountApp: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
    shared.session = new WorkshopSessionService(() => 1);
    panels = [];
    fromWebview = [];
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
          onDidChangeViewState: jest.fn(() => disposable),
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
      window.dispatchEvent(new MessageEvent('message', { data: readySession() }));
    });
  };
  const openWorkshop = async () => {
    workshop.openOrReveal();
    const panel = panels.at(-1)!;
    (useVSCodeApi as jest.Mock).mockReturnValue({
      postMessage: jest.fn((message: unknown) => {
        fromWebview.push(message);
        panel.receive(message);
      }),
      getState: jest.fn(() => ({})),
      setState: jest.fn()
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
  /** Release until nothing more is held, as an attentive webview would see it. */
  const drain = async (panel: HostPanel) => {
    while (panel.outbox.length > 0) {
      await release(panel, 1);
    }
  };
  const heldTypes = (panel: HostPanel) => panel.outbox.map((message) => (message as { type: string }).type);
  const staged = () => shared.session!.getSnapshot().pendingMessageAttachments.map((attachment) => attachment.label);
  const pill = (label: string) => screen.queryByText(label, { selector: '.pm-ws-comp-attachment-label' });
  const answers = () => fromWebview
    .map((message) => message as { type: string; payload: { kind: string } })
    .filter((message) => message.type === MessageType.WORKSHOP_SEED_ANSWER && message.payload.kind === 'lightbox-tile')
    .map((message) => message.payload);
  const offer = async (item: WorkshopLightboxTile) => {
    let outcome: WorkshopSeedOutcome | symbol = unsettled;
    void workshop.stageLightboxTile(item).then((settled) => {
      outcome = settled;
    });
    await flush();
    return () => outcome;
  };

  it('stages a tile its webview claims in time, as a pill above the composer, and answers staged', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(JAR);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED]);

    // Offered, then claimed; nothing is staged until the grant.
    await release(panel);
    expect(staged()).toEqual([]);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    await drain(panel);
    expect(staged()).toEqual(['Lightbox Open door: The empty jar']);
    expect(pill('Lightbox Open door: The empty jar')).not.toBeNull();
    expect(outcome()).toEqual({ opened: true });
    expect(answers()).toEqual([expect.objectContaining({ deliveryId: expect.any(String), opened: true })]);
  });

  it('leaves an open sheet and the composer\'s draft as they were while a tile stages behind them', async () => {
    const panel = await openWorkshop();
    const composer = screen.getAllByRole('textbox').find((element) => element.tagName === 'TEXTAREA') as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: DRAFT } });
    fireEvent.click(screen.getAllByRole('button', { name: /Add text/ })[0]);
    const sheet = screen.getByRole('dialog', { name: /text/i });
    const sheetText = within(sheet).getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(sheetText, { target: { value: 'A note in progress.' } });

    const outcome = await offer(JAR);
    await drain(panel);
    expect(outcome()).toEqual({ opened: true });
    expect(screen.getAllByRole('dialog')).toEqual([sheet]);
    expect(sheetText.value).toBe('A note in progress.');
    expect(composer.value).toBe(DRAFT);
    expect(staged()).toEqual(['Lightbox Open door: The empty jar']);
  });

  it('never stages a tile that timed out after its offer was sent', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(JAR);
    act(() => {
      jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
    });
    await flush();
    expect(outcome()).toEqual({ opened: false, reason: 'timeout' });
    await drain(panel);
    expect(staged()).toEqual([]);
    expect(answers()).toEqual([]);
  });

  it('delivers A then B late and in order: only B stages, and A is never answered', async () => {
    const panel = await openWorkshop();
    const first = await offer(JAR);
    const second = await offer(LATE);
    expect(first()).toEqual({ opened: false, reason: 'replaced' });
    expect(heldTypes(panel)).toEqual([
      MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED,
      MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED
    ]);
    await drain(panel);
    expect(staged()).toEqual(['Lightbox Open door: Late for what?']);
    expect(second()).toEqual({ opened: true });
    expect(answers()).toHaveLength(1);
  });

  it('a newer tile waits behind a granted one, then stages after it (a grant cannot be revoked)', async () => {
    const panel = await openWorkshop();
    const first = await offer(JAR);
    await release(panel);
    // A's grant is posted; B is offered while it is in flight.
    const second = await offer(LATE);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    await drain(panel);
    expect(first()).toEqual({ opened: true });
    expect(second()).toEqual({ opened: true });
    expect(staged()).toEqual(['Lightbox Open door: The empty jar', 'Lightbox Open door: Late for what?']);
  });

  it('keeps a grant that crossed the panel\'s closing from staging anything', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(JAR);
    await release(panel);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    panel.disposed();
    await flush();
    expect(outcome()).toEqual({ opened: false, reason: 'closed' });
    await drain(panel);
    expect(staged()).toEqual([]);
    expect(outcome()).toEqual({ opened: false, reason: 'closed' });
  });

  it('refuses a tile already waiting above the composer as a duplicate', async () => {
    const panel = await openWorkshop();
    await offer(JAR);
    await drain(panel);
    const again = await offer(JAR);
    await drain(panel);
    expect(again()).toEqual({ opened: false, reason: 'duplicate' });
    expect(staged()).toEqual(['Lightbox Open door: The empty jar']);
  });

  describe('when the webview is replaced on the same panel (PR #150 F-08)', () => {
    it('reload after claim: the old grant is released as reset, nothing stages, and the next tile stages', async () => {
      const panel = await openWorkshop();
      const first = await offer(JAR);
      await release(panel);
      expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
      await reloadWebview();
      expect(first()).toEqual({ opened: false, reason: 'reset' });
      await drain(panel);
      expect(staged()).toEqual([]);

      const second = await offer(LATE);
      await drain(panel);
      expect(second()).toEqual({ opened: true });
      expect(staged()).toEqual(['Lightbox Open door: Late for what?']);
    });

    it('reload after the grant was acted on: the session holds the tile, the lost answer settles as reset, and the queue moves on', async () => {
      const panel = await openWorkshop();
      const first = await offer(JAR);
      // Offer, then grant: the webview accepts and the host stages it; its "staged" word is held.
      await release(panel);
      await release(panel);
      expect(staged()).toEqual(['Lightbox Open door: The empty jar']);
      expect(heldTypes(panel)).toContain(MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED);
      await reloadWebview();
      expect(first()).toEqual({ opened: false, reason: 'reset' });
      // The old realm's word reaches the fresh webview, which holds no grant for it.
      await drain(panel);
      expect(answers()).toEqual([]);

      const second = await offer(LATE);
      await drain(panel);
      expect(second()).toEqual({ opened: true });
      expect(staged()).toEqual(['Lightbox Open door: The empty jar', 'Lightbox Open door: Late for what?']);
    });
  });
});
