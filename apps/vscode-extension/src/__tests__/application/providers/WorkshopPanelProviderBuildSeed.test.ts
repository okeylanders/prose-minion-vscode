import * as vscode from 'vscode';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, MessageHandler, MessageType, Platform } from '@prose-minion/core';

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export and enum member names. */
jest.mock('@prose-minion/core', () => ({
  MessageType: {
    WORKSHOP_REQUEST_SESSION: 'workshop_request_session',
    WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD: 'workshop_open_lexical_gravity_build'
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

/**
 * Build as a lens (ADR 2026-10-19 D11): the seed reaches the Workshop only as
 * a synthetic message through the Workshop panel's OWN MessageHandler (the
 * `seedExcerpt` pattern), and a webview still booting gets it after its first
 * message rather than losing it.
 */
describe('WorkshopPanelProvider Build lens seed', () => {
  let received: (message: unknown) => void;
  let viewStateChanged: () => void;
  let createdPanels: number;
  let panel: { visible: boolean };

  beforeEach(() => {
    (MessageHandler as unknown as jest.Mock).mockClear();
    createdPanels = 0;
    const disposable = { dispose: jest.fn() };
    Object.assign(vscode.workspace, { onDidChangeConfiguration: jest.fn(() => disposable) });
    Object.assign(vscode.window, {
      createWebviewPanel: jest.fn(() => {
        createdPanels += 1;
        panel = {
          visible: true,
          webview: {
            options: {},
            html: '',
            postMessage: jest.fn(),
            onDidReceiveMessage: jest.fn((callback: (message: unknown) => void) => {
              received = callback;
              return disposable;
            })
          },
          onDidChangeViewState: jest.fn((callback: () => void) => {
            viewStateChanged = callback;
            return disposable;
          }),
          onDidDispose: jest.fn(),
          reveal: jest.fn(),
          dispose: jest.fn()
        } as { visible: boolean };
        return panel;
      })
    });
  });

  const provider = () => new WorkshopPanelProvider(
    vscode.Uri.file('/extension'),
    {} as CoreServices,
    { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
    {} as Platform
  );
  const handler = () => (MessageHandler as unknown as jest.Mock).mock.results.at(-1)!.value as { handleMessage: jest.Mock };
  const buildSeedMessage = expect.objectContaining({
    type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
    payload: { seed }
  });

  it('opens the Workshop and holds the seed until its webview is listening, then routes it through the panel\'s own handler', () => {
    const workshop = provider();
    expect(workshop.seedLexicalGravityBuild(seed)).toBe(true);
    expect(createdPanels).toBe(1);
    expect(handler().handleMessage).not.toHaveBeenCalled();

    received({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 });
    expect(handler().handleMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: MessageType.WORKSHOP_REQUEST_SESSION }));
    expect(handler().handleMessage).toHaveBeenNthCalledWith(2, buildSeedMessage);

    // Later messages deliver nothing more.
    received({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 2 });
    expect(handler().handleMessage).toHaveBeenCalledTimes(3);
  });

  it('routes a seed at once to a Workshop already listening, without a second panel', () => {
    const workshop = provider();
    workshop.openOrReveal();
    received({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 });
    expect(workshop.seedLexicalGravityBuild(seed)).toBe(true);
    expect(createdPanels).toBe(1);
    expect(handler().handleMessage).toHaveBeenLastCalledWith(buildSeedMessage);
  });

  it('holds a seed for a hidden Workshop tab until the tab is shown, since a hidden tab can drop it', () => {
    const workshop = provider();
    workshop.openOrReveal();
    received({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'webview.workshop', payload: {}, timestamp: 1 });
    panel.visible = false;
    expect(workshop.seedLexicalGravityBuild(seed)).toBe(true);
    expect(handler().handleMessage).not.toHaveBeenCalledWith(buildSeedMessage);

    panel.visible = true;
    viewStateChanged();
    expect(handler().handleMessage).toHaveBeenLastCalledWith(buildSeedMessage);
    viewStateChanged();
    expect(handler().handleMessage.mock.calls.filter(([message]) => message.type === MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD))
      .toHaveLength(1);
  });
});
