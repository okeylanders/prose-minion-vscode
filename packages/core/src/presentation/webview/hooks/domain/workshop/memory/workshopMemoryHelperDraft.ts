/**
 * The helper's draft in the memory sheet (ADR 2026-11-05 D5; Helper Agent
 * Slice 2), as pure sheet states for `useWorkshopProjectMemory`:
 *
 * - **What asks.** A sheet opened from a turn: a bubble's Save to memory…,
 *   a room bookmark's Remember this (in the window or out of it), a saved
 *   session's. A card's Edit…, a saved memory's edit and New ask nothing.
 *   The request names the turn by its ids; the host reads its text.
 * - **Correlated.** The request's id lives on the sheet it was asked for,
 *   so a closed sheet, or one opened since, never takes a late answer.
 * - **The writer's typing wins.** A field the writer touched (title,
 *   summary, kind) is never filled; the body is never changed.
 * - **Quiet.** While it drafts, the title and summary read "Drafting…" as
 *   placeholders; Save keeps its own rules, and drafting adds no lock. Any
 *   outcome but a draft leaves the fields as they are, with one muted line;
 *   `off` says nothing (D5.7).
 * - **Stopped when not wanted** (A-05). Close, Save, another opening and
 *   unmount stop a draft still out (`stopped`: no placeholder, no line), and
 *   the hook tells the host to abort it. Save freezes the fields: what was
 *   submitted is what the sheet shows, and a late answer changes nothing.
 * - **Bound to its room** (A-02). A live turn's request names the room the
 *   sheet was opened in: its own `roomRevision` for a bookmark outside the
 *   window, else the room's revision when it opened.
 */

import type {
  WorkshopMemoryDraft,
  WorkshopMemoryDraftRequestPayload,
  WorkshopMemoryDraftResultPayload
} from '@messages';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/memory/workshopMemorySheetState';

/** The fields the helper may fill. */
export const WORKSHOP_MEMORY_HELPER_FIELDS = ['title', 'summary', 'kind'] as const;
export type WorkshopMemoryHelperField = typeof WORKSHOP_MEMORY_HELPER_FIELDS[number];

export interface WorkshopMemoryHelperDraftState {
  /** The sheet's own request. */
  readonly requestId: string;
  /** `drafting` until its answer; `filled` or `failed` once it lands; `stopped` when off, or stopped before it answered. */
  readonly status: 'drafting' | 'filled' | 'failed' | 'stopped';
  /** Fields the writer changed since the sheet opened. */
  readonly touched: readonly WorkshopMemoryHelperField[];
}

export const WORKSHOP_MEMORY_HELPER_DRAFT_COPY = Object.freeze({
  drafting: 'Drafting…',
  failed: 'Couldn’t draft a title and summary.'
});

/** The draft request a freshly opened sheet makes, or undefined when it asks for nothing. */
export function workshopMemoryHelperDraftRequest(
  sheet: WorkshopMemorySheetState,
  requestId: string,
  /** The open room's revision, for a turn of this room that names none of its own. */
  roomRevision?: number
): { readonly sheet: WorkshopMemorySheetState; readonly payload: WorkshopMemoryDraftRequestPayload } | undefined {
  if (sheet.turnId === undefined) {
    return undefined;
  }
  let payload: WorkshopMemoryDraftRequestPayload;
  if (sheet.mode === 'turn') {
    const room = sheet.roomRevision ?? roomRevision;
    payload = { requestId, turnId: sheet.turnId, ...(room !== undefined ? { roomRevision: room } : {}) };
  } else if (sheet.mode === 'saved-turn' && sheet.sessionId !== undefined) {
    payload = { requestId, turnId: sheet.turnId, sessionId: sheet.sessionId };
  } else {
    return undefined;
  }
  return { sheet: { ...sheet, helper: { requestId, status: 'drafting', touched: [] } }, payload };
}

/** The helper state once the writer changes `change`'s fields: those it fills are theirs from now on. */
export function workshopMemoryHelperTouched(
  helper: WorkshopMemoryHelperDraftState | undefined,
  change: Partial<WorkshopMemoryDraft>
): WorkshopMemoryHelperDraftState | undefined {
  if (!helper) {
    return undefined;
  }
  const added = WORKSHOP_MEMORY_HELPER_FIELDS.filter((field) => field in change && !helper.touched.includes(field));
  return added.length === 0 ? helper : { ...helper, touched: [...helper.touched, ...added] };
}

/**
 * The sheet once its answer lands: untouched fields filled from a draft, or
 * the quiet line, or silence for `off`. Undefined when the answer is not
 * this sheet's pending request, so it changes nothing; a sheet whose Save
 * stopped its draft no longer waits for one.
 */
export function workshopMemorySheetWithHelperDraft(
  sheet: WorkshopMemorySheetState | null,
  answer: WorkshopMemoryDraftResultPayload
): WorkshopMemorySheetState | undefined {
  const helper = sheet?.helper;
  if (!sheet || !helper || helper.requestId !== answer.requestId || helper.status !== 'drafting') {
    return undefined;
  }
  if (answer.outcome === 'off') {
    return { ...sheet, helper: { ...helper, status: 'stopped' } };
  }
  if (answer.outcome !== 'drafted' || !answer.draft) {
    return { ...sheet, helper: { ...helper, status: 'failed' } };
  }
  const draft = answer.draft;
  const filled: Partial<WorkshopMemoryDraft> = Object.fromEntries(
    WORKSHOP_MEMORY_HELPER_FIELDS.filter((field) => !helper.touched.includes(field)).map((field) => [field, draft[field]])
  );
  return { ...sheet, draft: { ...sheet.draft, ...filled }, helper: { ...helper, status: 'filled' } };
}

/** The placeholder a title or summary field shows: "Drafting…" while the draft is out, else none. */
export function workshopMemoryHelperPlaceholder(sheet: WorkshopMemorySheetState): string | undefined {
  return sheet.helper?.status === 'drafting' ? WORKSHOP_MEMORY_HELPER_DRAFT_COPY.drafting : undefined;
}

/** The draft a sheet still waits for, which the host should stop now; undefined when it waits for none. */
export function workshopMemoryHelperDraftInFlight(sheet: WorkshopMemorySheetState | null): string | undefined {
  return sheet?.helper?.status === 'drafting' ? sheet.helper.requestId : undefined;
}

/** The sheet with its draft stopped: no placeholder, no line, and no answer taken. */
export function workshopMemorySheetWithHelperStopped(sheet: WorkshopMemorySheetState): WorkshopMemorySheetState {
  return sheet.helper?.status === 'drafting' ? { ...sheet, helper: { ...sheet.helper, status: 'stopped' } } : sheet;
}
