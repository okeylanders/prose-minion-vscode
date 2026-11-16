/**
 * Selected Text in the Workshop (ADR 2026-11-14, item B): the editor's
 * selection as a one-shot attachment of one message. The Workshop side of
 * the `selected-text` seed, and of the composer's "Include selected text".
 *
 * **The command's seed** (D12), by AGENTS.md's Seed Delivery:
 * 1. **Offer** (`WORKSHOP_STAGE_SELECTED_TEXT`, direct). Only the panel
 *    provider sends it, through this panel's own MessageHandler, once its
 *    seed delivery is ready. It carries the snapshot's id only, captured at
 *    the command's gesture; the offer is held under its delivery id and the
 *    webview is told one is waiting (`WORKSHOP_SELECTED_TEXT_OFFERED`).
 *    Nothing is staged yet: the webview claims it first.
 * 2. **Accept** (`WORKSHOP_ACCEPT_SELECTED_TEXT`, a mutation behind the
 *    session-operation gate). The provider lets it through only while that
 *    delivery is granted to the receiver that sends it. The snapshot is read
 *    by id and staged as a pending message attachment, or refused: `busy`
 *    while a response runs, the session is being saved or replaced, or the
 *    snapshot is no longer held; `full`; `duplicate`. Either way the handler
 *    answers (`WORKSHOP_SELECTED_TEXT_STAGED`), since a grant cannot be
 *    revoked and the webview must answer the provider.
 *
 * Staged, the pill is ordinary session state: persisted, removable, sent
 * only with the writer's next message. Nothing here reads the editor: the
 * snapshot service does, and text never arrives from a webview.
 *
 * **The toggle's watch** (D14). `WORKSHOP_SELECTED_TEXT_WATCH { on }`
 * subscribes or unsubscribes this panel's webview (direct: a subscription
 * changes no session state and has no answer). While it watches *and* its
 * tab is visible, the handler listens to the snapshot service and pushes
 * `WORKSHOP_SELECTED_TEXT_CURRENT`: a snapshot's metadata, or nothing
 * selected. It pushes the current state once on subscribe and when the tab
 * becomes visible again. A tab that is not watching, or not visible, hears
 * nothing and captures nothing. The live pill is not session state: a
 * selection change never dirties or saves the session. Disposal drops the
 * watch.
 *
 * **The send** (D14). A composer send may name the snapshot its live pill
 * showed, and the room the webview was showing (`roomRevision`). The room
 * handler calls `stageForSend` inside the send's own mutation, before
 * anything else: the revision is compared with the live room's first, then
 * the snapshot is read and staged, and the send goes on with it. Another
 * room (New, Open, Rewind or Branch landed in between), an id this window no
 * longer holds, or no room for another attachment refuses the *whole* send.
 * The cache is the window's and is never emptied by a room replacement:
 * what binds a pill to its room is the revision, not an eviction that
 * happens to fall right. The live selection is never sent unseen.
 *
 * Logs carry ids, kinds and counts, never the text, a path or lines.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { EditorSelectionSnapshots } from '@/application/services/workshop/selection/EditorSelectionSnapshots';
import {
  workshopSelectedTextAttachmentInput,
  workshopSelectedTextSummary,
  type EditorSelectionSnapshot
} from '@/application/services/workshop/selection/WorkshopSelectedTextAttachment';
import { LogSink, PlatformDisposable } from '@/platform';
import {
  MessageType,
  WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE,
  WORKSHOP_SELECTED_TEXT_FULL_REASON,
  WORKSHOP_SELECTED_TEXT_SNAPSHOT_ID_CHARACTERS,
  WorkshopAcceptSelectedTextMessage,
  WorkshopSeedRefusal,
  WorkshopSelectedTextCurrentMessage,
  WorkshopSelectedTextOfferedMessage,
  WorkshopSelectedTextStagedMessage,
  WorkshopSelectedTextStagedPayload,
  WorkshopSelectedTextWatchMessage,
  WorkshopSendMessagePayload,
  WorkshopStageSelectedTextMessage
} from '@messages';

const SOURCE = 'extension.workshop.selected-text';
const OWNER = '[WorkshopSelectedTextHandler]';

/** The longest delivery id the panel provider mints, with room to spare. */
const MAX_DELIVERY_ID = 80;

/** The window's snapshots as this handler reaches them: the service, built in `extension.ts`. */
export type WorkshopSelectedTextSnapshotsPort = Pick<EditorSelectionSnapshots, 'capture' | 'find' | 'watch'>;

export type WorkshopSelectedTextSessionPort = Pick<WorkshopSessionService, 'addMessageAttachment' | 'readRoomRevision'>;

/**
 * What a send's selection came to. `none`: the send names no selection.
 * `staged`: the snapshot now waits with the other attachments and rides this
 * send. `refused`: the whole send stops, with these words, and the draft stays.
 */
