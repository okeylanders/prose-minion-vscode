/**
 * WorkshopPanelProvider — Application layer.
 *
 * Owns the single Workshop editor-tab surface (ADR 2026-07-03): one
 * `WebviewPanel`, created on demand by the `prose-minion.openWorkshop`
 * command, revealed rather than duplicated when it already exists, and
 * retained while hidden so the panel survives tab switches. VS Code may also
 * restore the editor shell through this provider's serializer; session state
 * still hydrates through the normal Workshop request path, never serializer
 * state.
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
  LightboxWorkshopHandoffOutcome,
  WorkshopLexicalGravityBuildSeed,
  WorkshopLexicalGravityBuildSeedAnswerPayload,
  WorkshopOpenLexicalGravityBuildMessage,
  WorkshopUiActions,
  WorkshopSetExcerptMessage,
  coerceWebviewErrorText,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

/**
 * How long a handed-over Build lens seed waits for the Workshop to open it.
 * Past it the Lightbox is told the Workshop did not confirm, and the seed is
 * dropped, so it can never surface later unasked.
 */
export const WORKSHOP_BUILD_SEED_TIMEOUT_MS = 20_000;

/** One handed-over seed, owned by the panel that accepted it, until the Workshop answers. */
interface PendingBuildSeed {
  panel: vscode.WebviewPanel;
  deliveryId: string;
  message: WorkshopOpenLexicalGravityBuildMessage;
  delivered: boolean;
  settle: (outcome: LightboxWorkshopHandoffOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WorkshopPanelProvider implements vscode.Disposable, vscode.WebviewPanelSerializer {
  public static readonly viewType = 'prose-minion.workshop';

  private panel?: vscode.WebviewPanel;
  private messageHandler?: MessageHandler;
  private configWatcher?: vscode.Disposable;
  /**
   * Whether the current panel's webview has sent its first message, so its
   * listeners are attached. A handoff that is not session state (a Build
   * lens subject) waits for it, since a booting webview would drop it.
   */
  private webviewListening = false;
  private pendingBuildSeed?: PendingBuildSeed;
  private buildSeedCount = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly coreServices: CoreServices,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform,
    private readonly uiActions: WorkshopUiActions = {}
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
    this.attachPanel(panel, 'opened');
  }

  /**
   * VS Code restores only the editor shell. The serialized webview state is
   * deliberately ignored: WORKSHOP_REQUEST_SESSION follows the same shared
   * current-session hydration path as a manually opened panel.
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
    // A serializer and command cannot normally race, but keep the one-panel
    // invariant explicit if VS Code ever delivers both paths. A seed belongs
    // to the panel that accepted it: a replacement panel never inherits it.
    this.settleBuildSeed({ opened: false, reason: 'closed' });
    this.panel?.dispose();

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prose-minion-book.svg');
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, SURFACE_WORKSHOP);
    this.webviewListening = false;

    // The per-webview message seam, over the ONE injected CoreServices bundle.
    // Two MessageHandlers may now be live (sidebar + Workshop); shared-service
    // registrations are listener-based so neither steals the other's signals,
    // and dispose releases only this instance's subscriptions.
    this.messageHandler?.dispose();
    this.messageHandler = new MessageHandler(
      this.coreServices,
      (message) => panel.webview.postMessage(message),
      this.platform,
      this.outputChannel,
      this.uiActions
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
      // A late message from a panel that is no longer the Workshop never
      // reaches the current panel's handler, and never answers its seed.
      if (this.panel !== panel) {
        return;
      }
      // The Workshop's answer to a handed-over seed is the provider's to take:
      // it settles the handoff, for the panel that accepted it, and goes no further.
      if (shape?.type === MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER) {
        this.answerBuildSeed(panel, shape.payload as WorkshopLexicalGravityBuildSeedAnswerPayload | undefined);
        return;
      }
      void this.messageHandler?.handleMessage(message as Parameters<MessageHandler['handleMessage']>[0]);
      if (!this.webviewListening) {
        this.webviewListening = true;
        this.deliverPendingBuildSeed(panel);
      }
    });

    // Messages posted while an editor tab is hidden can be dropped even under
    // retainContextWhenHidden — replay the cache on re-reveal, exactly like
    // the sidebar does on visibility change.
    const viewStateSubscription = panel.onDidChangeViewState(() => {
      if (panel.visible && this.panel === panel) {
        this.messageHandler?.flushCachedResults?.();
        // A retained tab does not remount React. Reuse the normal load route
        // so Git changes are adopted before the writer continues this room.
        void this.messageHandler?.handleMessage({
          type: MessageType.WORKSHOP_REQUEST_SESSION,
          source: 'webview.workshop',
          payload: {},
          timestamp: Date.now()
        });
        // A Build lens seed handed over while the tab was hidden lands now.
        this.deliverPendingBuildSeed(panel);
      }
    });

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      // Only the panel that owns the current lifecycle may tear down the
      // shared fields. This protects a restored panel if an older panel's
      // disposal notification arrives late.
      if (this.panel === panel) {
        this.settleBuildSeed({ opened: false, reason: 'closed' });
        this.configWatcher?.dispose();
        this.configWatcher = undefined;
        this.messageHandler?.dispose();
        this.messageHandler = undefined;
        this.panel = undefined;
      }
    });

    this.panel = panel;
    this.outputChannel.appendLine(`[Workshop] Panel ${lifecycle}`);
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

  /**
   * Open Lexical Gravity's Build lens with a subject handed over from the
   * Lightbox (ADR 2026-10-19 D11). Opens/reveals the panel, then routes a
   * synthetic WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD through the panel's OWN
   * MessageHandler, as `seedExcerpt` does: the Workshop's handler checks the
   * seed and its webview opens the sheet prefilled. Nothing is built until
   * the writer presses Build.
   *
   * The seed belongs to the panel that accepted it (PR #150 F-03). It is
   * delivered once, only when that panel's webview is listening and its tab
   * is visible (a booting or hidden webview can drop it); a newer seed
   * replaces it, and closing that panel cancels it. The promise settles with
   * the Workshop's own answer, opened or refused, or a timeout: the Lightbox
   * says "sent" only when a visible Workshop opened it.
   */
  public seedLexicalGravityBuild(seed: WorkshopLexicalGravityBuildSeed): Promise<LightboxWorkshopHandoffOutcome> {
    this.openOrReveal();
    const panel = this.panel;
    if (!panel || !this.messageHandler) {
      return Promise.resolve({ opened: false, reason: 'unavailable' });
    }
    this.settleBuildSeed({ opened: false, reason: 'replaced' });
    const deliveryId = `lexical-build-seed-${Date.now()}-${++this.buildSeedCount}`;
    return new Promise((settle) => {
      this.pendingBuildSeed = {
        panel,
        deliveryId,
        message: {
          type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
          source: 'extension.lightbox',
          payload: { seed, deliveryId },
          timestamp: Date.now()
        },
        delivered: false,
        settle,
        timer: setTimeout(() => this.settleBuildSeed({ opened: false, reason: 'timeout' }, deliveryId), WORKSHOP_BUILD_SEED_TIMEOUT_MS)
      };
      this.deliverPendingBuildSeed(panel);
    });
  }

  /** The delivery boundary: once, to the panel that accepted it, listening and visible. */
  private deliverPendingBuildSeed(panel: vscode.WebviewPanel): void {
    const pending = this.pendingBuildSeed;
    if (!pending || pending.delivered || pending.panel !== panel || this.panel !== panel || !this.webviewListening || !panel.visible) {
      return;
    }
    pending.delivered = true;
    void this.messageHandler?.handleMessage(pending.message);
  }

  /** The Workshop webview's answer: settles the handoff only for the panel and delivery it names. */
  private answerBuildSeed(panel: vscode.WebviewPanel, answer: WorkshopLexicalGravityBuildSeedAnswerPayload | undefined): void {
    const pending = this.pendingBuildSeed;
    if (!pending || !answer || pending.panel !== panel || this.panel !== panel || pending.deliveryId !== answer.seedId) {
      return;
    }
    this.settleBuildSeed(answer.opened ? { opened: true } : { opened: false, reason: 'busy' });
  }

  /** Settle the pending seed (the one named, when `deliveryId` is given) and forget it. */
  private settleBuildSeed(outcome: LightboxWorkshopHandoffOutcome, deliveryId?: string): void {
    const pending = this.pendingBuildSeed;
    if (!pending || (deliveryId !== undefined && pending.deliveryId !== deliveryId)) {
      return;
    }
    this.pendingBuildSeed = undefined;
    clearTimeout(pending.timer);
    pending.settle(outcome);
  }

  public dispose(): void {
    // Shutdown must quiesce the Workshop run before the composition root awaits
    // its final persistence flush. Do this explicitly rather than relying on the
    // panel's disposal event ordering: MessageHandler.dispose aborts/abandons an
    // active run, which makes the aggregate exportable at a committed boundary.
    const panel = this.panel;
    this.panel = undefined;
    this.settleBuildSeed({ opened: false, reason: 'closed' });
    this.configWatcher?.dispose();
    this.configWatcher = undefined;
    this.messageHandler?.dispose();
    this.messageHandler = undefined;
    panel?.dispose();
  }
}
