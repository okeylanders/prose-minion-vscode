/**
 * A reply's edit offers, resolved and settled (ADR 2026-11-10 D1, D2; epic
 * Slice 1). Host only: no route, no state.
 *
 * **Before completion** (`resolveWorkshopReplyEdits`, beside the reply's
 * file-edit proposals): the room reads the setting when the reply is read
 * and, while it is `ask`, resolves each offer the reply reader kept
 * (`workshopReplyEditOffers`) to an identity, through the `FileEditStaging`
 * port's `resolve`: ADR 2026-11-05 D4's rules, with no baseline, so no text
 * is read. Resolution is async and bounded: at most `offersPerReply`. An
 * offer whose file does not resolve to one identity a session can hold is
 * dropped (`unresolved:<reason>`). A reply holding no offer tag costs no
 * await of its own.
 *
 * **At completion** (`settleWorkshopReplyEditOffers`), what only the adopted
 * reply can say:
 * - the prose the ledger keeps is empty, or the host wrote the reply's line
 *   (its only prose was a widget's setup): `no-prose`;
 * - that prose is over `sourceReplyCharacters`, so a press could not quote
 *   it whole (D4): `source-reply-too-long`.
 *
 * **Once the turn is adopted** (`reportWorkshopEditOffers`): the session
 * keeps offers only on a host or guest persona's reply, so an offer the turn
 * did not take is `not-a-persona`.
 *
 * Every dropped frame is counted, one log line each. Logs carry kinds,
 * counts and fault names: never a path, a URI or any of the reply.
 */

import { workshopFileEditIdentityHoldable, type WorkshopEditOffer, type WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { FileEditResolutionResult, FileEditStaging } from '@/domain/models/FileEditStaging';
import type { WorkshopEditOfferDraft } from '@/utils/workshopEditOfferProtocol';
import type { WorkshopReplyEditOfferControl } from '@/utils/workshopReplyEditOffers';
import { extractWorkshopReplyControls, hasWorkshopEditOfferText } from '@/utils/workshopReplyControls';
import {
  resolveWorkshopReplyFileEdits,
  type WorkshopReplyFileEditContext,
  type WorkshopReplyFileEditInput
} from './WorkshopReplyFileEditProposals';

/** A reply's offers, resolved before completion runs. */
export interface WorkshopReplyEditOfferContext {
  /** The offers whose file resolved, in the order written. */
  readonly offers: readonly WorkshopEditOffer[];
  /** One log line per frame dropped so far. */
  readonly logs: readonly string[];
}

/** What completion needs to know about a reply's file edits and edit offers, resolved together. */
export interface WorkshopReplyEditsContext extends WorkshopReplyFileEditContext {
  /** Absent when the reply held no offer frame. */
  readonly editOffers?: WorkshopReplyEditOfferContext;
}

const dropped = (reason: string): string => `Edit offer dropped (reason=${reason})`;

/**
 * A reply's file-edit proposals and edit offers, staged and resolved
 * together. Undefined when the reply holds neither. Never rejects.
 */
export async function resolveWorkshopReplyEdits(input: WorkshopReplyFileEditInput): Promise<WorkshopReplyEditsContext | undefined> {
  const [fileEdits, editOffers] = await Promise.all([resolveWorkshopReplyFileEdits(input), resolveWorkshopReplyEditOffers(input)]);
  if (!editOffers) {
    return fileEdits;
  }
  return { ...(fileEdits ?? { reply: input.reply, proposals: [], logs: [] }), editOffers };
}

/** Resolve a reply's kept offers to identities (D2). Undefined when the reply holds no offer frame. */
export async function resolveWorkshopReplyEditOffers(input: WorkshopReplyFileEditInput): Promise<WorkshopReplyEditOfferContext | undefined> {
  if (!hasWorkshopEditOfferText(input.reply)) {
    return undefined;
  }
  const control = extractWorkshopReplyControls(input.reply, { memoryOpen: false, fileEditsOpen: input.open }).editOffers;
  if (!control) {
    return undefined;
  }
  const logs = control.rejections.map(dropped);
  if (control.offers.length === 0) {
    return { offers: [], logs };
  }
  if (input.signal?.aborted) {
    return { offers: [], logs: [...logs, ...control.offers.map(() => dropped('not-resolved'))] };
  }
  const results = await Promise.all(control.offers.map((draft) => resolveOne(input.staging, draft)));
  const offers: WorkshopEditOffer[] = [];
  control.offers.forEach((draft, index) => {
    const result = results[index];
    if (typeof result === 'string') {
      logs.push(dropped(`unresolved:${result}`));
      return;
    }
    offers.push({ kind: draft.kind, target: result, ...(draft.count !== undefined ? { count: draft.count } : {}) });
  });
  return { offers, logs };
}

/** The offer's identity, or the name of why it has none. */
async function resolveOne(staging: FileEditStaging, draft: WorkshopEditOfferDraft): Promise<WorkshopEditOffer['target'] | string> {
  let result: FileEditResolutionResult;
  try {
    result = await staging.resolve(draft.target);
  } catch {
    return 'unreadable';
  }
  if (result.kind === 'refused') {
    return result.reason;
  }
  // The staging contract a card's identity is held to (PR #230 F-01): an offer a session can't hold is no offer.
  return workshopFileEditIdentityHoldable(result.target)
    ? { kind: result.target.kind, documentUri: result.target.documentUri, relativePath: result.target.relativePath }
    : 'identity-unpersistable';
}

/**
 * The offers the reply's turn may carry, once its display is known.
 * `control` is completion's own read of the reply; `context` is what was
 * resolved for exactly this reply, absent when nothing was (every frame is
 * then `not-resolved`). Each dropped frame is logged once.
 */
export function settleWorkshopReplyEditOffers(
  control: WorkshopReplyEditOfferControl | undefined,
  context: WorkshopReplyEditOfferContext | undefined,
  display: { readonly content: string; readonly hostWritten: boolean },
  log: (line: string) => void
): readonly WorkshopEditOffer[] {
  if (!control) {
    return [];
  }
  if (!context) {
    [...control.offers, ...control.rejections].forEach(() => log(dropped('not-resolved')));
    return [];
  }
  context.logs.forEach(log);
  const reason = display.hostWritten || display.content.trim().length === 0
    ? 'no-prose'
    : display.content.length > PROMPT_BUDGETS.workshopEditOffers.sourceReplyCharacters ? 'source-reply-too-long' : undefined;
  if (reason) {
    context.offers.forEach(() => log(dropped(reason)));
    return [];
  }
  return context.offers;
}

/** What became of the settled offers on the adopted turn: kept, or dropped because the reply is no persona's. */
export function reportWorkshopEditOffers(offers: readonly WorkshopEditOffer[], turn: Pick<WorkshopTurn, 'editOffers'>, log: (line: string) => void): void {
  for (const offer of offers) {
    log(turn.editOffers
      ? `Edit offer kept (kind=${offer.kind}; target=${offer.target.kind}; count=${offer.count ?? 'none'})`
      : dropped('not-a-persona'));
  }
}
