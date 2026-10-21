/**
 * The inspector's wells as drawn (Slice 4E): which passage a pin asks the
 * host for, and what the well says while it waits, once it lands, and when
 * the host refuses it. Pure: no React, no transport; `useLightboxPassages`
 * owns the route.
 *
 * A passage is shown only when its answer is for the board on screen: the
 * same board id, the same content hash and the same item. While a newer
 * board's answer is on its way for the same pin, the well says the text
 * changed, never the older text.
 */

import type {
  LightboxBoard,
  LightboxInstancesPassage,
  LightboxParagraphsPassage,
  LightboxPassage,
  LightboxPassageItem,
  LightboxPassageRefusal
} from '@messages';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { LightboxTermRef, isLightboxTermRef, lightboxTermKey, lightboxTermLabel, resolveLightboxTerm } from '@hooks/domain/lightbox/lightboxTerms';
import { pluralize } from '@hooks/domain/lightbox/lightboxReadings';

/** An answer the webview took: for which board, text and item. */
export interface LightboxPassageAnswer {
  /** `lightboxPassageRequestKey` of what was asked. */
  key: string;
  /** `lightboxPassageItemKey` of the item alone. */
  itemKey: string;
  boardId: string;
  contentHash: string;
  passage: LightboxPassage;
}

export interface LightboxPassageWellView {
  kind: 'paragraphs' | 'instances';
  status: 'loading' | 'ready' | 'refused';
  /** The well's heading: "The text · as counted", "Sentences". */
  label: string;
  /** The scrollable region's accessible name. */
  regionLabel: string;
  /** "28 instances in 26 sentences", once the sentences have landed. */
  header?: string;
  /** What is happening, in host words: waiting, the text changed, refused. */
  note?: string;
  /** The passage, only when it answers the board on screen. */
  passage?: LightboxParagraphsPassage | LightboxInstancesPassage;
  /** A paragraph reached from a term: "Lit: “alice”, 2 instances here." */
  lit?: string;
  /** The term a paragraph was reached from, to go back to. */
  back?: { ref: LightboxTermRef; label: string };
  /** The term whose sentences these are: each row's address pins its paragraph lit by it. */
  term?: LightboxTermRef;
  /** What the bound left out, stated. */
  more?: string;
}

/**
 * The passage a pin asks for, or null: a paragraph range (with the term it
 * was reached from, if that term is still on the board), or a counted term
 * the board lists. Other items (lanes, readings, figures) have none.
 */
export function lightboxPassageItemOf(board: LightboxBoard, ref: LightboxItemRef): LightboxPassageItem | null {
  if (ref.kind === 'paragraphs') {
    if (ref.from < 1 || ref.to > board.paragraphs.length || ref.from > ref.to) {
      return null;
    }
    const via = ref.via && resolveLightboxTerm(board, ref.via) ? ref.via : undefined;
    return { kind: 'paragraphs', from: ref.from, to: ref.to, ...(via ? { via } : {}) };
  }
  return isLightboxTermRef(ref) && resolveLightboxTerm(board, ref) ? { kind: 'instances', term: ref } : null;
}

export function lightboxPassageItemKey(item: LightboxPassageItem): string {
  return item.kind === 'paragraphs'
    ? `paragraphs:${item.from}-${item.to}${item.via ? `:via:${lightboxTermKey(item.via)}` : ''}`
    : `instances:${lightboxTermKey(item.term)}`;
}

/** The board, its text and the item: what an answer must match to be shown. */
export function lightboxPassageRequestKey(board: Pick<LightboxBoard, 'boardId' | 'source'>, item: LightboxPassageItem): string {
  return `${board.boardId}|${board.source.contentHash}|${lightboxPassageItemKey(item)}`;
}

const range = (from: number, to: number) => (from === to ? `¶${from}` : `¶${from}–¶${to}`);

const REFUSALS: Readonly<Record<LightboxPassageRefusal, (kind: LightboxPassageItem['kind']) => string>> = {
  changed: () => 'The text changed since this board was counted, so this passage is not shown. Re-read the file to count it again.',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- refusal reasons are kebab-case protocol literals.
  'not-on-board': (kind) => (kind === 'paragraphs' ? 'This paragraph is not on the board any more.' : 'This item is not on the board any more.')
};