export type WorkshopSelectedTextSendOutcome =
  | { ok: true; kind: 'none' | 'staged' | 'already-staged' }
  | { ok: false; reason: 'malformed' | 'room-changed' | 'unknown-snapshot' | 'full'; message: string };

export interface WorkshopSelectedTextEffects {
  postSessionState: () => void;
  markDirty: (reason: string) => void;
  isRoomRunActive: () => boolean;
}

export class WorkshopSelectedTextHandler {
  /** The one selection offered and not yet accepted. */
  private held?: { deliveryId: string; snapshotId: string };
  /** The webview asked to hear the current selection ("Include selected text" is on). */
  private watching = false;
  /** This panel's tab is on screen; a handler with no panel to ask counts as visible. */
  private visible = true;
  /** The snapshot service's watch: held only while watching and visible. */
  private watch?: PlatformDisposable;

  constructor(
    private readonly snapshots: WorkshopSelectedTextSnapshotsPort,
    private readonly session: WorkshopSelectedTextSessionPort,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopSelectedTextEffects
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    // Direct: holding an offer changes no session state.
    router.register(MessageType.WORKSHOP_STAGE_SELECTED_TEXT, this.handleOffer.bind(this));
    registerMutation(
      MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT,
      this.handleAccept.bind(this),
      undefined,
      (_reason: string, message: WorkshopAcceptSelectedTextMessage) => {
        this.outputChannel.appendLine(`${OWNER} Selection refused: a session operation is pending`);
        this.answer(this.deliveryIdOf(message), { staged: false, reason: 'busy' });
      }
    );
    // Direct: a subscription changes no session state.
    router.register(MessageType.WORKSHOP_SELECTED_TEXT_WATCH, this.handleWatch.bind(this));
  }

  dispose(): void {
    this.held = undefined;
    this.watching = false;
    this.syncWatch();
  }

  async handleWatch(message: WorkshopSelectedTextWatchMessage): Promise<void> {
    const on = message.payload?.on === true;
    if (on === this.watching) {
      // A repeated subscribe still answers with the current state: a reloaded webview starts from nothing.
      if (on && this.visible) {
        this.pushCurrent(this.snapshots.capture());
      }
      return;
    }
    this.watching = on;
    this.outputChannel.appendLine(`${OWNER} Selected text watch ${on ? 'on' : 'off'}`);
    this.syncWatch();
  }

  /**
   * The panel's tab became visible or hidden (the panel provider says so).
   * Hidden, nothing is pushed and nothing is captured; visible again, a
   * watching webview hears the current state once.
   */
  setVisible(visible: boolean): void {
    if (visible === this.visible) {
      return;
    }
    this.visible = visible;
    this.syncWatch();
  }

  /** Listen to the snapshot service exactly while watching and visible; on starting, push the current state once. */
  private syncWatch(): void {
    const wanted = this.watching && this.visible;
    if (wanted && !this.watch) {
      this.watch = this.snapshots.watch((current) => this.pushCurrent(current));
      this.pushCurrent(this.snapshots.capture());
    } else if (!wanted && this.watch) {
      this.watch.dispose();
      this.watch = undefined;
    }
  }

  private pushCurrent(current: EditorSelectionSnapshot | undefined): void {
    if (!this.watching || !this.visible) {
      return;
    }
    void this.postMessage({
      type: MessageType.WORKSHOP_SELECTED_TEXT_CURRENT,
      source: SOURCE,
      payload: { selection: current ? workshopSelectedTextSummary(current) : null },
      timestamp: Date.now()
    } satisfies WorkshopSelectedTextCurrentMessage);
  }

  async handleOffer(message: WorkshopStageSelectedTextMessage): Promise<void> {
    const deliveryId = message.payload?.deliveryId;
    const snapshotId = message.payload?.snapshotId;
    if (typeof deliveryId !== 'string' || deliveryId.length === 0 || deliveryId.length > MAX_DELIVERY_ID
      || !isSnapshotId(snapshotId)) {
      // The offer is dropped unclaimed; the provider settles it at its deadline.
      this.outputChannel.appendLine(`${OWNER} Selection offer refused: malformed delivery or snapshot id`);
      return;
    }
    this.held = { deliveryId, snapshotId };
    this.outputChannel.appendLine(`${OWNER} Selection offered from the editor (snapshot ${snapshotId})`);
    await this.postMessage({
      type: MessageType.WORKSHOP_SELECTED_TEXT_OFFERED,
      source: SOURCE,
      payload: { deliveryId },
      timestamp: Date.now()
    } satisfies WorkshopSelectedTextOfferedMessage);
  }

