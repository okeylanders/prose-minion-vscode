import * as vscode from 'vscode';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { CoreServices, MessageHandler, MessageType, Platform } from '@prose-minion/core';

jest.mock('@prose-minion/core', () => ({
  MessageType: { WORKSHOP_REQUEST_SESSION: 'workshop_request_session' },
  SURFACE_WORKSHOP: 'workshop',
  MessageHandler: jest.fn(() => ({
    handleMessage: jest.fn().mockResolvedValue(undefined),
    flushCachedResults: jest.fn(),
    dispose: jest.fn()
  }))
}));
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));

describe('WorkshopPanelProvider retained session loading', () => {
  it('rechecks named state when a retained tab becomes visible, but not when it hides', async () => {
    let viewChanged!: () => void;
    const disposable = { dispose: jest.fn() };
    Object.assign(vscode.workspace, {
      onDidChangeConfiguration: jest.fn(() => disposable)
    });
    const panel = {
      visible: false,
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
    const provider = new WorkshopPanelProvider(
      vscode.Uri.file('/extension'),
      {} as CoreServices,
      { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
      {} as Platform
    );
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = (MessageHandler as jest.Mock).mock.results.at(-1)!.value;

    viewChanged();
    expect(handler.handleMessage).not.toHaveBeenCalled();
    panel.visible = true;
    viewChanged();
    expect(handler.handleMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_SESSION,
      source: 'webview.workshop',
      payload: {}
    }));
    expect(handler.flushCachedResults).toHaveBeenCalledTimes(1);
  });
});
