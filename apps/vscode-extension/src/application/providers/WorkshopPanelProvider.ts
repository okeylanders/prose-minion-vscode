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
  WorkshopLexicalGravityBuildSeed,
  WorkshopLightboxTile,
  WorkshopOpenLexicalGravityBuildMessage,
  WorkshopSeedClaimResultMessage,
  WorkshopSeedDelivery,
  WorkshopSeedKind,
  WorkshopSeedOutcome,
  WorkshopSeedRefusal,
  WorkshopStageLightboxTileMessage,
  WorkshopUiActions,
  WorkshopSetExcerptMessage,
  coerceWebviewErrorText,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

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
  /**
   * Handed-over seeds, one delivery per kind (PR #150 F-03). Each seed
   * belongs to the panel that accepted it, is sent to that panel only when it
   * is ready, and opens only if the webview's claim is granted: one that
   * timed out, was replaced or lost its panel is denied and dropped there.
   */
  private readonly seedDeliveries: Record<WorkshopSeedKind, WorkshopSeedDelivery<vscode.WebviewPanel>> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- seed kinds are kebab-case protocol literals.
    'lexical-gravity-build': this.createSeedDelivery('lexical-gravity-build'),
    // eslint-disable-next-line @typescript-eslint/naming-convention -- seed kinds are kebab-case protocol literals.
    'lightbox-tile': this.createSeedDelivery('lightbox-tile')
  };

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
    this.closeSeeds();
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
      // A handed-over seed's claim and answer are the provider's to take: they
      // decide, for the panel that accepted it, whether it opens, and go no further.
      if (shape?.type === MessageType.WORKSHOP_SEED_CLAIM || shape?.type === MessageType.WORKSHOP_SEED_ANSWER) {
        this.receiveSeedMessage(panel, shape.type, shape.payload);
        return;
      }
      void this.messageHandler?.handleMessage(message as Parameters<MessageHandler['handleMessage']>[0]);
      if (!this.webviewListening) {
        this.webviewListening = true;
        this.deliverSeeds(panel);
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
        // A seed handed over while the tab was hidden is sent now.
        this.deliverSeeds(panel);
      }
    });

    panel.onDidDispose(() => {
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      // Only the panel that owns the current lifecycle may tear down the
      // shared fields. This protects a restored panel if an older panel's
      // disposal notification arrives late.
      if (this.panel === panel) {
        this.closeSeeds();
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
   * Lightbox (ADR 2026-10-19 D11). Opens/reveals the panel, then offers the
   * seed to it: when the panel is ready, a synthetic
   * WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD goes through the panel's OWN
   * MessageHandler, as `seedExcerpt` does, and the Workshop's handler checks
   * the seed and posts it to the webview with its delivery id. The webview
   * opens it only if its claim is granted (PR #150 F-03), and nothing is
   * built until the writer presses Build. The promise settles with the
   * webview's answer, or why the seed did not open.
   */
  public seedLexicalGravityBuild(seed: WorkshopLexicalGravityBuildSeed): Promise<WorkshopSeedOutcome> {
    this.openOrReveal();
    const panel = this.panel;
    if (!panel || !this.messageHandler) {
      return Promise.resolve({ opened: false, reason: 'unavailable' });
    }
    return this.seedDeliveries['lexical-gravity-build'].offer(panel, (deliveryId) => {
      const message: WorkshopOpenLexicalGravityBuildMessage = {
        type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
        source: 'extension.lightbox',
        payload: { seed, deliveryId },
        timestamp: Date.now()
      };
      void this.messageHandler?.handleMessage(message);
    });
  }

  /**
   * Stage a Lightbox tile above the Workshop composer (ADR 2026-10-19 D11;
   * Slice 4). Opens/reveals the panel, then offers the tile to it, the way
   * `seedLexicalGravityBuild` offers a Build lens subject: when the panel is
   * ready, a synthetic WORKSHOP_STAGE_LIGHTBOX_TILE goes through the panel's
   * OWN MessageHandler, whose tile handler checks the item, holds it and tells
   * the webview it is waiting. Only after the webview's claim is granted does
   * it ask the handler to stage it, as a pending message attachment; nothing
   * is sent until the writer sends. The promise settles with the webview's
   * answer (staged, or busy, full or duplicate), or why the tile did not arrive.
   */
  public stageLightboxTile(tile: WorkshopLightboxTile): Promise<WorkshopSeedOutcome> {
    this.openOrReveal();
    const panel = this.panel;
    if (!panel || !this.messageHandler) {
      return Promise.resolve({ opened: false, reason: 'unavailable' });
    }
    return this.seedDeliveries['lightbox-tile'].offer(panel, (deliveryId) => {
      const message: WorkshopStageLightboxTileMessage = {
        type: MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE,
        source: 'extension.lightbox',
        payload: { tile, deliveryId },
        timestamp: Date.now()
      };
      void this.messageHandler?.handleMessage(message);
    });
  }

  /** One kind's delivery: ready only for the current, listening, visible panel. */
  private createSeedDelivery(kind: WorkshopSeedKind): WorkshopSeedDelivery<vscode.WebviewPanel> {
    return new WorkshopSeedDelivery<vscode.WebviewPanel>(kind, {
      isReady: (panel) => this.panel === panel && this.webviewListening && panel.visible,
      postClaimResult: (panel, result) => {
        const message: WorkshopSeedClaimResultMessage = {
          type: MessageType.WORKSHOP_SEED_CLAIM_RESULT,
          source: 'extension.workshop',
          payload: result,
          timestamp: Date.now()
        };
        void panel.webview.postMessage(message);
      }
    });
  }

  /** Send every waiting seed this panel accepted, if it is ready for it. */
  private deliverSeeds(panel: vscode.WebviewPanel): void {
    Object.values(this.seedDeliveries).forEach((delivery) => delivery.deliver(panel));
  }

  /** Nothing the closing panel accepted can open any more. */
  private closeSeeds(): void {
    Object.values(this.seedDeliveries).forEach((delivery) => delivery.close());
  }

  /** A claim or answer from the current panel's webview, routed to its kind's delivery. */
  private receiveSeedMessage(panel: vscode.WebviewPanel, type: MessageType, payload: unknown): void {
    const shape = payload as { kind?: unknown; deliveryId?: unknown; opened?: unknown; reason?: unknown } | undefined;
    const delivery = typeof shape?.kind === 'string' && Object.prototype.hasOwnProperty.call(this.seedDeliveries, shape.kind)
      ? this.seedDeliveries[shape.kind as WorkshopSeedKind]
      : undefined;
    if (!delivery || typeof shape?.deliveryId !== 'string') {
      return;
    }
    if (type === MessageType.WORKSHOP_SEED_CLAIM) {
      delivery.claim(panel, shape.deliveryId);
      return;
    }
    delivery.answer(panel, shape.opened === true
      ? { deliveryId: shape.deliveryId, opened: true }
      : { deliveryId: shape.deliveryId, opened: false, reason: seedRefusalOf(shape.reason) });
  }

  public dispose(): void {
    // Shutdown must quiesce the Workshop run before the composition root awaits
    // its final persistence flush. Do this explicitly rather than relying on the
    // panel's disposal event ordering: MessageHandler.dispose aborts/abandons an
    // active run, which makes the aggregate exportable at a committed boundary.
    const panel = this.panel;
    this.panel = undefined;
    this.closeSeeds();
    this.configWatcher?.dispose();
    this.configWatcher = undefined;
    this.messageHandler?.dispose();
    this.messageHandler = undefined;
    panel?.dispose();
  }
}

/** A refusal the webview named, when it is one; anything else reads as busy. */
function seedRefusalOf(reason: unknown): WorkshopSeedRefusal {
  switch (reason) {
    case 'full':
    case 'duplicate':
      return reason;
    default:
      return 'busy';
  }
}
