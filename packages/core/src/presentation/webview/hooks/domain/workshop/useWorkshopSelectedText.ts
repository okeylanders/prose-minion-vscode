/**
 * useWorkshopSelectedText — the Workshop webview's side of Selected Text
 * (ADR 2026-11-14 D12, D14, D17), mirroring `WorkshopSelectedTextHandler`.
 *
 * **By hand.** The host offers a selection (`WORKSHOP_SELECTED_TEXT_OFFERED`,
 * a delivery id only; the snapshot stays host-side). This hook claims it
 * through the seed protocol (`useWorkshopSeedClaim`, kind `selected-text`);
 * only on a granted claim does it ask the host to stage it
 * (`WORKSHOP_ACCEPT_SELECTED_TEXT`, naming its receiver, which the provider
 * holds to the grant), and it answers the provider with the host's word
 * (`WORKSHOP_SELECTED_TEXT_STAGED`). The staged pill is session state, drawn
 * by the composer like any other attachment.
 *
 * **By toggle.** `includeSelectedText` is a UI preference, off by default,
 * kept per window in `persistedState` and never in the session. While it is
 * on, the hook watches (`WORKSHOP_SELECTED_TEXT_WATCH`) and holds the newest
 * `WORKSHOP_SELECTED_TEXT_CURRENT`: the current selection's metadata, never
 * its text. That is the live pill. A send names the snapshot the pill showed
 * (`sendSnapshotId`), so what the writer saw is what the host attaches.
 *
 * The live pill is not drawn, and not sent, when its snapshot is already
 * staged; it is drawn disabled, with the reason, when the next message has
 * no room for another attachment.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import { useWorkshopSeedClaim } from '@hooks/domain/workshop/useWorkshopSeedClaim';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  MessageType,
  WORKSHOP_SELECTED_TEXT_FULL_REASON,
  WorkshopAcceptSelectedTextMessage,
  WorkshopMessageAttachmentSnapshot,
  WorkshopSeedClaimResultMessage,
  WorkshopSelectedTextCurrentMessage,
  WorkshopSelectedTextOfferedMessage,
  WorkshopSelectedTextStagedMessage,
  WorkshopSelectedTextSummary,
  WorkshopSelectedTextWatchMessage
} from '@messages';

/** What the claim holds for a selection: its delivery id; the snapshot itself never leaves the host. */
interface WorkshopOfferedSelection {
  deliveryId: string;
}

/** The live pill as the composer draws it. */
export interface WorkshopLiveSelectedText {
  selection: WorkshopSelectedTextSummary;
  /** Set when the next message has no room for it: drawn disabled, and not sent. */
  disabledReason?: string;
}

export interface WorkshopSelectedTextState {
  /** The composer's "Include selected text" toggle. */
  includeSelectedText: boolean;
  /** The current selection as a pill, while the toggle is on and its snapshot is not already staged. */
  livePill: WorkshopLiveSelectedText | null;
  /** The snapshot the next send names: the live pill's, when it is drawn and has room. */
  sendSnapshotId: string | undefined;
  /** The delivery the host was asked to stage, until it answers. */
  staging: string | null;
}

export interface WorkshopSelectedTextActions {
  setIncludeSelectedText: (on: boolean) => void;
  handleSelectedTextOffered: (message: WorkshopSelectedTextOfferedMessage) => void;
  handleSeedClaimResult: (message: WorkshopSeedClaimResultMessage) => void;
  handleSelectedTextStaged: (message: WorkshopSelectedTextStagedMessage) => void;
  handleSelectedTextCurrent: (message: WorkshopSelectedTextCurrentMessage) => void;
}

export interface WorkshopSelectedTextPersistence {
  /** A per-window UI preference: never the session's. */
  includeSelectedText: boolean;
}

export type UseWorkshopSelectedTextReturn = WorkshopSelectedTextState & WorkshopSelectedTextActions & {
  persistedState: WorkshopSelectedTextPersistence;
};

export interface UseWorkshopSelectedTextOptions {
  /** This Workshop mount's seed receiver (`useWorkshopSeedReceiver`). */
  seedReceiver: string;
  /** The attachments staged for the next message (host truth, from the session snapshot). */
  pendingMessageAttachments: readonly WorkshopMessageAttachmentSnapshot[];
}

const SOURCE = 'webview.workshop.selected-text';

