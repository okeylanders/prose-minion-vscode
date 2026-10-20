/* eslint-disable @typescript-eslint/naming-convention -- the module mock mirrors the core barrel's export names. */
import * as vscode from 'vscode';
import { LightboxPanelProvider } from '@app/application/providers/LightboxPanelProvider';
import { CoreServices, LightboxSourceTicket, MessageHandler, MessageType, Platform } from '@prose-minion/core';

jest.mock('@prose-minion/core', () => ({
  MessageType: {
    LIGHTBOX_REQUEST_BOARD: 'lightbox_request_board',
    LIGHTBOX_SET_SOURCE: 'lightbox_set_source'
  },
  SURFACE_LIGHTBOX: 'lightbox',
  MessageHandler: jest.fn(() => ({
    handleMessage: jest.fn().mockResolvedValue(undefined),
    seedLightboxSource: jest.fn().mockResolvedValue(undefined),
    flushCachedResults: jest.fn(),
    dispose: jest.fn()
  }))
}));
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));

function fakePanel() {
  let viewChanged!: () => void;
  const disposable = { dispose: jest.fn() };
  const panel = {
    visible: false,
    reveal: jest.fn(),
    webview: {
      options: {},
      html: '',
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn(() => disposable)
    },
    onDidChangeViewState: jest.fn((callback: () => void) => {
      viewChanged = callback;
      return disposable;
    }),
    onDidDispose: jest.fn(),
    dispose: jest.fn()
  };
  return { panel, changeView: () => viewChanged() };
}

/** The shared service's source-request rule: the newest ticket is the only current one. */
function fakeLightboxService() {
  let sequence = 0;
  let current: LightboxSourceTicket | undefined;
  return {
    beginSourceRequest: jest.fn(() => {
      current = { sequence: ++sequence };
      return current;
    }),
    isCurrentRequest: (ticket: LightboxSourceTicket) => ticket === current
  };
}

function createProvider() {
  Object.assign(vscode.workspace, {
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
  });
  const lightboxService = fakeLightboxService();
  const coreServices = { lightboxService } as unknown as CoreServices;
  const provider = new LightboxPanelProvider(
    vscode.Uri.file('/extension'),
    coreServices,
    { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
    {} as Platform
  );
  return { provider, coreServices, lightboxService };
}

const latestHandler = () => (MessageHandler as jest.Mock).mock.results.at(-1)!.value;

describe('LightboxPanelProvider', () => {
  it('builds its handler over the injected bundle and re-asks for the board when revealed', async () => {
    const { provider, coreServices } = createProvider();
    const { panel, changeView } = fakePanel();
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = latestHandler();

    expect((MessageHandler as jest.Mock).mock.calls.at(-1)![0]).toBe(coreServices);
    changeView();
    expect(handler.handleMessage).not.toHaveBeenCalled();
    panel.visible = true;
    changeView();
    expect(handler.flushCachedResults).toHaveBeenCalledTimes(1);
    expect(handler.handleMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_REQUEST_BOARD,
      source: 'webview.lightbox',
      payload: {}
    }));
  });

  it('seeds a selection through its own handler after revealing the panel, under a request taken now', async () => {
    const { provider, lightboxService } = createProvider();
    const { panel } = fakePanel();
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = latestHandler();

    const seeded = provider.seedSource({ text: 'Down, down, down.', relativePath: 'Drafts/alice-1.md', startLine: 3, endLine: 3 });

    expect(seeded).toBe(true);
    expect(panel.reveal).toHaveBeenCalled();
    expect(lightboxService.beginSourceRequest).toHaveBeenCalledTimes(1);
    // The ticket is an argument, never part of a message a webview could also send.
    expect(handler.seedLightboxSource).toHaveBeenCalledWith(
      { text: 'Down, down, down.', relativePath: 'Drafts/alice-1.md', startLine: 3, endLine: 3 },
      lightboxService.beginSourceRequest.mock.results[0].value
    );
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  it('seeds a file launch under the ticket it took before loading, and opens nothing once a newer source was chosen (PR #152 F-01)', async () => {
    const { provider, lightboxService } = createProvider();
    const { panel } = fakePanel();
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = latestHandler();
    const payload = { sourceUri: 'file:///workspace/Drafts/alice-2.md', relativePath: 'Drafts/alice-2.md' };

    const launch = lightboxService.beginSourceRequest();
    expect(provider.seedSource(payload, launch)).toBe(true);
    expect(handler.seedLightboxSource).toHaveBeenLastCalledWith(payload, launch);

    const older = lightboxService.beginSourceRequest();
    lightboxService.beginSourceRequest();
    panel.reveal.mockClear();
    handler.seedLightboxSource.mockClear();
    expect(provider.seedSource(payload, older)).toBe(false);
    expect(panel.reveal).not.toHaveBeenCalled();
    expect(handler.seedLightboxSource).not.toHaveBeenCalled();
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  it('disposes its handler before its panel', async () => {
    const { provider } = createProvider();
    const { panel } = fakePanel();
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = latestHandler();
    const order: string[] = [];
    handler.dispose.mockImplementation(() => order.push('handler'));
    panel.dispose.mockImplementation(() => order.push('panel'));

    provider.dispose();

    expect(order).toEqual(['handler', 'panel']);
  });
});