/** The well for the pin on this board, given the latest answer taken; null when the pin has no passage. */
export function buildLightboxPassageWellView(
  board: LightboxBoard,
  ref: LightboxItemRef,
  answer: LightboxPassageAnswer | null
): LightboxPassageWellView | null {
  const item = lightboxPassageItemOf(board, ref);
  if (!item) {
    return null;
  }
  const frame = wellFrame(board, item);
  const itemKey = lightboxPassageItemKey(item);
  if (!answer || answer.key !== lightboxPassageRequestKey(board, item)) {
    // The same pin answered for another board or other text: never shown as this one's.
    const changed = answer !== null && answer.itemKey === itemKey;
    return {
      ...frame,
      status: 'loading',
      note: changed
        ? 'The text changed since this was shown. Reading it again from the board as it stands…'
        : item.kind === 'paragraphs'
          ? `Reading ${range(item.from, item.to)} from the text the board counted…`
          : 'Finding the sentences…'
    };
  }
  const passage = answer.passage;
  if (passage.kind === 'refused') {
    return { ...frame, status: 'refused', note: REFUSALS[passage.reason](item.kind) };
  }
  if (passage.kind === 'paragraphs' && item.kind === 'paragraphs') {
    const label = item.via ? lightboxTermLabel(board, item.via) : undefined;
    const shownLast = item.from + passage.paragraphs.length - 1;
    return {
      ...frame,
      status: 'ready',
      passage,
      ...(label && passage.lit !== undefined
        ? { lit: passage.lit > 0 ? `Lit: ${label}, ${pluralize(passage.lit, 'instance')} here.` : `Lit: ${label}, none here.` }
        : {}),
      ...(passage.moreParagraphs > 0
        ? {
            more: `The well shows up to ${LIGHTBOX_PASSAGE_BOUNDS.paragraphs} paragraphs: ${range(shownLast + 1, item.to)} ` +
              `${passage.moreParagraphs === 1 ? 'is' : 'are'} not shown. Pin one below to read it.`
          }
        : {})
    };
  }
  if (passage.kind === 'instances' && item.kind === 'instances') {
    const { more } = passage;
    return {
      ...frame,
      status: 'ready',
      passage,
      header: `${pluralize(passage.instances, 'instance')} in ${pluralize(passage.sentences, 'sentence')}`,
      ...(more.rows > 0
        ? {
            more: `The well lists up to ${LIGHTBOX_PASSAGE_BOUNDS.rows} rows: ${pluralize(more.sentences, 'more sentence')} ` +
              `with ${pluralize(more.instances, 'instance')} ${more.sentences === 1 ? 'is' : 'are'} not listed.`
          }
        : {})
    };
  }
  // A reply of the other kind answers nothing this pin asked.
  return { ...frame, status: 'loading', note: 'Finding the sentences…' };
}

/** What every state of the well shares: its kind, heading, name, and the term it is about. */
function wellFrame(board: LightboxBoard, item: LightboxPassageItem): Pick<LightboxPassageWellView, 'kind' | 'label' | 'regionLabel' | 'back' | 'term'> {
  if (item.kind === 'paragraphs') {
    const shownLast = Math.min(item.to, item.from + LIGHTBOX_PASSAGE_BOUNDS.paragraphs - 1);
    return {
      kind: 'paragraphs',
      label: shownLast < item.to ? `The text · ${range(item.from, shownLast)} of ${range(item.from, item.to)}` : 'The text · as counted',
      regionLabel: `Text of ${range(item.from, shownLast)}`,
      ...(item.via ? { back: { ref: item.via, label: `Back to ${lightboxTermLabel(board, item.via)}` } } : {})
    };
  }
  return {
    kind: 'instances',
    label: 'Sentences',
    regionLabel: `Sentences holding ${lightboxTermLabel(board, item.term)}`,
    term: item.term
  };
}
