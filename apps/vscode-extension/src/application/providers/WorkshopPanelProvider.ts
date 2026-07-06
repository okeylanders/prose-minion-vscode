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
import { CoreServices, Platform, SURFACE_WORKSHOP, coerceWebviewErrorText } from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

export class WorkshopPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'prose-minion.workshop';

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
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, SURFACE_WORKSHOP);

    // Sprint 1 has no domain message path (that is Sprint 2's WorkshopHandler).
    // We only surface webview boot errors so a broken shell is diagnosable from
    // the host side. Parsing goes through the shared coercer — the same one
    // UIHandler uses for the sidebar — which validates the IPC payload as
    // unknown, flattens newlines, and caps length. The `[WEBVIEW ERROR]`
    // prefix is the greppable string the sidebar has always logged under;
    // `(workshop)` marks the surface.
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      const text = coerceWebviewErrorText(message);
      if (text !== undefined) {
        this.outputChannel.appendLine(`[WEBVIEW ERROR] (workshop) ${text}`);
      }
    });

    panel.onDidDispose(() => {
      messageSubscription.dispose();
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
