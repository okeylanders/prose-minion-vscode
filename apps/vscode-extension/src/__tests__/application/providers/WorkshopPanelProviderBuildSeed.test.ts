import * as vscode from 'vscode';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, MessageHandler, MessageType, Platform, WORKSHOP_SEED_TIMEOUT_MS } from '@prose-minion/core';

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export and enum member names. */
jest.mock('@prose-minion/core', () => {
  // The real seed delivery and message types; only the panel's MessageHandler is a
  // mock. The whole barrel cannot load under jest, so these modules are required directly.
  const delivery = jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery');
  return {
    MessageType: jest.requireActual('@messages').MessageType,
    SURFACE_WORKSHOP: 'workshop',
    WORKSHOP_SEED_TIMEOUT_MS: delivery.WORKSHOP_SEED_TIMEOUT_MS,
    WorkshopSeedDelivery: delivery.WorkshopSeedDelivery,
    MessageHandler: jest.fn(() => ({
      handleMessage: jest.fn().mockResolvedValue(undefined),
      flushCachedResults: jest.fn(),
      dispose: jest.fn()
    }))
  };
});
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));
/* eslint-enable @typescript-eslint/naming-convention */

const seed = {
  origin: 'lightbox' as const,
  field: 'Telescope',
  metaphor: 'The body as an instrument that folds.',
  terms: [{ term: 'shutting up', count: 2 }],
  sourceLabel: 'Drafts/alice-1.md'
};

interface MockHandler {
  handleMessage: jest.Mock;
  flushCachedResults: jest.Mock;
}

/** One mocked Workshop tab: its callbacks stay callable after it closes, as a late VS Code event would be. */
interface MockPanel {
  visible: boolean;
  handler: MockHandler;
  receive: (message: unknown) => void;
  viewStateChanged: () => void;
  disposed: () => void;
  dispose: jest.Mock;
  postMessage: jest.Mock;
}

const firstMessage = { type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 };
/** The receiver every test's webview announces, unless it names another (F-08). */
const RECEIVER = 'receiver-1';
const announce = (receiver = RECEIVER) => ({
  type: MessageType.WORKSHOP_SEED_RECEIVER,
  source: 'webview.workshop.seed-delivery',
  payload: { receiver },
  timestamp: 1
});
const claim = (deliveryId: string, receiver = RECEIVER) => ({
  type: MessageType.WORKSHOP_SEED_CLAIM,
  source: 'webview.workshop.seed-delivery',
  payload: { kind: 'lexical-gravity-build', deliveryId, receiver },
  timestamp: 2
});
const answer = (deliveryId: string, opened: boolean, receiver = RECEIVER) => ({
  type: MessageType.WORKSHOP_SEED_ANSWER,
  source: 'webview.workshop.seed-delivery',
  payload: opened
    ? { kind: 'lexical-gravity-build', deliveryId, opened, receiver }
    : { kind: 'lexical-gravity-build', deliveryId, opened, reason: 'busy', receiver },
  timestamp: 3
});
/** A Workshop webview mounting: it asks for its session, then announces itself once listening, as WorkshopApp does. */
const mount = (target: { receive: (message: unknown) => void }, receiver = RECEIVER) => {
  target.receive(firstMessage);
  target.receive(announce(receiver));
};
const seedsIn = (target: MockPanel) => target.handler.handleMessage.mock.calls
  .map(([message]) => message as { type: string; payload: { seed: unknown; deliveryId: string } })
  .filter((message) => message.type === MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD);
const claimResultsIn = (target: MockPanel) => target.postMessage.mock.calls
  .map(([message]) => message as { type: string; payload: Record<string, unknown> })
  .filter((message) => message.type === MessageType.WORKSHOP_SEED_CLAIM_RESULT)
  .map((message) => message.payload);

/**
 * Build as a lens (ADR 2026-10-19 D11, PR #150 F-03): the seed reaches the
 * Workshop only as a synthetic message through the Workshop panel's OWN
 * MessageHandler (the `seedExcerpt` pattern). It belongs to the panel that
 * accepted it and is sent once, only to a listening and visible webview,
 * which opens it only if its claim is granted. The handoff settles on that
 * webview's answer, a replacement, that panel's closing, or a timeout.
 */
