/**
 * WorkshopPanelProvider — Application layer.
 *
 * Owns the single Workshop editor-tab surface (ADR 2026-07-03): one
 * `WebviewPanel`, created on demand by the `prose-minion.openWorkshop`
 * command, revealed rather than duplicated when it already exists, and
 * retained while hidden so the panel survives tab switches (v1 persistence;
 * the WebviewPanelSerializer is explicitly out of scope).
 *
 * Sprint 1 (shell): the panel renders the static <WorkshopApp/> root from the
 * shared webview bundle — no domain messages, no session state. CoreServices
 * and Platform are injected NOW so Sprint 2 can hand them to a MessageHandler
 * without re-plumbing the constructor. Nothing is `new`-ed here (ADR
 * 2026-06-18 composition-root invariant; witnessed in __tests__/architecture).
 */

import * as vscode from 'vscode';
// All core symbols via the public barrel (ADR 2026-06-16 monorepo boundary).
import { CoreServices, Platform } from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

export class WorkshopPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'proseMinion.workshop';

  private panel?: vscode.WebviewPanel;

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
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, 'workshop');

    // Sprint 1 has no domain message path (that is Sprint 2's WorkshopHandler).
    // We only surface webview boot errors so a broken shell is diagnosable
    // from the host side — same `webview_error` bridge the HTML shell posts on.
    panel.webview.onDidReceiveMessage((message: { type?: string; message?: string }) => {
      if (message?.type === 'webview_error') {
        this.outputChannel.appendLine(`[Workshop] Webview error: ${message.message ?? 'unknown'}`);
      }
    });

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel = panel;
    this.outputChannel.appendLine(
      `[Workshop] Panel opened (services wired: ${Object.keys(this.coreServices).length}, platform: ${this.platform ? 'ok' : 'missing'})`
    );
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }
}
