/**
 * Workshop Project Memory's write path (ADR 2026-11-04 D4, D5, D6, D7, D8;
 * epic Slice 3): the proposal a persona's reply carries, the receipt a save
 * leaves in the room, and the writer's write routes.
 *
 * - **A proposal** is persisted on the assistant turn that carried it
 *   (`WorkshopTurn.memoryProposal`), after the host stripped its trailer
 *   from the bubble and from retained history. Nothing is saved without the
 *   writer's action in Ask first; Save and tell me saves one at once, or
 *   holds it with a reason (Slice 5).
 * - **A receipt** is a session divider turn (`WorkshopTurn.projectMemoryReceipt`)
 *   that every participant receives as room history. It never carries the
 *   memory's body (D7; PR #196 watchpoint 1).
 * - **Routes** name turns and memory ids, never a path. Each request carries
 *   a webview-minted `requestId` the host echoes, so the sheet and the card
 *   keep the writer's draft until the host says whether it was kept.
 *
 * The UI says "Always load in full" and "Loaded in full", never "pin"
 * (Slice 0d decision 16); the fields keep `pinned`.
 */

import type { MessageEnvelope, MessageType } from '../base';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';

export const WORKSHOP_MEMORY_PROPOSAL_STATES = ['pending', 'saved', 'dismissed'] as const;
export type WorkshopMemoryProposalState = typeof WORKSHOP_MEMORY_PROPOSAL_STATES[number];

/**
 * Why a proposal waits under Save and tell me (D8; Slice 5): its reply's run
 * had web research attached, or the room reached `autoSavesPerRoom`. Absent
 * under Ask first, and on a card Save and tell me saved.
 */
export const WORKSHOP_MEMORY_HOLDS = ['web-research', 'room-cap'] as const;
export type WorkshopMemoryHold = typeof WORKSHOP_MEMORY_HOLDS[number];

/** A memory the proposal replaces, as the listing named it when the reply landed. */
export interface WorkshopMemoryProposalReplaces {
  id: string;
  title: string;
}

/**
 * A persona's proposal, decoded, checked and persisted on its turn (D6).
 * The host fills provenance at save time; the trailer may name none of it.
 */
export interface WorkshopMemoryProposal {
  title: string;
  kind: ProjectMemoryKind;
  summary: string;
  /** The note, as the trailer wrote it (trimmed); may be empty. */
  body: string;
  /** Listed memories it replaces, with the title each had then. */
  supersedes?: WorkshopMemoryProposalReplaces[];
  /** `supersedes` ids the trailer named that no listed memory held: dropped, and said on the card. */
  droppedSupersedes?: number;
  state: WorkshopMemoryProposalState;
  /** The memory it became, once saved. */
  memoryId?: string;
  /** Held for the writer under Save and tell me, and why (Slice 5); kept once settled. */
  held?: WorkshopMemoryHold;
}

/**
 * What a receipt says happened (D7). `restored` is the Forget receipt's
 * Restore (an archived memory made active again).
 */
export const WORKSHOP_MEMORY_RECEIPT_ACTIONS = ['saved', 'updated', 'forgotten', 'restored'] as const;
export type WorkshopMemoryReceiptAction = typeof WORKSHOP_MEMORY_RECEIPT_ACTIONS[number];

export const WORKSHOP_MEMORY_RECEIPT_AUTHORS = ['writer', 'auto'] as const;
export type WorkshopMemoryReceiptAuthor = typeof WORKSHOP_MEMORY_RECEIPT_AUTHORS[number];

/**
 * A save, an edit of what a memory says, a Forget or a Restore, recorded on
 * a session divider turn (D7). `version` is the memory's D14 version after
 * the change, so delivery counts it as told. Never the body.
 */
export interface WorkshopProjectMemoryReceipt {
  action: WorkshopMemoryReceiptAction;
  memoryId: string;
  title: string;
  version: string;
  by: WorkshopMemoryReceiptAuthor;
  /** The persona whose proposal it was (a writer's own save names none). */
  proposedBy?: string;
}

/** What the writer submits from the sheet: the fields a memory says, and whether it loads in full. */
export interface WorkshopMemoryDraft {
  title: string;
  kind: ProjectMemoryKind;
  summary: string;
  body: string;
  /** Listed memory ids it replaces; "Don't replace" removes one. */
  supersedes: string[];
  /** "Always load in full". */
  pinned: boolean;
}

/** Save, dismiss or show again a turn's proposal; `edited` saves the sheet's version instead. */
export interface WorkshopMemoryProposalActionPayload {
  requestId: string;
  turnId: string;
  action: 'save' | 'dismiss' | 'reopen';
  edited?: WorkshopMemoryDraft;
}

