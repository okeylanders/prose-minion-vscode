/**
 * WebviewViewProvider - Application layer
 * Manages the lifecycle of the webview panel
 * Following Open/Closed Principle - extensible without modification
 */

import * as vscode from 'vscode';
import { MessageHandler } from '../handlers/MessageHandler';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { MessageType, SelectionUpdatedMessage, OpenSettingsToggleMessage } from '../../shared/types';
import { SecretStorageService } from '../../infrastructure/secrets/SecretStorageService';

export class ProseToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prose-minion.toolsView';

  private view?: vscode.WebviewView;
  private messageHandler?: MessageHandler;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly secretsService: SecretStorageService,
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
      this.secretsService,
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
        source: 'extension.provider',
        payload: {
          text: payload.text,
          sourceUri: payload.sourceUri,
          relativePath: payload.relativePath,
          target: payload.target
        },
        timestamp: Date.now()
      };
      this.view.webview.postMessage(message);
    }
  }

  /**
   * Open the settings overlay in the webview
   */
  public openSettings(): void {
    if (this.view) {
      const message: OpenSettingsToggleMessage = {
        type: MessageType.OPEN_SETTINGS_TOGGLE,
        source: 'extension.provider',
        payload: {},
        timestamp: Date.now()
      };
      this.view.webview.postMessage(message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );

    const vhsLoadingGifUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'assets', 'assistant-working-vhs.gif')
    );
    const distortedLoadingGifUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'assets', 'assistant-working-distorted-screen.gif')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <title>Prose Minion Tools</title>
</head>
<body>
  <div id="root" style="padding:8px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">Loading Prose Minion…</div>
  <script nonce="${nonce}">
    window.proseMinonAssets = {
      vhsLoadingGif: "${vhsLoadingGifUri}",
      loadingGifs: [
        "${vhsLoadingGifUri}",
        "${distortedLoadingGifUri}"
      ],
      // Enumerate available loading GIF filenames for credits management
      loadingGifList: [
        'assistant-working-vhs.gif',
        'assistant-working-distorted-screen.gif'
      ],
      // Map of filename -> credit info
      loadingGifCredits: {
        'assistant-working-vhs.gif': { label: 'matti watt', href: 'https://www.pinterest.com/pin/29977153764908058/' },
        'assistant-working-distorted-screen.gif': { label: 'E270', href: 'https://www.pinterest.com/pin/21462535717701169/' }
      }
    };
  </script>
  <script nonce="${nonce}">
    console.log('[Prose Minion] Webview HTML loaded');
    window.addEventListener('error', function (e) {
      try {
        const el = document.getElementById('root');
        if (el) el.textContent = 'Webview error: ' + (e?.message || 'unknown');
        // Forward to extension output channel if API is available
        try { const vscode = acquireVsCodeApi && acquireVsCodeApi(); vscode && vscode.postMessage && vscode.postMessage({ type: 'webview_error', message: e?.message || 'unknown' }); } catch {}
      } catch {}
    });
  </script>
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
