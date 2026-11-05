/**
 * The Pinned context tab's routes (ADR 2026-11-04 D6, D8, D9; epic Slice 3):
 * the list as the tab draws it, and every change the tab can ask for.
 *
 * - **Correlated.** Every request carries a webview-minted `requestId` the
 *   host echoes; the webview takes only the answer it still waits for. A
 *   push the host makes on its own carries `requestId: null`.
 * - **The webview never introduces a path** (D8). Adds go by catalog key
 *   (`ConfiguredResourceRef`) or by attachment id (`ctx-N`); unpin, move and
 *   open name an entry by the stored path the host sent, which the host
 *   takes back only as a key into the list it has just read.
 * - **Every change names the revision it was asked against.** Another
 *   revision is refused and answered with the current list (D5).
 * - **The host's words.** Every state line, refusal and notice is the
 *   host's; the webview draws them and computes only what follows from the
 *   rows (the running sum, "In this conversation", the missing count).
 */

import type { MessageEnvelope, MessageType } from '../base';
import type { ConfiguredResourceRef } from '../configuredResources';
import type { ContextPathGroup } from '@shared/types/context';
import type { WorkshopPinnedContextPathPlatform } from '@shared/types/workshopPinnedContext';

/** One pinned entry, resolved by the host now. */
export interface WorkshopPinnedContextEntryView {
  /** The stored, display-safe, workspace-relative path: the entry's key. */
  readonly path: string;
  /** Its base name, as the pill names it. */
  readonly label: string;
  /** Its catalog group, when the context paths name it. */
  readonly group?: ContextPathGroup;
  /** The words an attach brings; absent for a file that is gone or can't be read. */
  readonly words?: number;
  readonly state: 'ready' | 'head-sliced' | 'missing' | 'unreadable';
  /** The state in the host's words: "Not found", "Can't read: …", "Attached as its first …". */
  readonly stateWords?: string;
  /** A head-sliced entry's figures. */
  readonly truncation?: { readonly keptWords: number; readonly totalWords: number };
}

/** The list file itself: absent (nothing pinned yet), readable, or not, with the host's words. */
export type WorkshopPinnedContextFileState =
  | { readonly state: 'absent' }
  | { readonly state: 'ok' }
  /** It doesn't read as format 1: only Open file works. */
  | { readonly state: 'unreadable'; readonly words: string }
  /** Another window holds it, or it couldn't be read now (Slice 2b's `busy` and `io`). */
  | { readonly state: 'busy' | 'io'; readonly words: string };

/** Where the list is kept: one folder, or none, with the host's words. */
export type WorkshopPinnedContextAvailabilityView =
  | { readonly available: true }
  | { readonly available: false; readonly reason: 'no-workspace' | 'multi-root'; readonly words: string };

/** A line the answer carries above the list, or under the action that asked. */
export type WorkshopPinnedContextNotice =
  /** A write was refused because the file changed: "This is the current list." */
  | { readonly kind: 'changed' }
  /** A change was refused, in the host's words. */
  | { readonly kind: 'refused'; readonly text: string }
  /** Attach missing landed: what it attached, and what it left out, in the host's words. */
  | { readonly kind: 'done'; readonly text: string };

export interface WorkshopPinnedContextPayload {
  readonly requestId: string | null;
  /** How paths compare on this host, for the shared match rule (Slice 2b, deviation 1). */
  readonly platform: WorkshopPinnedContextPathPlatform;
  readonly availability: WorkshopPinnedContextAvailabilityView;
  readonly file: WorkshopPinnedContextFileState;
  /**
   * The store read this list was drawn from, numbered in the store's queue
   * (PR #210 F03): a higher one is a later snapshot, whatever order answers
   * arrive in. The webview never lets a lower one replace the list it shows.
   * Absent when no list was read.
   */
  readonly observation?: number;
  /** The revision every change names; null when there is no list to change. */
  readonly revision: string | null;
  readonly entries: readonly WorkshopPinnedContextEntryView[];
  readonly totals: {
    /** Words the ready entries bring, in pinned order, before the budget. */
    readonly words: number;
    readonly budgetWords: number;
    readonly files: number;
    readonly maxFiles: number;
  };
  readonly notice?: WorkshopPinnedContextNotice;
  /** Which action the answer settles, so the picker and the row can say what happened. */
  readonly action?: WorkshopPinnedContextAction;
  /** Whether that action did what it asked. */
  readonly ok?: boolean;
}

export type WorkshopPinnedContextAction = 'pin-resources' | 'pin-attachments' | 'pin-file' | 'unpin' | 'move' | 'attach-missing' | 'open';

export interface WorkshopRequestPinnedContextMessage extends MessageEnvelope<{ readonly requestId: string }> {
  type: MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT;
}

export interface WorkshopPinnedContextMessage extends MessageEnvelope<WorkshopPinnedContextPayload> {
  type: MessageType.WORKSHOP_PINNED_CONTEXT;
}

export interface WorkshopPinContextResourcesPayload {
  readonly requestId: string;
  readonly revision: string;
  readonly items: readonly ConfiguredResourceRef[];
}

export interface WorkshopPinContextResourcesMessage extends MessageEnvelope<WorkshopPinContextResourcesPayload> {
  type: MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES;
}

export interface WorkshopPinContextAttachmentsPayload {
  readonly requestId: string;
  readonly revision: string;
  readonly attachmentIds: readonly string[];
}

export interface WorkshopPinContextAttachmentsMessage extends MessageEnvelope<WorkshopPinContextAttachmentsPayload> {
  type: MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS;
}

/**
 * Explore project folders… in pin mode: the host opens its own file picker
 * in the project folder and pins the file chosen if it lies inside the
 * project. The webview names no path; the host introduces it. A cancelled
 * pick is answered with nothing.
 */
export interface WorkshopPinContextPickFilePayload {
  readonly requestId: string;
  readonly revision: string;
}

export interface WorkshopPinContextPickFileMessage extends MessageEnvelope<WorkshopPinContextPickFilePayload> {
  type: MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE;
}

export interface WorkshopUnpinContextPayload {
  readonly requestId: string;
  readonly revision: string;
  readonly entryPath: string;
}

export interface WorkshopUnpinContextMessage extends MessageEnvelope<WorkshopUnpinContextPayload> {
  type: MessageType.WORKSHOP_UNPIN_CONTEXT;
}

export interface WorkshopMovePinnedContextPayload {
  readonly requestId: string;
  readonly revision: string;
  readonly entryPath: string;
  readonly direction: 'up' | 'down';
}

export interface WorkshopMovePinnedContextMessage extends MessageEnvelope<WorkshopMovePinnedContextPayload> {
  type: MessageType.WORKSHOP_MOVE_PINNED_CONTEXT;
}

export interface WorkshopAttachPinnedContextMessage extends MessageEnvelope<{ readonly requestId: string }> {
  type: MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT;
}

export interface WorkshopOpenPinnedContextFilePayload {
  readonly requestId: string;
  /** An entry's stored path; absent opens the list file itself. */
  readonly entryPath?: string;
}

export interface WorkshopOpenPinnedContextFileMessage extends MessageEnvelope<WorkshopOpenPinnedContextFilePayload> {
  type: MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE;
}
