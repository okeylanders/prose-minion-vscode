/**
 * An edit-offer chip as drawn (ADR 2026-11-10 U2, U5, U6 and its addendum;
 * epic Slice 3): pure reads of the offer the host's view of the turn holds.
 * Nothing here decides a status; it says the host's status in words, and
 * what a press does.
 *
 * - **Five faces.** Open ("3 fixes"), asked ("Asking Jill for 3 fixes…"),
 *   answered ("3 fixes suggested"), nothing to change, ask again. Each has
 *   its own words, never color alone.
 * - **`askAgain` is drawn** (the addendum): a chip whose status carries it
 *   ends "· ask again" and a press asks. An answered chip without it goes to
 *   the answer.
 * - **The count** is the persona's own until an answer came; after one, the
 *   chip shows what came (`changes`).
 * - **Waiting** (U5): a chip that would ask, but cannot right now, keeps its
 *   face and carries the reason. A chip that goes to an answer never waits.
 * - **Names start with the visible label** (U6), then say who, what and
 *   where.
 */

import type { WorkshopEditOffer, WorkshopEditOfferKind } from '@messages';
import { workshopEditOfferCountWords, workshopEditOfferRefusalWords } from '@shared/constants/workshopEditOfferWords';

/** A chip's key in the hook's state: its turn, its kind and, for one version of an offer with options, its option. */
export function workshopEditOfferKey(turnId: string, kind: WorkshopEditOfferKind, option?: number): string {
  return option === undefined ? `${turnId}#${kind}` : `${turnId}#${kind}#${option}`;
}

export type WorkshopEditOfferChipFace = 'open' | 'asked' | 'answered' | 'nothing-to-change' | 'ask-again';

/** What a press does: ask the persona, go to the answer, or nothing (asked). */
export type WorkshopEditOfferChipPress =
  | { readonly kind: 'ask' }
  | { readonly kind: 'go'; readonly answerTurnId: string }
  | { readonly kind: 'none' };

export interface WorkshopEditOfferChipView {
  readonly face: WorkshopEditOfferChipFace;
  /** The count the label leads with, when it has one. */
  readonly count?: number;
  /** The visible words after the count. */
  readonly words: string;
  /** The whole visible label, as read. */
  readonly label: string;
  /** The accessible name: the label, then who, what and where. */
  readonly name: string;
  readonly press: WorkshopEditOfferChipPress;
  /** Why a press does nothing right now, when the chip would otherwise ask. */
  readonly waiting?: string;
  /** The host's words from the last press that left no answer. */
  readonly feedback?: string;
}

/** The room facts a chip reads beside its own offer. */
export interface WorkshopEditOfferChipFacts {
  /** The reply's author, as the bubble names them. */
  readonly personaLabel: string;
  /** This webview's own press is out and unanswered. */
  readonly asking: boolean;
  /** A reply is running in the room. */
  readonly running: boolean;
  /** The room's mutation lock is held for something other than a reply. */
  readonly locked: boolean;
  /** The host's words for the last press of this chip that left no answer. */
  readonly feedback?: string;
}

const kindNoun = (kind: WorkshopEditOfferKind, count: number | undefined): string =>
  count === 1 ? (kind === 'fixes' ? 'fix' : 'rewrite') : kind;

/** "Wait for the current reply to finish", the room's lock, or the author who left: first that holds. */
function waitingReason(status: WorkshopEditOffer['status'], facts: WorkshopEditOfferChipFacts): string | undefined {
  if (status && status.state !== 'asked' && status.blocked === 'author-left') {
    return `${facts.personaLabel} isn’t in this room now`;
  }
  if (facts.running) {
    return workshopEditOfferRefusalWords('run-active');
  }
  if (facts.locked) {
    return workshopEditOfferRefusalWords('session-operation');
  }
  return undefined;
}

