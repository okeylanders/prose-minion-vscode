/* eslint-disable @typescript-eslint/naming-convention -- the module mock mirrors the core barrel's export names. */
import * as vscode from 'vscode';
import { LightboxPanelProvider } from '@app/application/providers/LightboxPanelProvider';
import { CoreServices, MessageHandler, MessageType, Platform } from '@prose-minion/core';

jest.mock('@prose-minion/core', () => ({
  MessageType: {
    LIGHTBOX_REQUEST_BOARD: 'lightbox_request_board',
    LIGHTBOX_SET_SOURCE: 'lightbox_set_source'
  },
  SURFACE_LIGHTBOX: 'lightbox',
  MessageHandler: jest.fn(() => ({
    handleMessage: jest.fn().mockResolvedValue(undefined),
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

function createProvider() {
  Object.assign(vscode.workspace, {
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
  });
  const coreServices = {} as CoreServices;
  const provider = new LightboxPanelProvider(
    vscode.Uri.file('/extension'),
    coreServices,
    { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
    {} as Platform
  );
  return { provider, coreServices };
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

  it('seeds a source through its own handler after revealing the panel', async () => {
    const { provider } = createProvider();
    const { panel } = fakePanel();
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = latestHandler();

    provider.seedSource({ text: 'Down, down, down.', relativePath: 'Drafts/alice-1.md', startLine: 3, endLine: 3 });

    expect(panel.reveal).toHaveBeenCalled();
    expect(handler.handleMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_SET_SOURCE,
      source: 'webview.lightbox',
      payload: { text: 'Down, down, down.', relativePath: 'Drafts/alice-1.md', startLine: 3, endLine: 3 }
    }));
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
