/**
 * The edit-offer trailer's codec (ADR 2026-11-10 D1; epic Slice 1). Pure. It
 * decodes the inside of one `<prose-minion-edit-offer>` frame the tail
 * extractor (`workshopReplyControls`) found, read by the shared trailer
 * reader, against closed element names and
 * `PROMPT_BUDGETS.workshopEditOffers`, and refuses the whole frame on any
 * fault, by reason. Faults are values, never thrown.
 *
 * - **`<kind>`:** required, once: `fixes` or `rewrites`
 *   (`WORKSHOP_EDIT_OFFER_KINDS`), in any letter case. Anything else is
 *   `unknown-kind`.
 * - **The file:** `<excerpt/>`, or `<group>` and `<path>`, read by the
 *   file-edit codec's own rule (`decodeWorkshopFileEditTarget`), so an offer
 *   names its file exactly as a file edit does. One file per offer.
 * - **`<count>`:** optional, once: a whole number from 1 to `count`, in
 *   digits. It is for a chip's label only.
 * - **`<option>`:** on a rewrites offer only, up to `optionsPerOffer` times:
 *   the label the reply's prose gave one alternative version. Each is
 *   trimmed, one line, 1 to `optionCharacters` characters, and unlike every
 *   other once case-folded. An option on a fixes offer (`option-on-fixes`),
 *   more than the bound (`too-many-options`), an empty one (`empty-option`),
 *   one over its bound or over a line (`invalid-option`) or a repeat
 *   (`duplicate-option`) refuses the frame.
 *
 * The target is only what the frame named: the host resolves it to an
 * identity (D2). Reasons, never text: no caller logs what a field held.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  isWorkshopEditOfferKind,
  type WorkshopEditOfferKind
} from '@shared/types/messages/workshop/editOffers';
import type { WorkshopFileEditRequestedTarget } from '@shared/types/messages/workshop/fileEdits';
import {
  decodeWorkshopFileEditTarget,
  type WorkshopFileEditTargetFault
} from '@/utils/workshopFileEditProtocol';
import {
  readWorkshopTrailerElements,
  type WorkshopTrailerReadFault
} from '@/utils/workshopTrailerElements';

export const WORKSHOP_EDIT_OFFER_TAG = 'prose-minion-edit-offer';

/** Every element the frame reads; `excerpt` alone may close itself. */
export const WORKSHOP_EDIT_OFFER_ELEMENTS = ['kind', 'group', 'path', 'excerpt', 'count', 'option'] as const;

export const WORKSHOP_EDIT_OFFER_FAULTS = [
  'repeated-element',
  'missing-kind',
  'unknown-kind',
  'invalid-count',
  'option-on-fixes',
  'too-many-options',
  'empty-option',
  'invalid-option',
  'duplicate-option'
] as const;
export type WorkshopEditOfferFault =
  | typeof WORKSHOP_EDIT_OFFER_FAULTS[number]
  | WorkshopFileEditTargetFault
  | WorkshopTrailerReadFault;

/** What a valid frame carries; the host resolves the file to an identity (D2). */
export interface WorkshopEditOfferDraft {
  readonly kind: WorkshopEditOfferKind;
  readonly target: WorkshopFileEditRequestedTarget;
  readonly count?: number;
  /** A rewrites offer's alternative versions, as labeled: trimmed, in the order written. */
  readonly options?: readonly string[];
}

export type WorkshopEditOfferDecode =
  | { readonly kind: 'offer'; readonly offer: WorkshopEditOfferDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopEditOfferFault };

/** Digits only, no sign, no leading zero: at most two, so a count is never parsed from more. */
const COUNT = /^[1-9][0-9]?$/;

/** Whether a number is a count an offer may carry: the codec's rule, and the session codec's for a saved offer. */
export function isWorkshopEditOfferCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= PROMPT_BUDGETS.workshopEditOffers.count;
}

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopEditOffer(inner: string): WorkshopEditOfferDecode {
  const read = readWorkshopTrailerElements(inner, { elements: WORKSHOP_EDIT_OFFER_ELEMENTS, empty: ['excerpt'] });
  if (read.kind === 'fault') {
    return reject(read.fault);
  }
  const elements = read.elements;
  const seen = new Set<string>();
  for (const { name } of elements) {
    // `<option>` alone may repeat: one per alternative version.
    if (name !== 'option' && seen.has(name)) {
      return reject('repeated-element');
    }
    seen.add(name);
  }
  const kind = elements.find((element) => element.name === 'kind')?.content.trim().toLowerCase();
  if (!kind) {
    return reject('missing-kind');
  }
  if (!isWorkshopEditOfferKind(kind)) {
    return reject('unknown-kind');
  }
  const target = decodeWorkshopFileEditTarget(elements);
  if (typeof target === 'string') {
    return reject(target);
  }
  const options = decodeOptions(kind, elements.filter((element) => element.name === 'option').map((element) => element.content.trim()));
  if (typeof options === 'string') {
    return reject(options);
  }
  const named = options.length > 0 ? { options } : {};
  const written = elements.find((element) => element.name === 'count')?.content.trim();
  if (written === undefined) {
    return { kind: 'offer', offer: { kind, target, ...named } };
  }
  const count = COUNT.test(written) ? Number(written) : undefined;
  return isWorkshopEditOfferCount(count) ? { kind: 'offer', offer: { kind, target, count, ...named } } : reject('invalid-count');
}

/** A line break or any other control character: an option label is one line of text. */
const NOT_ONE_LINE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

/** Whether a string is one option label: the codec's rule, and the session codec's for a saved offer. */
export function isWorkshopEditOfferOption(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= PROMPT_BUDGETS.workshopEditOffers.optionCharacters
    && value.trim() === value && !NOT_ONE_LINE.test(value);
}

/** How two labels are compared: a repeat differs by more than letter case. */
export function workshopEditOfferOptionKey(label: string): string {
  return label.normalize('NFC').toLowerCase();
}

/** Whether a list is a rewrites offer's options: one to the bound, each a label, no two alike. */
export function areWorkshopEditOfferOptions(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= PROMPT_BUDGETS.workshopEditOffers.optionsPerOffer
    && value.every(isWorkshopEditOfferOption) && new Set(value.map(workshopEditOfferOptionKey)).size === value.length;
}

function decodeOptions(kind: WorkshopEditOfferKind, labels: readonly string[]): readonly string[] | WorkshopEditOfferFault {
  if (labels.length === 0) {
    return labels;
  }
  if (kind !== 'rewrites') {
    return 'option-on-fixes';
  }
  if (labels.length > PROMPT_BUDGETS.workshopEditOffers.optionsPerOffer) {
    return 'too-many-options';
  }
  const seen = new Set<string>();
  for (const label of labels) {
    if (label.length === 0) {
      return 'empty-option';
    }
    if (!isWorkshopEditOfferOption(label)) {
      return 'invalid-option';
    }
    const key = workshopEditOfferOptionKey(label);
    if (seen.has(key)) {
      return 'duplicate-option';
    }
    seen.add(key);
  }
  return labels;
}

function reject(fault: WorkshopEditOfferFault): Extract<WorkshopEditOfferDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
