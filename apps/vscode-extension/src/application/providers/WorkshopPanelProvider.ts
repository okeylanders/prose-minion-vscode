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
  MessageType,
  Platform,
  SURFACE_WORKSHOP,
  WorkshopExcerptSource,
  WorkshopSetExcerptMessage,
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

    // BOOT errors — the HTML bootstrap's bare `{type, message}` shape, no
    // envelope — are logged HERE with the surface tag: a pre-React failure
    // must say which surface died, and it can never reach the router
    // usefully. ENVELOPED webview errors (React error boundaries, with
    // `payload.details` carrying the componentStack) flow to the handler
    // like every other message, so UIHandler logs the text AND the Details
    // line exactly as it does for the sidebar (PR #67 review #10). Text
    // parsing stays in the shared coercer in both paths — never a fork.
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      const shape = message as { type?: unknown; payload?: unknown } | null;
      const isBareBootError =
        shape?.type === MessageType.WEBVIEW_ERROR && shape.payload === undefined;
      if (isBareBootError) {
        const text = coerceWebviewErrorText(message);
        if (text !== undefined) {
          this.outputChannel.appendLine(`[WEBVIEW ERROR] (workshop) ${text}`);
        }
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

  /**
   * Seed the pinned excerpt from outside the webview (the editor context-menu
   * command, Sprint 3). Opens/reveals the panel, then routes a synthetic
   * WORKSHOP_SET_EXCERPT through the panel's OWN MessageHandler — the exact
   * same path a webview pin takes, so the mid-run guard, provenance stamping,
   * and session-state broadcast all apply identically (a parallel seeding
   * mechanism would be a boundary smell — sprint guardrail). If the webview
   * is still booting, its mount-time WORKSHOP_REQUEST_SESSION picks the
   * excerpt up from the session snapshot — no race.
   */
  public seedExcerpt(payload: { text: string; source?: WorkshopExcerptSource }): void {
    this.openOrReveal();
    const message: WorkshopSetExcerptMessage = {
      type: MessageType.WORKSHOP_SET_EXCERPT,
      source: 'webview.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.messageHandler?.handleMessage(message);
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }
}
