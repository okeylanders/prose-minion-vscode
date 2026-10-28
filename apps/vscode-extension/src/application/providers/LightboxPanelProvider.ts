/**
 * LightboxPanelProvider — Application layer (ADR 2026-10-19 D1).
 *
 * Owns the single Lightbox editor-tab surface, a sibling of the Workshop tab:
 * one `WebviewPanel`, created on demand by `prose-minion.openLightbox` (or by
 * the editor command that sends a selection or file), revealed rather than
 * duplicated, and retained while hidden. VS Code may restore the editor shell
 * through this provider's serializer; the board still comes back through the
 * normal LIGHTBOX_REQUEST_BOARD path, never serializer state.
 *
 * The panel gets its own MessageHandler — the ONE sanctioned `new` (the
 * per-webview message seam, as in the sidebar and the Workshop) — built from
 * the SAME injected CoreServices bundle constructed in extension.ts. Nothing
 * else is `new`-ed here (ADR 2026-06-18; witnessed in __tests__/architecture).
 * Boards, the standing refusal and source-request ownership live in the
 * shared LightboxService inside that bundle, so closing and reopening the
 * panel serves the current outcome again (D12), and a request still pending
 * when the panel closed lands in the new one (PR #148 F-01). That includes a
 * file launch whose document was still loading: closing the tab is not a
 * source choice, so the launch opens the Lightbox when it loads, unless a
 * newer source was chosen meanwhile (PR #152 F-01).
 */

import * as vscode from 'vscode';
// All core symbols via the public barrel (ADR 2026-06-16 monorepo boundary).
import {
  CoreServices,
  LightboxSetSourcePayload,
  LightboxSourceTicket,
  MessageHandler,
  MessageType,
  Platform,
  SURFACE_LIGHTBOX,
  WorkshopUiActions,
  coerceWebviewErrorText,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

export class LightboxPanelProvider implements vscode.Disposable, vscode.WebviewPanelSerializer {
  public static readonly viewType = 'prose-minion.lightbox';

  private panel?: vscode.WebviewPanel;
  private messageHandler?: MessageHandler;
  private configWatcher?: vscode.Disposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly coreServices: CoreServices,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform,
    private readonly uiActions: WorkshopUiActions = {}
  ) {}

  /** Open the Lightbox, or reveal the existing one: there is never more than one. */
  public openOrReveal(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      LightboxPanelProvider.viewType,
      'Lightbox',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true
      }
    );
    this.attachPanel(panel, 'opened');
  }

  /**
   * VS Code restores only the editor shell. The serialized webview state is
   * deliberately ignored: the webview's mount-time LIGHTBOX_REQUEST_BOARD
   * reads the current outcome from the shared service.
   */
  public deserializeWebviewPanel(
    panel: vscode.WebviewPanel,
    _state: unknown
  ): Thenable<void> {
    this.attachPanel(panel, 'restored');
    return Promise.resolve();
  }

  private attachPanel(
    panel: vscode.WebviewPanel,
    lifecycle: 'opened' | 'restored'
  ): void {
    if (this.panel === panel) {
      return;
    }
    // Keep the one-panel invariant explicit if VS Code ever delivers both paths.
    this.panel?.dispose();

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prose-minion-book.svg');
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, SURFACE_LIGHTBOX);

    // The per-webview message seam, over the ONE injected CoreServices bundle.
    this.messageHandler?.dispose();
    this.messageHandler = new MessageHandler(
      this.coreServices,
      (message) => panel.webview.postMessage(message),
      this.platform,
      this.outputChannel,
      this.uiActions
    );

    // Config-change watcher lives in the shell (keeps MessageHandler vscode-free).
    this.configWatcher?.dispose();
    this.configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      this.messageHandler?.handleConfigurationChange(section => event.affectsConfiguration(section));
    });

    // BOOT errors (the HTML bootstrap's bare `{type, message}` shape) are
    // logged here with the surface tag; enveloped webview errors route to the
    // handler like every other message, exactly as in the Workshop panel.
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      const shape = message as { type?: unknown; payload?: unknown } | null;
      const isBareBootError =
        shape?.type === MessageType.WEBVIEW_ERROR && shape.payload === undefined;
      if (isBareBootError) {
        const text = coerceWebviewErrorText(message);
        if (text !== undefined) {
          this.outputChannel.appendLine(`[WEBVIEW ERROR] (lightbox) ${text}`);
        }
        return;
      }
      void this.messageHandler?.handleMessage(message as Parameters<MessageHandler['handleMessage']>[0]);
    });

    // Messages posted while an editor tab is hidden can be dropped even under
    // retainContextWhenHidden; on re-reveal, replay the cache and serve the
    // current outcome (board and undismissed refusal) through the normal
    // request route.
    const viewStateSubscription = panel.onDidChangeViewState(() => {
      if (panel.visible) {
        this.messageHandler?.flushCachedResults?.();
        void this.messageHandler?.handleMessage({
          type: MessageType.LIGHTBOX_REQUEST_BOARD,
          source: 'webview.lightbox',
          payload: {},
          timestamp: Date.now()
        });
      }
    });

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      // Only the panel that owns the current lifecycle may tear down the
      // shared fields (a late disposal of an older panel must not).
      if (this.panel === panel) {
        this.configWatcher?.dispose();
        this.configWatcher = undefined;
        this.messageHandler?.dispose();
        this.messageHandler = undefined;
        this.panel = undefined;
      }
    });

    this.panel = panel;
    this.outputChannel.appendLine(`[Lightbox] Panel ${lifecycle}`);
  }

  /**
   * Board a selection or a file from outside the webview (the editor
   * commands), under `ticket`: the source request Open File in Lightbox took
   * from the shared service when the writer chose the file, before VS Code
   * loaded it (PR #152 F-01). A selection is chosen now, so by default the
   * request is taken now. When a newer source was chosen since the ticket
   * was taken, nothing is opened, revealed or sent, and this returns false.
   *
   * Otherwise it opens or reveals the panel and boards through the panel's
   * OWN MessageHandler, into the same LightboxHandler code a webview's
   * LIGHTBOX_SET_SOURCE reaches (the Workshop's `seedExcerpt` pattern). The
   * ticket is passed as an argument, never in a message, so no webview can
   * name one. If the webview is still booting, the outcome posted now may be
   * dropped; its mount-time LIGHTBOX_REQUEST_BOARD then reads the shared
   * service's current outcome, which keeps a refusal (over-ceiling, empty,
   * unsaved) until the writer dismisses it as well as the latest board (PR
   * #148 F-02).
   */
  public seedSource(
    payload: LightboxSetSourcePayload,
    ticket: LightboxSourceTicket = this.coreServices.lightboxService.beginSourceRequest()
  ): boolean {
    if (!this.coreServices.lightboxService.isCurrentRequest(ticket)) {
      return false;
    }
    this.openOrReveal();
    void this.messageHandler?.seedLightboxSource(payload, ticket);
    return true;
  }

  public dispose(): void {
    // Handler before panel, as in the Workshop: the handler releases its
    // shared-service registrations before the webview goes away.
    const panel = this.panel;
    this.panel = undefined;
    this.configWatcher?.dispose();
    this.configWatcher = undefined;
    this.messageHandler?.dispose();
    this.messageHandler = undefined;
    panel?.dispose();
  }
}