export interface WorkshopMemoryProposalActionMessage
  extends MessageEnvelope<WorkshopMemoryProposalActionPayload> {
  type: MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION;
}

/** "Save to memory…" on an eligible bubble: the writer's own memory, with the turn as its source. */
export interface WorkshopSaveTurnToMemoryPayload {
  requestId: string;
  turnId: string;
  draft: WorkshopMemoryDraft;
}

export interface WorkshopSaveTurnToMemoryMessage
  extends MessageEnvelope<WorkshopSaveTurnToMemoryPayload> {
  type: MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY;
}

/** New memory, with no source. */
export interface WorkshopMemoryCreatePayload {
  requestId: string;
  draft: WorkshopMemoryDraft;
}

export interface WorkshopMemoryCreateMessage
  extends MessageEnvelope<WorkshopMemoryCreatePayload> {
  type: MessageType.WORKSHOP_MEMORY_CREATE;
}

/** Edit a saved memory: the sheet's whole draft replaces what it says. */
export interface WorkshopMemoryUpdatePayload {
  requestId: string;
  memoryId: string;
  patch: WorkshopMemoryDraft;
}

export interface WorkshopMemoryUpdateMessage
  extends MessageEnvelope<WorkshopMemoryUpdatePayload> {
  type: MessageType.WORKSHOP_MEMORY_UPDATE;
}

/** Forget (archive, never delete; D8) or Restore a memory, from its receipt. */
export interface WorkshopMemoryForgetPayload {
  requestId: string;
  memoryId: string;
  action: 'forget' | 'restore';
}

export interface WorkshopMemoryForgetMessage
  extends MessageEnvelope<WorkshopMemoryForgetPayload> {
  type: MessageType.WORKSHOP_MEMORY_FORGET;
}

/**
 * The host's answer to any write route: done (the next snapshot holds its
 * card, receipt and turn), or refused with a reason in the writer's words
 * that names no memory text. A refusal changed nothing.
 */
export interface WorkshopMemoryWriteResultPayload {
  requestId: string;
  ok: boolean;
  memoryId?: string;
  error?: string;
  /** The refusal is the pinned budget's: the sheet shows it under the note. */
  budget?: WorkshopMemoryPinnedEstimate;
}

export interface WorkshopMemoryWriteResultMessage
  extends MessageEnvelope<WorkshopMemoryWriteResultPayload> {
  type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT;
}

/** Ask for a saved memory's fields, to edit it. */
export interface WorkshopMemoryRequestEditPayload {
  requestId: string;
  memoryId: string;
}

export interface WorkshopMemoryRequestEditMessage
  extends MessageEnvelope<WorkshopMemoryRequestEditPayload> {
  type: MessageType.WORKSHOP_MEMORY_REQUEST_EDIT;
}

/** A listed memory the sheet may name: id and title, for "Replaces". */
export interface WorkshopMemoryListedTitle {
  id: string;
  title: string;
}

export interface WorkshopMemoryEditDataPayload {
  requestId: string;
  memoryId: string;
  draft?: WorkshopMemoryDraft;
  /** Titles of the memories `draft.supersedes` names, as listed now. */
  replaces?: WorkshopMemoryListedTitle[];
  error?: string;
}

export interface WorkshopMemoryEditDataMessage
  extends MessageEnvelope<WorkshopMemoryEditDataPayload> {
  type: MessageType.WORKSHOP_MEMORY_EDIT_DATA;
}

/**
 * What memories loaded in full would come to with the sheet's draft, from
 * the frame's own renderer and estimator (D5): the host's numbers, never
 * the webview's guess.
 */
export interface WorkshopMemoryPinnedEstimate {
  /** This memory's body, loaded in full. */
  thisTokens: number;
  /** Every memory in effect set to load in full, this one as drafted included. */
  totalTokens: number;
  budgetTokens: number;
  /** The draft would take memories loaded in full past their budget, and the edit is what does it. */
  refused: boolean;
}

export interface WorkshopMemoryEstimatePayload {
  requestId: string;
  /** The memory being edited; absent for a new one. */
  memoryId?: string;
  draft: WorkshopMemoryDraft;
}

export interface WorkshopMemoryEstimateMessage
  extends MessageEnvelope<WorkshopMemoryEstimatePayload> {
  type: MessageType.WORKSHOP_MEMORY_ESTIMATE;
}

export interface WorkshopMemoryEstimateResultPayload {
  requestId: string;
  estimate?: WorkshopMemoryPinnedEstimate;
  error?: string;
}

export interface WorkshopMemoryEstimateResultMessage
  extends MessageEnvelope<WorkshopMemoryEstimateResultPayload> {
  type: MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT;
}