  async handleAccept(message: WorkshopAcceptSelectedTextMessage): Promise<void> {
    const deliveryId = this.deliveryIdOf(message);
    const held = this.held;
    if (!held || held.deliveryId !== deliveryId) {
      // Nothing held under that id (a newer offer replaced it, or the room was disposed): stage nothing, say so.
      this.outputChannel.appendLine(`${OWNER} Selection refused: nothing is held for that delivery`);
      this.answer(deliveryId, { staged: false, reason: 'busy' });
      return;
    }
    this.held = undefined;
    if (this.effects.isRoomRunActive()) {
      this.outputChannel.appendLine(`${OWNER} Selection refused: a response is running`);
      this.answer(deliveryId, { staged: false, reason: 'busy' });
      return;
    }
    const snapshot = this.snapshots.find(held.snapshotId);
    if (!snapshot) {
      // Evicted by newer selections between the gesture and the grant: the command's notice says to try again.
      this.outputChannel.appendLine(`${OWNER} Selection refused: snapshot ${held.snapshotId} is no longer held`);
      this.answer(deliveryId, { staged: false, reason: 'busy' });
      return;
    }
    const result = this.session.addMessageAttachment(workshopSelectedTextAttachmentInput(snapshot));
    if (!result.ok) {
      const reason: WorkshopSeedRefusal = result.reason === 'duplicate' ? 'duplicate' : 'full';
      this.outputChannel.appendLine(`${OWNER} Selection refused: ${reason}`);
      this.answer(deliveryId, { staged: false, reason });
      return;
    }
    this.outputChannel.appendLine(
      `${OWNER} Selection staged above the composer (${result.attachment.id}, kind=selected-text, snapshot ${snapshot.id}, ` +
      `${result.attachment.words} words, cut=${snapshot.truncation ? 'yes' : 'no'})`
    );
    this.effects.markDirty('selected text staged');
    this.effects.postSessionState();
    this.answer(deliveryId, { staged: true, attachmentId: result.attachment.id });
  }

  /**
   * The send's selection, staged inside the send's own mutation (D14). The
   * room is checked before the snapshot is looked up: a send that was shown
   * another room is refused even while its snapshot is still held.
   */
  stageForSend(
    payload: Pick<WorkshopSendMessagePayload, 'selectedTextSnapshotId' | 'roomRevision'> | undefined
  ): WorkshopSelectedTextSendOutcome {
    const snapshotId: unknown = payload?.selectedTextSnapshotId;
    if (snapshotId === undefined) {
      return { ok: true, kind: 'none' };
    }
    const refuse = (
      reason: 'malformed' | 'room-changed' | 'unknown-snapshot' | 'full',
      message = WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE
    ): WorkshopSelectedTextSendOutcome => {
      this.outputChannel.appendLine(`${OWNER} Send refused whole: its selected text is ${reason}`);
      return { ok: false, reason, message };
    };
    const roomRevision: unknown = payload?.roomRevision;
    if (!isSnapshotId(snapshotId) || !Number.isSafeInteger(roomRevision)) {
      return refuse('malformed');
    }
    if (roomRevision !== this.session.readRoomRevision()) {
      return refuse('room-changed');
    }
    const snapshot = this.snapshots.find(snapshotId);
    if (!snapshot) {
      return refuse('unknown-snapshot');
    }
    const result = this.session.addMessageAttachment(workshopSelectedTextAttachmentInput(snapshot));
    if (!result.ok) {
      // Already staged by hand: it rides this send as it is. No room: the pill was drawn disabled; a send that raced it stops.
      return result.reason === 'duplicate'
        ? { ok: true, kind: 'already-staged' }
        : refuse('full', WORKSHOP_SELECTED_TEXT_FULL_REASON);
    }
    this.outputChannel.appendLine(
      `${OWNER} Selection staged for this send (${result.attachment.id}, kind=selected-text, snapshot ${snapshot.id}, ` +
      `${result.attachment.words} words, cut=${snapshot.truncation ? 'yes' : 'no'})`
    );
    // If the send rolls back, the pill stays staged as an ordinary pending attachment: it is the text the writer saw.
    this.effects.markDirty('selected text staged for a send');
    this.effects.postSessionState();
    return { ok: true, kind: 'staged' };
  }

  private deliveryIdOf(message: WorkshopAcceptSelectedTextMessage): string {
    const deliveryId = message.payload?.deliveryId;
    return typeof deliveryId === 'string' ? deliveryId.slice(0, MAX_DELIVERY_ID) : '';
  }

  private answer(
    deliveryId: string,
    outcome: { staged: true; attachmentId: string } | { staged: false; reason: WorkshopSeedRefusal }
  ): void {
    const payload: WorkshopSelectedTextStagedPayload = { deliveryId, ...outcome };
    void this.postMessage({
      type: MessageType.WORKSHOP_SELECTED_TEXT_STAGED,
      source: SOURCE,
      payload,
      timestamp: Date.now()
    } satisfies WorkshopSelectedTextStagedMessage);
  }
}

/** A snapshot id as the host mints it: a short, non-empty string. Anything else names no snapshot. */
export function isSnapshotId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WORKSHOP_SELECTED_TEXT_SNAPSHOT_ID_CHARACTERS;
}
