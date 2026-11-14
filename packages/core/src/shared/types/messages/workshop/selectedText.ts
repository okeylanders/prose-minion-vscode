/**
 * Selected Text (ADR 2026-11-14, item B): the editor's selection as a
 * one-shot attachment of one Workshop message. One pill, two ways in.
 *
 * **By hand.** The command "Add Selection to Workshop Message" captures a
 * snapshot of the selection at the gesture and offers it to the Workshop
 * through seed delivery (`seedDelivery.ts`), kind `selected-text`:
 *
 * 1. host to host: `WORKSHOP_STAGE_SELECTED_TEXT`, through the panel's own
 *    MessageHandler, carrying the snapshot's id only; the Workshop's handler
 *    holds the offer and tells its webview (`WORKSHOP_SELECTED_TEXT_OFFERED`);
 * 2. the webview claims it; the provider grants the claim only while that
 *    delivery is still current;
 * 3. after a grant the webview accepts it (`WORKSHOP_ACCEPT_SELECTED_TEXT`),
 *    and the handler reads the snapshot and stages it as a pending message
 *    attachment, or refuses it (`WORKSHOP_SELECTED_TEXT_STAGED`);
 * 4. the webview answers the provider: staged, or why not.
 *
 * **By toggle.** While the composer's "Include selected text" is on, the
 * webview watches (`WORKSHOP_SELECTED_TEXT_WATCH`) and the host pushes the
 * current selection's metadata (`WORKSHOP_SELECTED_TEXT_CURRENT`): a state,
 * where the newest wins. The send names the snapshot the pill showed
 * (`WorkshopSendMessagePayload.selectedTextSnapshotId`) and the room it was
 * shown in (`roomRevision`).
 *
 * The selection's text never travels to the webview, and never comes back
 * from it: the webview sees metadata and names a snapshot by its host-minted
 * id. The attachment kind, the seed kind and the meta field are
 * `selected-text` / `selectedText`, named apart from `editor-selection`,
 * which stays the excerpt's source kind (D13).
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopSeedRefusal } from './seedDelivery';

/** The pill's label, the frame's name, and what a transcript shows of it. */
export const WORKSHOP_SELECTED_TEXT_LABEL = 'Selected Text';

/** The toggle beside the composer. */
export const WORKSHOP_INCLUDE_SELECTED_TEXT_LABEL = 'Include selected text';

/**
 * What the writer is told when a send named a selection the host no longer
 * holds, or one shown in another room (D14). The whole send is refused and
 * the draft stays.
 */
export const WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE =
  'The selected text changed before this was sent. Check the pill and send again.';

/** Why the live pill is drawn disabled when the next message has no room for it. */
export const WORKSHOP_SELECTED_TEXT_FULL_REASON =
  'This message already carries as many attachments as one may. Remove one to include the selected text.';

/** The longest snapshot id the host mints (a UUID), with room to spare. */
export const WORKSHOP_SELECTED_TEXT_SNAPSHOT_ID_CHARACTERS = 80;

/**
 * What a staged or sent Selected Text attachment keeps of its selection:
 * which snapshot it was, and the lines it was read from. Display-safe.
 */
export interface WorkshopSelectedTextAttachmentMeta {
  /** Host-minted and opaque: what makes a staged selection "already staged". */
  snapshotId: string;
  /** 1-based, inclusive. */
  startLine: number;
  endLine: number;
}

/** The current selection as the webview may see it: metadata and a one-line preview, never the text. */
export interface WorkshopSelectedTextSummary {
  snapshotId: string;
  /** Display path (workspace-relative, or a bare file name). */
  displayName: string;
  startLine: number;
  endLine: number;
  /** Words the attachment would carry. */
  words: number;
  /** Set when the selection was cut at capture to its bound. */
  truncation?: { keptWords: number; totalWords: number };
  /** At most `PROMPT_BUDGETS.workshopSelectedText.previewCharacters`, one line. */
  preview: string;
}

/** Host to host: the panel provider's synthetic offer. Never posted by a webview. */
export interface WorkshopStageSelectedTextPayload {
  /** The provider's, one per offer: the claim, the accept and the answer name it. */
  deliveryId: string;
  /** The snapshot captured at the command's gesture. */
  snapshotId: string;
}

export interface WorkshopStageSelectedTextMessage extends MessageEnvelope<WorkshopStageSelectedTextPayload> {
  type: MessageType.WORKSHOP_STAGE_SELECTED_TEXT;
}

/** Handler to its webview: a selection is waiting; claim it before anything is staged. */
export interface WorkshopSelectedTextOfferedPayload {
  deliveryId: string;
}

export interface WorkshopSelectedTextOfferedMessage extends MessageEnvelope<WorkshopSelectedTextOfferedPayload> {
  type: MessageType.WORKSHOP_SELECTED_TEXT_OFFERED;
}

/**
 * Webview to its handler, after a granted claim: stage the selection held
 * for this delivery. The panel provider lets it through only while that
 * delivery is granted to `receiver`.
 */
export interface WorkshopAcceptSelectedTextPayload {
  deliveryId: string;
  /** The webview realm that holds the grant (`WORKSHOP_SEED_RECEIVER`). */
  receiver: string;
}

export interface WorkshopAcceptSelectedTextMessage extends MessageEnvelope<WorkshopAcceptSelectedTextPayload> {
  type: MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT;
}

/** Handler to its webview: the pill is above the composer, or why not; the webview answers the provider with it. */
export type WorkshopSelectedTextStagedPayload =
  | { deliveryId: string; staged: true; attachmentId: string }
  | { deliveryId: string; staged: false; reason: WorkshopSeedRefusal };

export interface WorkshopSelectedTextStagedMessage extends MessageEnvelope<WorkshopSelectedTextStagedPayload> {
  type: MessageType.WORKSHOP_SELECTED_TEXT_STAGED;
}

/** Webview to its handler: start or stop hearing the current selection. A subscription; it has no answer. */
export interface WorkshopSelectedTextWatchPayload {
  on: boolean;
}

export interface WorkshopSelectedTextWatchMessage extends MessageEnvelope<WorkshopSelectedTextWatchPayload> {
  type: MessageType.WORKSHOP_SELECTED_TEXT_WATCH;
}

/** Handler to a watching, visible webview: the current selection, or nothing selected. The newest wins. */
export interface WorkshopSelectedTextCurrentPayload {
  selection: WorkshopSelectedTextSummary | null;
}

export interface WorkshopSelectedTextCurrentMessage extends MessageEnvelope<WorkshopSelectedTextCurrentPayload> {
  type: MessageType.WORKSHOP_SELECTED_TEXT_CURRENT;
}