describe('WorkshopPanelProvider Build lens seed', () => {
  let panels: MockPanel[];
  let unsettled: symbol;

  beforeEach(() => {
    (MessageHandler as unknown as jest.Mock).mockClear();
    panels = [];
    unsettled = Symbol('unsettled');
    const disposable = { dispose: jest.fn() };
    Object.assign(vscode.workspace, { onDidChangeConfiguration: jest.fn(() => disposable) });
    Object.assign(vscode.window, { createWebviewPanel: jest.fn(() => mockPanel()) });
  });

  afterEach(() => {
    // Disposing settles any seed a test left pending, so no timeout outlives it.
    providers.splice(0).forEach((workshop) => workshop.dispose());
    jest.useRealTimers();
  });

  function mockPanel(): MockPanel {
    const disposable = { dispose: jest.fn() };
    const record = { visible: true, dispose: jest.fn(), postMessage: jest.fn() } as unknown as MockPanel;
    const panel = {
      get visible() {
        return record.visible;
      },
      webview: {
        options: {},
        html: '',
        postMessage: record.postMessage,
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
      dispose: record.dispose
    };
    panels.push(record);
    return panel as unknown as MockPanel;
  }

  const providers: WorkshopPanelProvider[] = [];
  const provider = () => {
    const workshop = new WorkshopPanelProvider(
      vscode.Uri.file('/extension'),
      {} as CoreServices,
      { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
      {} as Platform
    );
    providers.push(workshop);
    return workshop;
  };
  /** Bind each attached panel to the MessageHandler built for it. */
  const bindHandlers = () => {
    const handlers = (MessageHandler as unknown as jest.Mock).mock.results.map((result) => result.value as MockHandler);
    panels.forEach((record, index) => {
      record.handler = handlers[index];
    });
  };
  const open = (workshop: WorkshopPanelProvider) => {
    workshop.openOrReveal();
    bindHandlers();
    return panels.at(-1)!;
  };
  const seedInto = (workshop: WorkshopPanelProvider) => {
    const outcome = workshop.seedLexicalGravityBuild(seed);
    bindHandlers();
    return { outcome, panel: panels.at(-1)! };
  };
  const peek = <T>(promise: Promise<T>) => Promise.race([promise, Promise.resolve(unsettled)]);
  /** The webview's side: claim the latest seed sent, and answer if the claim is granted. */
  const claimAndAnswer = (panel: MockPanel, opened: boolean) => {
    const [sent] = seedsIn(panel).slice(-1);
    panel.receive(claim(sent.payload.deliveryId));
    if (claimResultsIn(panel).at(-1)?.granted) {
      panel.receive(answer(sent.payload.deliveryId, opened));
    }
    return sent.payload.deliveryId;
  };

  it('holds the seed until its webview is listening, routes it through the panel\'s own handler, and opens it only on a granted claim', async () => {
    const workshop = provider();
    const { outcome, panel } = seedInto(workshop);
    expect(panels).toHaveLength(1);
    expect(panel.handler.handleMessage).not.toHaveBeenCalled();

    mount(panel);
    expect(panel.handler.handleMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: MessageType.WORKSHOP_REQUEST_SESSION }));
    expect(panel.handler.handleMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      payload: { seed, deliveryId: expect.stringMatching(/^lexical-gravity-build-/) }
    }));
    // Sent is not opened: the Lightbox still waits for the Workshop's word.
    expect(await peek(outcome)).toBe(unsettled);

    const [sent] = seedsIn(panel);
    // An answer before a granted claim settles nothing.
    panel.receive(answer(sent.payload.deliveryId, true));
    expect(await peek(outcome)).toBe(unsettled);
    panel.receive(claim(sent.payload.deliveryId));
    expect(claimResultsIn(panel)).toEqual([{ kind: 'lexical-gravity-build', deliveryId: sent.payload.deliveryId, granted: true }]);
    panel.receive(answer(sent.payload.deliveryId, true));
    await expect(outcome).resolves.toEqual({ opened: true });
    // The claim and answer are the provider's; they never reach a domain handler.
    expect(panel.handler.handleMessage).toHaveBeenCalledTimes(2);

    panel.receive({ ...firstMessage, timestamp: 4 });
    expect(seedsIn(panel)).toHaveLength(1);
  });

  it('routes a seed at once to a Workshop already listening and visible, without a second panel', async () => {
    const workshop = provider();
    const panel = open(workshop);
    mount(panel);
    const { outcome } = seedInto(workshop);
    expect(panels).toHaveLength(1);
    expect(seedsIn(panel)).toHaveLength(1);

    claimAndAnswer(panel, false);
    await expect(outcome).resolves.toEqual({ opened: false, reason: 'busy' });
  });

  it('holds a seed for a ready but hidden Workshop tab until it is shown, then delivers it once', () => {
    const workshop = provider();
    const panel = open(workshop);
    mount(panel);
    panel.visible = false;
    seedInto(workshop);
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(0);

    panel.visible = true;
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
  });

  it('boot, hide, first message, reveal: a webview that starts listening while hidden gets the seed only once shown', () => {
    const workshop = provider();
    const { panel } = seedInto(workshop);
    panel.visible = false;
    panel.viewStateChanged();

    mount(panel);
    expect(seedsIn(panel)).toHaveLength(0);

    panel.visible = true;
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
    panel.receive({ ...firstMessage, timestamp: 4 });
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
  });

  it('boot, close, reopen: closing the booting tab cancels its seed, and the fresh Workshop never receives it', async () => {
    const workshop = provider();
    const { outcome, panel: first } = seedInto(workshop);
    first.disposed();
    await expect(outcome).resolves.toEqual({ opened: false, reason: 'closed' });

    const second = open(workshop);
    expect(second).not.toBe(first);
    mount(second);
    second.viewStateChanged();
    expect(seedsIn(second)).toHaveLength(0);
  });

  it('ignores late callbacks from an older panel: they neither deliver, claim, answer, nor cancel the current panel\'s seed', async () => {
    const workshop = provider();
    const { outcome: abandoned, panel: older } = seedInto(workshop);
    // VS Code restores a second Workshop tab; the older one is replaced and its seed with it.
    const current = mockPanel();
    await workshop.deserializeWebviewPanel(current as unknown as vscode.WebviewPanel, undefined);
    bindHandlers();
    const currentPanel = panels.at(-1)!;
    expect(older.dispose).toHaveBeenCalled();
    await expect(abandoned).resolves.toEqual({ opened: false, reason: 'closed' });

    const { outcome } = seedInto(workshop);
    expect(panels).toHaveLength(2);

    // The older panel's events arrive late.
    mount(older);
    older.viewStateChanged();
    older.receive(claim('lexical-gravity-build-anything'));
    older.receive(answer('lexical-gravity-build-anything', true));
    older.disposed();
    expect(seedsIn(older)).toHaveLength(0);
    expect(claimResultsIn(older)).toEqual([]);
    expect(currentPanel.handler.handleMessage).not.toHaveBeenCalled();
    expect(await peek(outcome)).toBe(unsettled);

    // A claim the older panel sends with the current seed's id grants nothing.
    mount(currentPanel);
    const [sent] = seedsIn(currentPanel);
    older.receive(claim(sent.payload.deliveryId));
    expect(claimResultsIn(older)).toEqual([]);
    expect(claimResultsIn(currentPanel)).toEqual([]);

    claimAndAnswer(currentPanel, true);
    await expect(outcome).resolves.toEqual({ opened: true });
  });

  it('a newer seed replaces an unsent one, and the replaced seed is never sent', async () => {
    const workshop = provider();
    const { outcome: first, panel } = seedInto(workshop);
    const { outcome: second } = seedInto(workshop);
    await expect(first).resolves.toEqual({ opened: false, reason: 'replaced' });

    mount(panel);
    expect(seedsIn(panel)).toHaveLength(1);
    claimAndAnswer(panel, true);
    await expect(second).resolves.toEqual({ opened: true });
  });

  it('a newer seed replaces a sent but unclaimed one, whose late claim is denied', async () => {
    const workshop = provider();
    const panel = open(workshop);
    mount(panel);
    const { outcome: first } = seedInto(workshop);
    const { outcome: second } = seedInto(workshop);
    await expect(first).resolves.toEqual({ opened: false, reason: 'replaced' });
    const [sentA, sentB] = seedsIn(panel);

    panel.receive(claim(sentA.payload.deliveryId));
    expect(claimResultsIn(panel)).toEqual([
      { kind: 'lexical-gravity-build', deliveryId: sentA.payload.deliveryId, granted: false, reason: 'replaced' }
    ]);
    panel.receive(claim(sentB.payload.deliveryId));
    panel.receive(answer(sentB.payload.deliveryId, true));
    await expect(second).resolves.toEqual({ opened: true });
  });

  it('times out an unclaimed seed, never sends it afterwards, and denies a late claim of a sent one', async () => {
    jest.useFakeTimers();
    const workshop = provider();
    const panel = open(workshop);
    mount(panel);
    const { outcome: sent } = seedInto(workshop);
    jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS);
    await expect(sent).resolves.toEqual({ opened: false, reason: 'timeout' });
    const [delivered] = seedsIn(panel);
    panel.receive(claim(delivered.payload.deliveryId));
    expect(claimResultsIn(panel).at(-1)).toMatchObject({ granted: false, reason: 'timeout' });

    panel.visible = false;
    const { outcome: hidden } = seedInto(workshop);
    jest.advanceTimersByTime(WORKSHOP_SEED_TIMEOUT_MS - 1);
    expect(await peek(hidden)).toBe(unsettled);
    jest.advanceTimersByTime(1);
    await expect(hidden).resolves.toEqual({ opened: false, reason: 'timeout' });
    panel.visible = true;
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
  });

  it('settles a pending seed as closed when the provider is disposed', async () => {
    const workshop = provider();
    const { outcome } = seedInto(workshop);
    workshop.dispose();
    await expect(outcome).resolves.toEqual({ opened: false, reason: 'closed' });
  });

  it('a reloaded webview (F-08): releases the old grant as reset, ignores the old receiver, and sends the next seed to the new one', async () => {
    const workshop = provider();
    const panel = open(workshop);
    mount(panel, 'receiver-old');
    const { outcome: first } = seedInto(workshop);
    const [sentA] = seedsIn(panel);
    panel.receive(claim(sentA.payload.deliveryId, 'receiver-old'));
    expect(claimResultsIn(panel)).toEqual([expect.objectContaining({ granted: true })]);
    const { outcome: second } = seedInto(workshop);
    // B waits behind A's grant.
    expect(seedsIn(panel)).toHaveLength(1);

    // The webview reloads on the same panel; the fresh one never saw A's grant.
    mount(panel, 'receiver-new');
    await expect(first).resolves.toEqual({ opened: false, reason: 'reset' });
    const [, sentB] = seedsIn(panel);
    expect(sentB).toBeDefined();

    // The old realm's late claim and answer reach nothing.
    panel.receive(answer(sentA.payload.deliveryId, true, 'receiver-old'));
    panel.receive(claim(sentB.payload.deliveryId, 'receiver-old'));
    expect(claimResultsIn(panel)).toHaveLength(1);
    await expect(first).resolves.toEqual({ opened: false, reason: 'reset' });

    panel.receive(claim(sentB.payload.deliveryId, 'receiver-new'));
    panel.receive(answer(sentB.payload.deliveryId, true, 'receiver-new'));
    await expect(second).resolves.toEqual({ opened: true });
    // The announcements and claims are the provider's; only the session request and the seeds reach the handler.
    expect(panel.handler.handleMessage.mock.calls.map(([message]) => (message as { type: string }).type)).toEqual([
      MessageType.WORKSHOP_REQUEST_SESSION,
      MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      MessageType.WORKSHOP_REQUEST_SESSION,
      MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD
    ]);
  });
});
