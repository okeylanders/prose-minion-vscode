/**
 * WebviewViewProvider - Application layer
 * Manages the lifecycle of the webview panel
 * Following Open/Closed Principle - extensible without modification
 */

import * as vscode from 'vscode';
import { MessageHandler } from '../handlers/MessageHandler';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { MessageType, SelectionUpdatedMessage } from '../../shared/types';

export class ProseToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prose-minion.toolsView';

  private view?: vscode.WebviewView;
  private messageHandler?: MessageHandler;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    const webviewOptions: vscode.WebviewOptions = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.options = webviewOptions;

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Initialize message handler
    this.messageHandler = new MessageHandler(
      this.proseAnalysisService,
      webviewView.webview,
      this.extensionUri,
      this.outputChannel
    );

    // Set up message listener
    webviewView.webview.onDidReceiveMessage(
      message => this.messageHandler?.handleMessage(message),
      undefined,
      []
    );

    // When the view becomes visible again, replay any cached results that may have arrived while hidden
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.messageHandler?.flushCachedResults?.();
      }
    });

    webviewView.onDidDispose(() => {
      this.messageHandler?.dispose();
      this.messageHandler = undefined;
    });
  }

  /**
   * Send selected text from editor to webview
   */
  public sendSelectionToWebview(payload: {
    text: string;
    sourceUri?: string;
    relativePath?: string;
    target?: 'assistant' | 'dictionary' | 'both';
  }): void {
    if (this.view) {
      const message: SelectionUpdatedMessage = {
        type: MessageType.SELECTION_UPDATED,
        text: payload.text,
        sourceUri: payload.sourceUri,
        relativePath: payload.relativePath,
        target: payload.target,
        timestamp: Date.now()
      };
      this.view.webview.postMessage(message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <title>Prose Minion Tools</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