/** The live pill for a selection beside what is already staged (pure). */
export function workshopLiveSelectedText(
  includeSelectedText: boolean,
  selection: WorkshopSelectedTextSummary | null,
  pending: readonly WorkshopMessageAttachmentSnapshot[]
): WorkshopLiveSelectedText | null {
  if (!includeSelectedText || !selection) {
    return null;
  }
  // One selection has one id: already staged by hand, or by a send still in flight, it is drawn once.
  if (pending.some((attachment) => attachment.selectedText?.snapshotId === selection.snapshotId)) {
    return null;
  }
  return pending.length >= PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage
    ? { selection, disabledReason: WORKSHOP_SELECTED_TEXT_FULL_REASON }
    : { selection };
}

export function useWorkshopSelectedText(
  { seedReceiver, pendingMessageAttachments }: UseWorkshopSelectedTextOptions
): UseWorkshopSelectedTextReturn {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<Partial<WorkshopSelectedTextPersistence>>();
  const [includeSelectedText, setIncludeSelectedTextState] = React.useState(persisted?.includeSelectedText === true);
  const [current, setCurrent] = React.useState<WorkshopSelectedTextSummary | null>(null);
  const claims = useWorkshopSeedClaim<WorkshopOfferedSelection>('selected-text', seedReceiver);
  const [staging, setStaging] = React.useState<string | null>(null);
  const { granted, receive, handleClaimResult, answer } = claims;

  const postWatch = React.useCallback((on: boolean) => {
    const message: WorkshopSelectedTextWatchMessage = {
      type: MessageType.WORKSHOP_SELECTED_TEXT_WATCH,
      source: SOURCE,
      payload: { on },
      timestamp: Date.now()
    };
    vscode.postMessage(message);
  }, [vscode]);

  /** Watch while the toggle is on; stop when it goes off, or on unmount. */
  const syncWatchWithToggle = React.useCallback(() => {
    if (!includeSelectedText) {
      return undefined;
    }
    postWatch(true);
    return () => {
      postWatch(false);
    };
  }, [includeSelectedText, postWatch]);

  React.useEffect(() => syncWatchWithToggle(), [syncWatchWithToggle]);

  const setIncludeSelectedText = React.useCallback((on: boolean) => {
    setIncludeSelectedTextState(on);
    if (!on) {
      // Off: nothing is shown, and a late push from the watch just ended is not the pill's.
      setCurrent(null);
    }
  }, []);

  const handleSelectedTextCurrent = React.useCallback((message: WorkshopSelectedTextCurrentMessage) => {
    if (!includeSelectedText) {
      return;
    }
    const selection = message.payload?.selection;
    // A state, where the newest wins.
    setCurrent(selection && typeof selection.snapshotId === 'string' && selection.snapshotId.length > 0 ? selection : null);
  }, [includeSelectedText]);

  const handleSelectedTextOffered = React.useCallback((message: WorkshopSelectedTextOfferedMessage) => {
    const deliveryId = message.payload?.deliveryId;
    if (typeof deliveryId === 'string' && deliveryId.length > 0) {
      receive(deliveryId, { deliveryId });
    }
  }, [receive]);

  /** A granted selection: ask the host to stage it, once. */
  const requestStagingWhenGranted = React.useCallback(() => {
    if (!granted || staging === granted.deliveryId) {
      return;
    }
    setStaging(granted.deliveryId);
    const message: WorkshopAcceptSelectedTextMessage = {
      type: MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT,
      source: SOURCE,
      payload: { deliveryId: granted.deliveryId, receiver: seedReceiver },
      timestamp: Date.now()
    };
    vscode.postMessage(message);
  }, [granted, seedReceiver, staging, vscode]);

  React.useEffect(() => {
    requestStagingWhenGranted();
  }, [requestStagingWhenGranted]);

  const handleSelectedTextStaged = React.useCallback((message: WorkshopSelectedTextStagedMessage) => {
    const result = message.payload;
    if (!result || result.deliveryId !== granted?.deliveryId) {
      return;
    }
    setStaging(null);
    answer(result.staged
      ? { deliveryId: result.deliveryId, opened: true }
      : { deliveryId: result.deliveryId, opened: false, reason: result.reason });
  }, [answer, granted]);

  const livePill = React.useMemo(
    () => workshopLiveSelectedText(includeSelectedText, current, pendingMessageAttachments),
    [current, includeSelectedText, pendingMessageAttachments]
  );
  const persistedState = React.useMemo(() => ({ includeSelectedText }), [includeSelectedText]);

  return {
    includeSelectedText,
    livePill,
    sendSnapshotId: livePill && !livePill.disabledReason ? livePill.selection.snapshotId : undefined,
    staging,
    setIncludeSelectedText,
    handleSelectedTextOffered,
    handleSeedClaimResult: handleClaimResult,
    handleSelectedTextStaged,
    handleSelectedTextCurrent,
    persistedState
  };
}
