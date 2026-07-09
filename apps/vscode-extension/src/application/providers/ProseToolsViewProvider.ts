/**
 * WebviewViewProvider - Application layer
 * Manages the lifecycle of the webview panel
 * Following Open/Closed Principle - extensible without modification
 *
 * SPRINT 05 REFACTOR: ProseAnalysisService facade removed
 * Now accepts services directly and passes them to MessageHandler
 */

import * as vscode from 'vscode';
// All core symbols via the public barrel (ADR 2026-06-16 monorepo boundary).
import {
  MessageHandler,
  CoreServices,
  Platform,
  WorkshopUiActions,
  MessageType,
  SelectionUpdatedMessage,
  OpenSettingsToggleMessage,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

export class ProseToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prose-minion.toolsView';

  private view?: vscode.WebviewView;
  private messageHandler?: MessageHandler;
  private configWatcher?: vscode.Disposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly coreServices: CoreServices,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform,
    private readonly uiActions: WorkshopUiActions = {}
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

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, 'sidebar');

    // SPRINT 05: Initialize message handler with direct service injection.
    // Pre-dispose any prior handler before replacing it so a re-resolve can't
    // orphan its AccountBalanceService timer/listener. Safe today (onDidDispose
    // tears the prior one down under retainContextWhenHidden), but mirrors the
    // configWatcher's guarded reassignment below so the invariant is explicit.
    this.messageHandler?.dispose();
    this.messageHandler = new MessageHandler(
      this.coreServices,
      (message) => webviewView.webview.postMessage(message),
      this.platform,
      this.outputChannel,
      this.uiActions
    );

    // Config-change watcher lives in the shell (keeps MessageHandler vscode-free).
    // Forward changes inward as a vscode-free `affects(section)` predicate.
    this.configWatcher?.dispose();
    this.configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      this.messageHandler?.handleConfigurationChange(section => event.affectsConfiguration(section));
    });

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
      this.configWatcher?.dispose();
      this.configWatcher = undefined;
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
    autoRun?: boolean;
  }): void {
    if (this.view) {
      const message: SelectionUpdatedMessage = {
        type: MessageType.SELECTION_UPDATED,
        source: 'extension.provider',
        payload: {
          text: payload.text,
          sourceUri: payload.sourceUri,
          relativePath: payload.relativePath,
          target: payload.target,
          autoRun: payload.autoRun
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

}
