import * as vscode from 'vscode';
import { WORKSHOP_BUILD_SEED_TIMEOUT_MS, WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, MessageHandler, MessageType, Platform } from '@prose-minion/core';

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export and enum member names. */
jest.mock('@prose-minion/core', () => ({
  MessageType: {
    WEBVIEW_ERROR: 'webview_error',
    WORKSHOP_REQUEST_SESSION: 'workshop_request_session',
    WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD: 'workshop_open_lexical_gravity_build',
    WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER: 'workshop_lexical_gravity_build_seed_answer'
  },
  SURFACE_WORKSHOP: 'workshop',
  MessageHandler: jest.fn(() => ({
    handleMessage: jest.fn().mockResolvedValue(undefined),
    flushCachedResults: jest.fn(),
    dispose: jest.fn()
  }))
}));
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
}

const firstMessage = { type: 'workshop_request_session', source: 'webview.workshop', payload: {}, timestamp: 1 };
const answer = (seedId: string, opened: boolean) => ({
  type: 'workshop_lexical_gravity_build_seed_answer',
  source: 'webview.workshop',
  payload: opened ? { seedId, opened } : { seedId, opened, reason: 'busy' },
  timestamp: 2
});
const seedsIn = (target: MockPanel) => target.handler.handleMessage.mock.calls
  .map(([message]) => message as { type: string; payload: { seed: unknown; deliveryId: string } })
  .filter((message) => message.type === MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD);

/**
 * Build as a lens (ADR 2026-10-19 D11, PR #150 F-03): the seed reaches the
 * Workshop only as a synthetic message through the Workshop panel's OWN
 * MessageHandler (the `seedExcerpt` pattern). It belongs to the panel that
 * accepted it, is delivered once, only to a listening and visible webview,
 * and the handoff settles only on that webview's answer, a replacement,
 * that panel's closing, or a timeout.
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
    const record = { visible: true, dispose: jest.fn() } as unknown as MockPanel;
    const panel = {
      get visible() {
        return record.visible;
      },
      webview: {
        options: {},
        html: '',
        postMessage: jest.fn(),
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

  it('holds the seed until its webview is listening, routes it through the panel\'s own handler, and settles on its answer', async () => {
    const workshop = provider();
    const { outcome, panel } = seedInto(workshop);
    expect(panels).toHaveLength(1);
    expect(panel.handler.handleMessage).not.toHaveBeenCalled();

    panel.receive(firstMessage);
    expect(panel.handler.handleMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: MessageType.WORKSHOP_REQUEST_SESSION }));
    expect(panel.handler.handleMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      payload: { seed, deliveryId: expect.stringMatching(/^lexical-build-seed-/) }
    }));
    // Delivered is not opened: the Lightbox still waits for the Workshop's word.
    expect(await peek(outcome)).toBe(unsettled);

    const [delivered] = seedsIn(panel);
    panel.receive(answer(delivered.payload.deliveryId, true));
    await expect(outcome).resolves.toEqual({ opened: true });
    // The answer is the provider's; it never reaches a domain handler.
    expect(panel.handler.handleMessage).toHaveBeenCalledTimes(2);

    panel.receive({ ...firstMessage, timestamp: 3 });
    expect(seedsIn(panel)).toHaveLength(1);
  });

  it('routes a seed at once to a Workshop already listening and visible, without a second panel', async () => {
    const workshop = provider();
    const panel = open(workshop);
    panel.receive(firstMessage);
    const { outcome } = seedInto(workshop);
    expect(panels).toHaveLength(1);
    expect(seedsIn(panel)).toHaveLength(1);

    panel.receive(answer(seedsIn(panel)[0].payload.deliveryId, false));
    await expect(outcome).resolves.toEqual({ opened: false, reason: 'busy' });
  });

  it('holds a seed for a ready but hidden Workshop tab until it is shown, then delivers it once', () => {
    const workshop = provider();
    const panel = open(workshop);
    panel.receive(firstMessage);
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

    panel.receive(firstMessage);
    expect(seedsIn(panel)).toHaveLength(0);

    panel.visible = true;
    panel.viewStateChanged();
    expect(seedsIn(panel)).toHaveLength(1);
    panel.receive({ ...firstMessage, timestamp: 3 });
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
    second.receive(firstMessage);
    second.viewStateChanged();
    expect(seedsIn(second)).toHaveLength(0);
  });

  it('ignores late callbacks from an older panel: they neither deliver, answer, nor cancel the current panel\'s seed', async () => {
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
    older.receive(firstMessage);
    older.viewStateChanged();
    older.receive(answer('lexical-build-seed-anything', true));
    older.disposed();
    expect(seedsIn(older)).toHaveLength(0);
    expect(currentPanel.handler.handleMessage).not.toHaveBeenCalled();
    expect(await peek(outcome)).toBe(unsettled);

    // An answer the older panel sends with the current seed's id still settles nothing.
    currentPanel.receive(firstMessage);
    const [delivered] = seedsIn(currentPanel);
    older.receive(answer(delivered.payload.deliveryId, true));
    expect(await peek(outcome)).toBe(unsettled);

    currentPanel.receive(answer(delivered.payload.deliveryId, true));
    await expect(outcome).resolves.toEqual({ opened: true });
  });

  it('a newer seed replaces a pending one, and the replaced seed\'s answer settles nothing', async () => {
    const workshop = provider();
    const { outcome: first, panel } = seedInto(workshop);
    const { outcome: second } = seedInto(workshop);
    await expect(first).resolves.toEqual({ opened: false, reason: 'replaced' });

    panel.receive(firstMessage);
    const delivered = seedsIn(panel);
    expect(delivered).toHaveLength(1);
    panel.receive(answer('lexical-build-seed-0-1', true));
    expect(await peek(second)).toBe(unsettled);
    panel.receive(answer(delivered[0].payload.deliveryId, true));
    await expect(second).resolves.toEqual({ opened: true });
  });

  it('times out a seed the Workshop never confirms, and never delivers it afterwards', async () => {
    jest.useFakeTimers();
    const workshop = provider();
    const { outcome, panel } = seedInto(workshop);
    panel.receive(firstMessage);
    panel.visible = false;
    // Delivered at once to the visible listener; hide another seed to test the undelivered case.
    const { outcome: hidden } = seedInto(workshop);
    await expect(outcome).resolves.toEqual({ opened: false, reason: 'replaced' });

    jest.advanceTimersByTime(WORKSHOP_BUILD_SEED_TIMEOUT_MS - 1);
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
});
