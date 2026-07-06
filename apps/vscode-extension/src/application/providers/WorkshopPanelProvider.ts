/**
 * WorkshopPanelProvider — Application layer.
 *
 * Owns the single Workshop editor-tab surface (ADR 2026-07-03): one
 * `WebviewPanel`, created on demand by the `prose-minion.openWorkshop`
 * command, revealed rather than duplicated when it already exists, and
 * retained while hidden so the panel survives tab switches (v1 persistence;
 * the WebviewPanelSerializer is explicitly out of scope).
 *
 * Sprint 2 (session spine): the panel gets its own MessageHandler — the ONE
 * sanctioned `new` (the per-webview message seam, same as the sidebar) —
 * built from the SAME injected CoreServices bundle constructed in
 * extension.ts. Nothing else is `new`-ed here (ADR 2026-06-18 composition-
 * root invariant; witnessed in __tests__/architecture, including the
 * single-bundle assertion). Session state lives in the shared
 * WorkshopSessionService inside that bundle, so closing and reopening the
 * panel rehydrates the thread.
 */

import * as vscode from 'vscode';
// All core symbols via the public barrel (ADR 2026-06-16 monorepo boundary).
import {
  CoreServices,
  MessageHandler,
  Platform,
  SURFACE_WORKSHOP,
  coerceWebviewErrorText,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

export class WorkshopPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'prose-minion.workshop';

  private panel?: vscode.WebviewPanel;
  private messageHandler?: MessageHandler;
  private configWatcher?: vscode.Disposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly coreServices: CoreServices,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform
  ) {}

  /**
   * Open the Workshop panel, or reveal the existing one — the command is
   * idempotent; there is never more than one Workshop.
   */
  public openOrReveal(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WorkshopPanelProvider.viewType,
      'Workshop',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true
      }
    );
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prose-minion-book.svg');
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, SURFACE_WORKSHOP);

    // The per-webview message seam, over the ONE injected CoreServices bundle.
    // Two MessageHandlers may now be live (sidebar + Workshop); shared-service
    // registrations are listener-based so neither steals the other's signals,
    // and dispose releases only this instance's subscriptions.
    this.messageHandler?.dispose();
    this.messageHandler = new MessageHandler(
      this.coreServices,
      (message) => panel.webview.postMessage(message),
      this.platform,
      this.outputChannel
    );

    // Config-change watcher lives in the shell (keeps MessageHandler
    // vscode-free), mirroring the sidebar provider's wiring.
    this.configWatcher?.dispose();
    this.configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      this.messageHandler?.handleConfigurationChange(section => event.affectsConfiguration(section));
    });

    // Webview boot errors are logged HERE with the surface tag before the
    // domain route would swallow them into the sidebar-identical UIHandler
    // line. Parsing goes through the shared coercer — the same one UIHandler
    // uses — never a fork of it. Everything else routes to the handler.
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      const text = coerceWebviewErrorText(message);
      if (text !== undefined) {
        this.outputChannel.appendLine(`[WEBVIEW ERROR] (workshop) ${text}`);
        return;
      }
      void this.messageHandler?.handleMessage(message as Parameters<MessageHandler['handleMessage']>[0]);
    });

    // Messages posted while an editor tab is hidden can be dropped even under
    // retainContextWhenHidden — replay the cache on re-reveal, exactly like
    // the sidebar does on visibility change.
    const viewStateSubscription = panel.onDidChangeViewState(() => {
      if (panel.visible) {
        this.messageHandler?.flushCachedResults?.();
      }
    });

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      this.configWatcher?.dispose();
      this.configWatcher = undefined;
      this.messageHandler?.dispose();
      this.messageHandler = undefined;
      this.panel = undefined;
    });

    this.panel = panel;
    this.outputChannel.appendLine('[Workshop] Panel opened');
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }
}
