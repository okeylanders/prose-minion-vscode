/** @jest-environment jsdom */
/* eslint-disable no-restricted-imports -- this test drives the real Workshop webview receiver and Lexical Gravity handler, which the host-side barrel does not export (the webview ships in its own bundle). */

/**
 * Seed delivery end to end (PR #150 F-03 re-review): the real
 * WorkshopPanelProvider, the real WorkshopLexicalGravityHandler behind a
 * small routing shim for the panel's MessageHandler, and the production
 * WorkshopApp as the receiver, with every message from the host to the
 * webview held in a queue the test releases. A seed whose message was
 * already sent when it timed out, was replaced, or lost its panel never
 * opens; the newer seed opens with its own subject. Fields are from
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */

import * as React from 'react';
import * as vscode from 'vscode';
import { act, render, screen } from '@testing-library/react';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, Platform, WORKSHOP_SEED_TIMEOUT_MS, WorkshopSeedOutcome } from '@prose-minion/core';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType
} from '@messages';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export names and stylesheet modules. */
jest.mock('@prose-minion/core', () => {
  // The whole barrel cannot load under jest, so the real modules it would export are required directly.
  const messages = jest.requireActual('@messages');
  const delivery = jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery');
  const { WorkshopLexicalGravityHandler } = jest.requireActual(
    '@/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler'
  );
  const { MessageRouter } = jest.requireActual('@handlers/MessageRouter');
  return {
    MessageType: messages.MessageType,
    coerceWebviewErrorText: messages.coerceWebviewErrorText,
    SURFACE_WORKSHOP: 'workshop',
    WORKSHOP_SEED_TIMEOUT_MS: delivery.WORKSHOP_SEED_TIMEOUT_MS,
    WorkshopSeedDelivery: delivery.WorkshopSeedDelivery,
    // The panel's MessageHandler: the seed's route reaches the real Lexical Gravity handler; nothing else is routed.
    MessageHandler: jest.fn((_services: unknown, postMessage: (message: unknown) => Promise<void>) => {
      const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
      const handler = new WorkshopLexicalGravityHandler({}, {}, postMessage, log);
      const router = new MessageRouter();
      handler.registerRoutes(router, jest.fn());
      return {
        handleMessage: async (message: { type: string }) => {
          if (message.type === messages.MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD) {
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

const field = (name: string, terms: string[]) => ({
  origin: 'lightbox' as const,
  field: name,
  metaphor: `${name} as the chapter's borrowed field.`,
  terms: terms.map((term) => ({ term, count: 2 })),
  sourceLabel: 'Drafts/alice-chapter-1.md'
});
const TELESCOPE = field('Telescope', ['telescope', 'shutting']);
const CANDLE = field('Candle', ['candle', 'flame']);

interface HostPanel {
  visible: boolean;
  receive: (message: unknown) => void;
  disposed: () => void;
  /** Messages from the host to this panel's webview, held until released. */
  outbox: unknown[];
}

const readySession = {
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
      pendingMessageAttachments: [],
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
};

describe('seed delivery from the Workshop panel provider to the Workshop webview', () => {
  let panels: HostPanel[];
  let fromWebview: unknown[];
  let workshop: WorkshopPanelProvider;
  let unsettled: symbol;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
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

  /** Let the provider's and handler's promise chains run. */
  const flush = async () => {
    for (let round = 0; round < 5; round += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };
  /** Open the Workshop and its webview; the webview's first message makes the panel ready. */
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
    render(<WorkshopApp />);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: readySession }));
    });
    await flush();
    return panel;
  };
  /** Deliver the next held message, or all of them, to the webview, in the order they were sent. */
  const release = async (panel: HostPanel, count = panel.outbox.length) => {
    for (let index = 0; index < count; index += 1) {
      const message = panel.outbox.shift();
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
      });
      await flush();
    }
  };
  const heldTypes = (panel: HostPanel) => panel.outbox.map((message) => (message as { type: string }).type);
  const sheet = () => screen.queryByRole('dialog', { name: /Lexical Gravity/ });
  const subject = () => (sheet()?.querySelector('.pm-ws-lg-lookup input') as HTMLInputElement | null)?.value;
  const answers = () => fromWebview
    .map((message) => message as { type: string; payload: unknown })
    .filter((message) => message.type === MessageType.WORKSHOP_SEED_ANSWER)
    .map((message) => message.payload);
  const offer = async (seed: typeof TELESCOPE) => {
    let outcome: WorkshopSeedOutcome | symbol = unsettled;
    void workshop.seedLexicalGravityBuild(seed).then((settled) => {
      outcome = settled;
    });
    await flush();
    return () => outcome;
  };

  it('opens a seed its webview claims in time, with its own subject', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(TELESCOPE);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED]);

    // The seed arrives and is claimed; nothing opens until the grant does.
    await release(panel);
    expect(sheet()).toBeNull();
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    await release(panel);
    expect(subject()).toMatch(/^Telescope/);
    expect(outcome()).toEqual({ opened: true });
  });

  it('never opens a seed that timed out after its message was sent', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(TELESCOPE);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED]);
    act(() => {
      jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
    });
    await flush();
    expect(outcome()).toEqual({ opened: false, reason: 'timeout' });

    // The held seed arrives now; its claim is denied and the webview drops it.
    await release(panel);
    await release(panel);
    expect(sheet()).toBeNull();
    expect(answers()).toEqual([]);
    expect(outcome()).toEqual({ opened: false, reason: 'timeout' });
  });

  it('never opens a replaced seed whose message was already sent', async () => {
    const panel = await openWorkshop();
    const first = await offer(TELESCOPE);
    const second = await offer(CANDLE);
    expect(first()).toEqual({ opened: false, reason: 'replaced' });

    // The replaced seed arrives first and is claimed: it does not open.
    await release(panel, 1);
    expect(sheet()).toBeNull();
    expect(answers()).toEqual([]);
    // Then the newer seed, and the denial of the replaced one's claim.
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED, MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    await release(panel);
    expect(sheet()).toBeNull();
    expect(second()).toBe(unsettled);

    // The newer seed's grant opens it, with its own subject.
    await release(panel);
    expect(subject()).toMatch(/^Candle/);
    expect(second()).toEqual({ opened: true });
    expect(answers()).toEqual([expect.objectContaining({ opened: true })]);
  });

  it('delivers A then B in order, late: B opens with B\'s subject, and A is never opened or answered', async () => {
    const panel = await openWorkshop();
    const first = await offer(TELESCOPE);
    const second = await offer(CANDLE);
    expect(heldTypes(panel)).toEqual([
      MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
      MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED
    ]);

    // Both seeds, then both claim results, in the order they were sent.
    await release(panel);
    await release(panel);
    expect(subject()).toMatch(/^Candle/);
    expect(first()).toEqual({ opened: false, reason: 'replaced' });
    expect(second()).toEqual({ opened: true });
    expect(answers()).toEqual([expect.objectContaining({ opened: true })]);
  });

  it('never opens a seed in a panel that closed: its late claim is not granted, and a reopened Workshop gets nothing', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(TELESCOPE);
    panel.disposed();
    await flush();
    expect(outcome()).toEqual({ opened: false, reason: 'closed' });

    // The closed panel's webview gets its seed late and claims it; no grant comes back.
    await release(panel);
    expect(panel.outbox).toEqual([]);
    expect(sheet()).toBeNull();
    expect(answers()).toEqual([]);

    workshop.openOrReveal();
    const reopened = panels.at(-1)!;
    expect(reopened).not.toBe(panel);
    reopened.receive({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 });
    await flush();
    expect(reopened.outbox).toEqual([]);
  });

  it('keeps a grant that crossed the panel\'s closing from turning a closed handoff into an opened one', async () => {
    const panel = await openWorkshop();
    const outcome = await offer(TELESCOPE);
    // The seed arrives and is claimed; the grant is held when the panel closes.
    await release(panel);
    expect(heldTypes(panel)).toEqual([MessageType.WORKSHOP_SEED_CLAIM_RESULT]);
    panel.disposed();
    await flush();
    expect(outcome()).toEqual({ opened: false, reason: 'closed' });

    await release(panel);
    expect(outcome()).toEqual({ opened: false, reason: 'closed' });
    workshop.openOrReveal();
    const reopened = panels.at(-1)!;
    reopened.receive({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 });
    await flush();
    expect(reopened.outbox).toEqual([]);
  });
});