export function workshopEditOfferChipView(offer: WorkshopEditOffer, facts: WorkshopEditOfferChipFacts, option?: number): WorkshopEditOfferChipView {
  const version = option === undefined ? undefined : offer.options?.[option];
  if (version !== undefined && option !== undefined) {
    return optionChipView(offer, version, offer.optionStatuses?.[option] ?? { state: 'open' }, facts);
  }
  const { kind } = offer;
  const { personaLabel } = facts;
  const path = offer.target.relativePath;
  const status = offer.status ?? { state: 'open' as const };
  const declared = workshopEditOfferCountWords(kind, offer.count);
  const them = offer.count === 1 ? 'it' : 'them';

  if (status.state === 'asked' || facts.asking) {
    const label = `Asking ${personaLabel} for ${declared}…`;
    return {
      face: 'asked',
      words: label,
      label,
      name: `${label} The room’s Stop ends the request.`,
      press: { kind: 'none' }
    };
  }

  const ask = (face: WorkshopEditOfferChipFace, count: number | undefined, words: string, name: string): WorkshopEditOfferChipView => {
    const waiting = waitingReason(status, facts);
    return {
      face,
      ...(count !== undefined ? { count } : {}),
      words,
      label: count !== undefined ? `${count} ${words}` : words,
      name,
      press: { kind: 'ask' },
      ...(waiting ? { waiting } : {}),
      ...(facts.feedback ? { feedback: facts.feedback } : {})
    };
  };

  switch (status.state) {
    case 'open':
      return ask('open', offer.count, kindNoun(kind, offer.count),
        `${declared}. Ask ${personaLabel} to suggest ${them} as edits to ${path}.`);
    case 'nothing-to-change': {
      const words = `${kindNoun(kind, offer.count)} · nothing to change · ask again`;
      return ask('nothing-to-change', offer.count, words,
        `${declared}, nothing to change, ask again. Ask ${personaLabel} again to suggest ${them} as edits to ${path}.`);
    }
    case 'ask-again': {
      const words = `${kindNoun(kind, offer.count)} · ask again`;
      return ask('ask-again', offer.count, words,
        `${declared}, ask again. The last suggested edits were not applied. Ask ${personaLabel} again to suggest ${them} as edits to ${path}.`);
    }
    case 'answered': {
      const came = workshopEditOfferCountWords(kind, status.changes);
      if (status.askAgain) {
        const words = `${kindNoun(kind, status.changes)} suggested · ask again`;
        return ask('ask-again', status.changes, words,
          `${came} suggested, ask again. Ask ${personaLabel} again to suggest them as edits to ${path}.`);
      }
      const label = `${came} suggested`;
      return {
        face: 'answered',
        count: status.changes,
        words: `${kindNoun(kind, status.changes)} suggested`,
        label,
        name: `${label}. Go to the edits.`,
        press: { kind: 'go', answerTurnId: status.answerTurnId }
      };
    }
  }
}

/**
 * One version of an offer with options (second addendum): the chip is
 * labeled with the persona's own declared words, shown as text, and has the
 * same five faces. It carries no count: a version is one edit to ask for.
 */
function optionChipView(
  offer: WorkshopEditOffer,
  version: string,
  status: NonNullable<WorkshopEditOffer['status']>,
  facts: WorkshopEditOfferChipFacts
): WorkshopEditOfferChipView {
  const { personaLabel } = facts;
  const path = offer.target.relativePath;
  if (status.state === 'asked' || facts.asking) {
    const label = `Asking ${personaLabel} for ${version}…`;
    return { face: 'asked', words: label, label, name: `${label} The room’s Stop ends the request.`, press: { kind: 'none' } };
  }
  const ask = (face: WorkshopEditOfferChipFace, words: string, name: string): WorkshopEditOfferChipView => {
    const waiting = waitingReason(status, facts);
    return {
      face,
      words,
      label: words,
      name,
      press: { kind: 'ask' },
      ...(waiting ? { waiting } : {}),
      ...(facts.feedback ? { feedback: facts.feedback } : {})
    };
  };
  switch (status.state) {
    case 'open':
      return ask('open', version, `${version}. Ask ${personaLabel} to suggest it as an edit to ${path}.`);
    case 'nothing-to-change':
      return ask('nothing-to-change', `${version} · nothing to change · ask again`,
        `${version}, nothing to change, ask again. Ask ${personaLabel} again to suggest it as an edit to ${path}.`);
    case 'ask-again':
      return ask('ask-again', `${version} · ask again`,
        `${version}, ask again. The last suggested edits were not applied. Ask ${personaLabel} again to suggest it as an edit to ${path}.`);
    case 'answered': {
      if (status.askAgain) {
        return ask('ask-again', `${version} suggested · ask again`,
          `${version} suggested, ask again. Ask ${personaLabel} again to suggest it as an edit to ${path}.`);
      }
      const label = `${version} suggested`;
      return { face: 'answered', words: label, label, name: `${label}. Go to the edits.`, press: { kind: 'go', answerTurnId: status.answerTurnId } };
    }
  }
}

/** "Edits Jill can suggest from this reply": the offers' group name (U6). */
export function workshopEditOfferGroupLabel(personaLabel: string): string {
  return `Edits ${personaLabel} can suggest from this reply`;
}
