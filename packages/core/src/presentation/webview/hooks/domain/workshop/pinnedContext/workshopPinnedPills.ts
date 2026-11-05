/**
 * The context sheet's pin marks and Pin buttons, in words (ADR 2026-11-04
 * D4, D7 and decided question 6; epic Slice 4; `Workshop.dc.html`). Pure: it
 * takes the host's last answer, the tab's view of what could be pinned, and
 * the pill pin this sheet last posted, and says for each pill what it draws.
 *
 * - **Derived, never stored** (D4). A pill is pinned when the shared match
 *   rule finds it in the list the host last sent, read with the host's
 *   platform. Nothing here is saved in the session.
 * - **Pin** is offered only on an unpinned file pill the writer attached:
 *   one the tab could pin too (`pinAttached.ids`), never a text note or a
 *   wizard pill. A pinned pill offers no Unpin; the tab owns unpinning.
 * - **A refusal shows where the pill is.** Only the answer to the pill's own
 *   request carries it, so another request's answer clears it.
 */

import type {
  WorkshopContextAttachmentSnapshot,
  WorkshopPinnedContextPayload
} from '@messages';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';

/** The mark's tooltip, as D7 and the approved board write it. */
export const WORKSHOP_PINNED_PILL_TIP = {
  lead: 'Pinned:',
  text: 'attached to every new session. Removing it here removes it from this conversation only.'
} as const;

/** A stale revision's answer carries no words; this is the pill's line for it. */
export const WORKSHOP_PINNED_PILL_CHANGED =
  'Pinned context changed in another window, so nothing was pinned. Try Pin again.';

/** The pill pin this sheet posted, and the request that carries it. */
export interface WorkshopPillPinPosted {
  readonly attachmentId: string;
  readonly requestId: string;
}

export interface WorkshopPinnedPillView {
  /** The list holds this file: the mark and its tooltip. */
  readonly pinned: boolean;
  /** The Pin button, when this pill offers one. */
  readonly pin?: {
    /** "Pin *label* for new sessions". */
    readonly name: string;
    /** Another change to the list is waiting for the host. */
    readonly disabled: boolean;
  };
  /** The host's refusal of this pill's own pin. */
  readonly refusal?: string;
  /** This pill's own Pin just landed: its button is gone, so focus comes back to the pill. */
  readonly landed?: boolean;
}

export interface WorkshopPinnedPillsInput {
  /** The host's last answer; absent until it answers. */
  answer?: WorkshopPinnedContextPayload;
  attachments: readonly WorkshopContextAttachmentSnapshot[];
  /** The tab's own answer to "what could be pinned" (Slice 3's view). */
  pinnableIds: readonly string[];
  /** A change to the list is waiting for the host. */
  pending: boolean;
  /** The pill pin last posted from the sheet. */
  posted?: WorkshopPillPinPosted;
}

/** Whether the list the host sent can be read for marks. */
function listOf(answer: WorkshopPinnedContextPayload | undefined): WorkshopPinnedContextPayload['entries'] {
  return answer && answer.availability.available && answer.file.state === 'ok' ? answer.entries : [];
}

function refusalOf(answer: WorkshopPinnedContextPayload | undefined, posted: WorkshopPillPinPosted | undefined): string | undefined {
  if (!answer || !posted || answer.requestId !== posted.requestId || answer.ok !== false) {
    return undefined;
  }
  if (answer.notice?.kind === 'refused') {
    return answer.notice.text;
  }
  return answer.notice?.kind === 'changed' ? WORKSHOP_PINNED_PILL_CHANGED : undefined;
}

export function workshopPinnedPillViews({
  answer,
  attachments,
  pinnableIds,
  pending,
  posted
}: WorkshopPinnedPillsInput): Readonly<Record<string, WorkshopPinnedPillView>> {
  const entries = listOf(answer);
  const pinnable = new Set(pinnableIds);
  const refusal = refusalOf(answer, posted);
  const views: Record<string, WorkshopPinnedPillView> = {};
  for (const attachment of attachments) {
    const pinned = answer !== undefined
      && entries.some((entry) => workshopPinnedContextMatches(entry, attachment, answer.platform));
    const offersPin = !pinned
      && attachment.kind === 'file'
      && attachment.origin !== 'wizard'
      && pinnable.has(attachment.id);
    const own = posted?.attachmentId === attachment.id;
    const ownRefusal = !pinned && own ? refusal : undefined;
    const landed = pinned && own && answer?.requestId === posted?.requestId && answer?.ok === true;
    views[attachment.id] = {
      pinned,
      ...(offersPin ? { pin: { name: `Pin ${attachment.label} for new sessions`, disabled: pending } } : {}),
      ...(ownRefusal ? { refusal: ownRefusal } : {}),
      ...(landed ? { landed: true } : {})
    };
  }
  return views;
}

/**
 * The context head's count part (`Workshop.dc.html`'s "· 8 pinned"): the
 * pills that show the mark, not the list's length. Absent at 0, so the head
 * reads as it did.
 */
export function workshopPinnedPillsCountText(pills: Readonly<Record<string, WorkshopPinnedPillView>> | undefined): string | undefined {
  const count = pills ? Object.values(pills).filter((pill) => pill.pinned).length : 0;
  return count > 0 ? `${count} pinned` : undefined;
}
