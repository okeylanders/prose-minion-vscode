/**
 * The helper's drafts as the memory sheet asks for them and stops them
 * (ADR 2026-11-05 D5, D5.7; A-02, A-05). A sub-hook of
 * `useWorkshopProjectMemory`, which calls it only through its seam:
 *
 * - **The setting.** Asked once mounted (`WORKSHOP_REQUEST_MEMORY_DRAFTS_SETTING`)
 *   and pushed when it changes (`WORKSHOP_MEMORY_DRAFTS_SETTING`). Off, a
 *   sheet asks for nothing and shows nothing. Before the first answer it
 *   asks; the host still answers `off`, which the sheet reads as silence.
 * - **Asking.** `ask` gives a freshly opened sheet its own request, bound to
 *   the room it opened in, and posts it.
 * - **Stopping.** `stop` tells the host to abort a sheet's draft still out
 *   and marks it stopped; the hook calls it on Close, Save, a new opening
 *   and unmount.
 *
 * Its state is the setting alone, held for the host's next push; it
 * persists nothing. Pure decisions live in `workshopMemoryHelperDraft`.
 */

import * as React from 'react';
import { MessageType, type WorkshopMemoryDraftsSettingMessage } from '@messages';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/memory/workshopMemorySheetState';
import {
  workshopMemoryHelperDraftInFlight,
  workshopMemoryHelperDraftRequest,
  workshopMemorySheetWithHelperStopped
} from '@hooks/domain/workshop/memory/workshopMemoryHelperDraft';

export interface WorkshopMemoryHelperDraftsState {
  /** The host's switch, once heard; undefined before its first answer. */
  readonly enabled: boolean | undefined;
}

export interface WorkshopMemoryHelperDraftsActions {
  /** The sheet to open: with its own draft request when it comes from a turn and drafting is on. */
  ask: (sheet: WorkshopMemorySheetState) => WorkshopMemorySheetState;
  /** The sheet with any draft still out stopped, the host told to abort it. */
  stop: <S extends WorkshopMemorySheetState | null>(sheet: S) => S;
  handleDraftsSetting: (message: WorkshopMemoryDraftsSettingMessage) => void;
}

export interface WorkshopMemoryHelperDraftsPersistence {
  // Nothing: the host owns the setting.
}

export type UseWorkshopMemoryHelperDraftsReturn = WorkshopMemoryHelperDraftsState &
  WorkshopMemoryHelperDraftsActions & { persistedState: WorkshopMemoryHelperDraftsPersistence };

export interface UseWorkshopMemoryHelperDraftsOptions {
  readonly post: (type: MessageType, payload: object) => void;
  readonly mint: () => string;
  /** The open room's revision, when the room is ready. */
  readonly roomRevision?: number;
  /** The sheet as last set, so unmount can stop its draft. Stable. */
  readonly currentSheet: () => WorkshopMemorySheetState | null;
}

export function useWorkshopMemoryHelperDrafts({
  post,
  mint,
  roomRevision,
  currentSheet
}: UseWorkshopMemoryHelperDraftsOptions): UseWorkshopMemoryHelperDraftsReturn {
  const [enabled, setEnabled] = React.useState<boolean | undefined>(undefined);
  const enabledRef = React.useRef<boolean | undefined>(undefined);
  const roomRef = React.useRef(roomRevision);
  roomRef.current = roomRevision;

  const ask = React.useCallback((sheet: WorkshopMemorySheetState): WorkshopMemorySheetState => {
    if (enabledRef.current === false) {
      return sheet;
    }
    const asked = workshopMemoryHelperDraftRequest(sheet, mint(), roomRef.current);
    if (!asked) {
      return sheet;
    }
    post(MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST, asked.payload);
    return asked.sheet;
  }, [mint, post]);

  const stop = React.useCallback(<S extends WorkshopMemorySheetState | null>(sheet: S): S => {
    const requestId = workshopMemoryHelperDraftInFlight(sheet);
    if (!sheet || requestId === undefined) {
      return sheet;
    }
    post(MessageType.WORKSHOP_MEMORY_DRAFT_CANCEL, { requestId });
    return workshopMemorySheetWithHelperStopped(sheet) as S;
  }, [post]);

  const handleDraftsSetting = React.useCallback((message: WorkshopMemoryDraftsSettingMessage) => {
    const next = message.payload?.enabled !== false;
    enabledRef.current = next;
    setEnabled(next);
  }, []);

  const requestSetting = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_MEMORY_DRAFTS_SETTING, {});
  }, [post]);

  const stopWhenUnmounted = React.useCallback(() => {
    const requestId = workshopMemoryHelperDraftInFlight(currentSheet());
    if (requestId !== undefined) {
      post(MessageType.WORKSHOP_MEMORY_DRAFT_CANCEL, { requestId });
    }
  }, [currentSheet, post]);

  // Once per mount (both callbacks are stable): the setting is asked for, and a draft still out at unmount is stopped.
  React.useEffect(() => {
    requestSetting();
    return stopWhenUnmounted;
  }, [requestSetting, stopWhenUnmounted]);

  return { enabled, ask, stop, handleDraftsSetting, persistedState: {} };
}
