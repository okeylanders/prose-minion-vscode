/** One attached Workshop editor, permanently bound to its room and seed receivers. */
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
// All core symbols via the public barrel (ADR 2026-06-16 monorepo boundary).
import {
  CoreServices,
  MessageHandler,
  MessageType,
  Platform,
  SURFACE_WORKSHOP,
  type WorkshopBranchDraftMessage,
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
  WorkshopStageSelectedTextMessage,
  WorkshopUiActions,
  WorkshopSetExcerptMessage,
  workshopExcerptTitle,
  coerceWebviewErrorText,
} from '@prose-minion/core';
import { getWebviewHtml } from './webviewHtml';

const MAX_RECEIVER = 80;

export interface WorkshopBranchOpening {
  sessionId: string;
  drafts: readonly WorkshopBranchDraftMessage[];
}

export class WorkshopPanelTab {
  /** Opaque UI navigation handle for this attachment; never a disk slot or mutation destination. */
  readonly trayToken = randomUUID();
  title: string;
  private excerptTitle?: string;
  readonly ready: Promise<void>;
  private closed = false;
  private readonly tileReceipts = new Map<string, () => void>();
  private messageHandler?: MessageHandler;
  private initialRoomRevision?: number;
  private readonly subscriptions: vscode.Disposable[] = [];
  /**
   * The current panel's seed receiver: the webview realm that announced
   * itself (`WORKSHOP_SEED_RECEIVER`) once its listeners were attached. A
   * handed-over seed waits for one, since a booting webview would drop it,
   * and a new one on the same panel means the webview was reloaded: what
   * was granted to the old one is released (PR #150 F-08).
   */
  private seedReceiver?: string;
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
    'lightbox-tile': this.createSeedDelivery('lightbox-tile'),
    // eslint-disable-next-line @typescript-eslint/naming-convention -- seed kinds are kebab-case protocol literals.
    'selected-text': this.createSeedDelivery('selected-text')
  };


  constructor(
    readonly roomId: string,
    readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly coreServices: CoreServices,
    roomReady: Promise<void>,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform,
    private readonly uiActions: WorkshopUiActions,
    onFocus: () => void,
    onClose: () => void,
    private readonly onTitleChange: () => void,
    readonly scratchTitle: string,
    private branch?: WorkshopBranchOpening
  ) {
    this.title = scratchTitle;
    panel.title = scratchTitle;
    this.subscriptions.push(panel.onDidDispose(onClose));
    this.subscriptions.push(panel.onDidChangeViewState(() => {
      if (this.closed) {
        return;
      }
      if (panel.active) {
        onFocus();
      }
      this.messageHandler?.setWorkshopSurfaceVisible?.(panel.visible);
      if (panel.visible && this.messageHandler) {
        this.messageHandler.flushCachedResults();
        void this.messageHandler.handleMessage({
          type: MessageType.WORKSHOP_REQUEST_SESSION,
          source: 'webview.workshop',
          payload: {},
          timestamp: Date.now()
        });
        this.deliverSeeds(panel);
      }
    }));
    // Stamp the serialized slot as soon as the shell can run, including when disk hydration is slow.
    // Buffer early routes behind the same barrier as external excerpts; close abandons them all.
    this.ready = roomReady.then(async () => {
      if (!this.closed && this.branch) {
        await this.coreServices.workshopSessionPersistenceCoordinator.openNamed(this.branch.sessionId);
      }
      if (!this.closed) {
        this.mountHandler();
      }
    }).catch(error => {
      if (this.closed) {
        return;
      }
      this.outputChannel.appendLine(`[Workshop] Room could not open: ${String(error)}`);
      void vscode.window.showErrorMessage('This Workshop room could not open. Its checkpoint remains available to reopen.');
      onClose();
      panel.dispose();
    });
    panel.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prose-minion-book.svg');
    this.subscriptions.push(panel.webview.onDidReceiveMessage(message => {
      if (this.messageHandler) {
        this.receive(message);
      } else {
        void this.ready.then(() => this.receive(message));
      }
    }));
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, SURFACE_WORKSHOP, this.roomId);
  }

  private mountHandler(): void {
    const panel = this.panel;
    this.initialRoomRevision = this.coreServices.workshopSessionService.readRoomRevision();
    this.messageHandler = new MessageHandler(
      this.coreServices,
      message => {
        if (this.closed) {
          return Promise.resolve(false);
        }
        if (message.type === MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED && message.payload.staged) {
          // The host committed *this* delivery. Keep its receipt even if the webview never answers.
          this.tileReceipts.get(message.payload.deliveryId)?.();
        }
        if (message.type === MessageType.WORKSHOP_SESSION_STATE) {
          const source = message.payload.session.excerpt?.source;
          this.excerptTitle = source && source.kind !== 'manual' ? workshopExcerptTitle(source) : undefined;
        }
        if (message.type === MessageType.WORKSHOP_SESSION_STATE ||
            (message.type === MessageType.WORKSHOP_SESSION_ACTION_RESULT && message.payload.ok)) {
          // Save and Rename acknowledge through the action route without broadcasting a fresh session.
          const identity = this.coreServices.workshopSessionPersistenceCoordinator.openRoomIdentity();
          const label = identity.namedSessionId ? identity.title : this.excerptTitle;
          const title = label ? `Workshop · ${label}` : this.scratchTitle;
          if (title !== this.title) {
            this.title = title;
            this.onTitleChange();
          }
        }
        return panel.webview.postMessage(message);
      },
      this.platform,
      this.outputChannel,
      this.uiActions
    );
    const unsubscribe = this.coreServices.workshopSessionPersistenceCoordinator.onRoomReplaced(() => {
      this.branch = undefined;
      Object.values(this.seedDeliveries).forEach(delivery => delivery.close('room-changed'));
    });
    this.subscriptions.push({ dispose: unsubscribe });
    this.messageHandler.setWorkshopSurfaceVisible?.(panel.visible);
    this.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
      this.messageHandler?.handleConfigurationChange(section => event.affectsConfiguration(section));
    }));
  }

  private receive(message: unknown): void {
    if (this.closed) {
      return;
    }
    const panel = this.panel;
    // Bootstrap errors precede the normal envelope. React boundary errors still reach UIHandler with details.
    const shape = message as { type?: unknown; payload?: unknown } | null;
    if (shape?.type === MessageType.WEBVIEW_ERROR && shape.payload === undefined) {
      const text = coerceWebviewErrorText(message);
      if (text !== undefined) {
        this.outputChannel.appendLine(`[WEBVIEW ERROR] (workshop) ${text}`);
      }
      return;
    }
    // A handed-over seed's claim and answer are the provider's to take: they
    // decide, for the panel that accepted it, whether it opens, and go no further.
    if (
      shape?.type === MessageType.WORKSHOP_SEED_CLAIM
      || shape?.type === MessageType.WORKSHOP_SEED_ANSWER
      || shape?.type === MessageType.WORKSHOP_SEED_RECEIVER
    ) {
      this.receiveSeedMessage(panel, shape.type, shape.payload);
      return;
    }
    // A tile's accept stages it in the session: only under the grant it names (PR #151 F-06).
    if (shape?.type === MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE && !this.acceptsSeed('lightbox-tile', panel, shape.payload)) {
      this.outputChannel.appendLine('[Workshop] A tile accept was dropped: its delivery is not granted to this webview');
      return;
    }
    // A selection's accept, the same way (ADR 2026-11-14 D12).
    if (shape?.type === MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT && !this.acceptsSeed('selected-text', panel, shape.payload)) {
      this.outputChannel.appendLine('[Workshop] A selection accept was dropped: its delivery is not granted to this webview');
      return;
    }
    const handled = this.messageHandler?.handleMessage(message as Parameters<MessageHandler['handleMessage']>[0]);
    // The mount request comes from a listening webview. Synthetic focus refreshes
    // never consume a branch draft, and replacing the room cancels a pending one.
    const branch = this.branch;
    if (branch && shape?.type === MessageType.WORKSHOP_REQUEST_SESSION && handled) {
      void handled.then(() => {
        if (this.closed || this.branch !== branch) { return; }
        this.branch = undefined;
        for (const draft of branch.drafts) { void panel.webview.postMessage(draft); }
      });
    }
  }

  /** Follow the Sessions browser's normal named-open transaction in this new, hydrated slot. */
  async openNamedSession(sessionId: string): Promise<void> {
    await this.ready;
    if (this.closed) return;
    await this.messageHandler?.handleMessage({
      type: MessageType.WORKSHOP_OPEN_SESSION, source: 'webview.workshop', payload: { sessionId }, timestamp: Date.now()
    });
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
    const message: WorkshopSetExcerptMessage = {
      type: MessageType.WORKSHOP_SET_EXCERPT,
      source: 'webview.workshop',
      payload,
      timestamp: Date.now()
    };
    if (this.messageHandler) {
      void this.messageHandler.handleMessage(message);
    } else {
      void this.ready.then(() => this.messageHandler?.handleMessage(message));
    }
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
    const panel = this.panel;
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
  public stageLightboxTile(tile: WorkshopLightboxTile, onStaged?: () => void): Promise<WorkshopSeedOutcome> {
    const panel = this.panel;
    let sentId: string | undefined;
    const outcome = this.seedDeliveries['lightbox-tile'].offer(panel, (deliveryId) => {
      if (onStaged) {
        sentId = deliveryId;
        this.tileReceipts.set(deliveryId, onStaged);
      }
      const message: WorkshopStageLightboxTileMessage = {
        type: MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE,
        source: 'extension.lightbox',
        payload: { tile, deliveryId },
        timestamp: Date.now()
      };
      void this.messageHandler?.handleMessage(message);
    });
    return outcome.finally(() => {
      if (sentId !== undefined) {
        this.tileReceipts.delete(sentId);
      }
    });
  }

  /**
   * Stage the editor's selection above the Workshop composer (ADR 2026-11-14
   * D12), the way `stageLightboxTile` stages a tile. The offer carries the
   * snapshot's id only: the command captured it at its gesture, and the
   * Workshop's handler reads the snapshot by that id when the webview's
   * granted claim asks it to stage. The promise settles with the webview's
   * answer (staged, or busy, full or duplicate), or why it did not arrive.
   */
  public stageSelectedText(snapshotId: string): Promise<WorkshopSeedOutcome> {
    const panel = this.panel;
    return this.seedDeliveries['selected-text'].offer(panel, (deliveryId) => {
      const message: WorkshopStageSelectedTextMessage = {
        type: MessageType.WORKSHOP_STAGE_SELECTED_TEXT,
        source: 'extension.workshop',
        payload: { deliveryId, snapshotId },
        timestamp: Date.now()
      };
      void this.messageHandler?.handleMessage(message);
    });
  }

  /** One kind's delivery: ready only for the current, listening, visible panel. */
  private createSeedDelivery(kind: WorkshopSeedKind): WorkshopSeedDelivery<vscode.WebviewPanel> {
    return new WorkshopSeedDelivery<vscode.WebviewPanel>(kind, {
      isReady: (panel) => !this.closed && this.messageHandler !== undefined && this.panel === panel && this.seedReceiver !== undefined && panel.visible,
      receiverOf: (panel) => (!this.closed && this.panel === panel ? this.seedReceiver : undefined),
      postClaimResult: (panel, result) => {
        const message: WorkshopSeedClaimResultMessage = {
          type: MessageType.WORKSHOP_SEED_CLAIM_RESULT,
          source: 'extension.workshop',
          payload: result,
          timestamp: Date.now()
        };
        void panel.webview.postMessage(message);
      }
    }, { mintDeliveryId: () => `${kind}-${randomUUID()}` });
  }

  /** Send every waiting seed this panel accepted, if it is ready for it. */
  private deliverSeeds(panel: vscode.WebviewPanel): void {
    Object.values(this.seedDeliveries).forEach((delivery) => delivery.deliver(panel));
  }

  /** Nothing the closing panel accepted can open any more. */
  private closeSeeds(): void {
    Object.values(this.seedDeliveries).forEach((delivery) => delivery.close());
  }

  /**
   * A receiver's announcement, claim or answer from the current panel's
   * webview. An announcement from a new receiver means the webview was
   * replaced: every kind's delivery releases what the old one held, then
   * sends what waits. A claim or answer goes to its kind's delivery, which
   * ignores one from a receiver the panel no longer has.
   */
  private receiveSeedMessage(panel: vscode.WebviewPanel, type: MessageType, payload: unknown): void {
    const shape = payload as {
      kind?: unknown; deliveryId?: unknown; opened?: unknown; reason?: unknown; receiver?: unknown;
    } | undefined;
    const receiver = typeof shape?.receiver === 'string' && shape.receiver.length > 0 && shape.receiver.length <= MAX_RECEIVER
      ? shape.receiver
      : undefined;
    if (type === MessageType.WORKSHOP_SEED_RECEIVER) {
      if (!receiver) {
        return;
      }
      if (receiver !== this.seedReceiver) {
        const replaced = this.seedReceiver !== undefined;
        this.seedReceiver = receiver;
        if (replaced) {
          this.outputChannel.appendLine('[Workshop] The webview was reloaded; handoffs granted to the old one were released');
        }
        Object.values(this.seedDeliveries).forEach((delivery) => delivery.resetReceiver(panel));
      }
      this.deliverSeeds(panel);
      return;
    }
    const delivery = typeof shape?.kind === 'string' && Object.prototype.hasOwnProperty.call(this.seedDeliveries, shape.kind)
      ? this.seedDeliveries[shape.kind as WorkshopSeedKind]
      : undefined;
    if (!delivery || typeof shape?.deliveryId !== 'string' || !receiver) {
      return;
    }
    if (type === MessageType.WORKSHOP_SEED_CLAIM) {
      delivery.claim(panel, shape.deliveryId, receiver);
      return;
    }
    delivery.answer(panel, shape.opened === true
      ? { deliveryId: shape.deliveryId, opened: true }
      : { deliveryId: shape.deliveryId, opened: false, reason: seedRefusalOf(shape.reason) }, receiver);
  }

  /**
   * Whether a staged seed's accept (a tile's, a selection's) may reach the
   * session (PR #151 F-06): it names that kind's delivery granted, now, to
   * the receiver that sends it. The path from here to the staging mutation
   * is synchronous (router, mutation gate, handler), so the grant checked is
   * the grant it stages under. A late accept from a reloaded webview, or one
   * for an offer never granted, stages nothing; the delivery has already
   * settled, or is still waiting.
   */
  private acceptsSeed(kind: WorkshopSeedKind, panel: vscode.WebviewPanel, payload: unknown): boolean {
    const shape = payload as { deliveryId?: unknown; receiver?: unknown } | undefined;
    return typeof shape?.deliveryId === 'string'
      && typeof shape.receiver === 'string'
      && this.seedDeliveries[kind].isGranted(panel, shape.deliveryId, shape.receiver);
  }

  roomRevision(): number | undefined {
    return this.messageHandler ? this.coreServices.workshopSessionService.readRoomRevision() : undefined;
  }

  /** Before hydration completes, a handoff belongs to the first room this tab displays. */
  stillShowsRoom(revisionAtGesture: number | undefined): boolean {
    return this.roomRevision() === (revisionAtGesture ?? this.initialRoomRevision);
  }

  dispose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.closeSeeds();
    this.subscriptions.forEach(subscription => subscription?.dispose());
    this.messageHandler?.dispose();
    this.messageHandler = undefined;
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
