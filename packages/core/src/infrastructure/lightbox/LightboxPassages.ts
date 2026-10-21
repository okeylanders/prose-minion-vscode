/**
 * The inspector's passages, cut from a board's own text (Slice 4E). Pure.
 *
 * - **Paragraphs.** A pinned paragraph, or the first paragraphs of a pinned
 *   range up to `LIGHTBOX_PASSAGE_BOUNDS.paragraphs`, whole. With `via`, the
 *   term the writer came from has its instances there lit.
 * - **Instances.** Every sentence holding an instance of a counted term.
 *   Sentences are each paragraph's `proseSentenceSpans`, the board's own
 *   per-paragraph rule. An instance that runs across a sentence or paragraph
 *   break (a phrase) makes one row of the sentences it touches, and rows that
 *   share a sentence are one row. Rows past `LIGHTBOX_PASSAGE_BOUNDS.rows`
 *   are not sent; the passage says how many sentences and instances they
 *   hold.
 *
 * Instances are numbered from 0 in text order, the same in both kinds, so
 * the number of distinct instances lit is the number found, and the number
 * found is the board's count: every term is checked to be on the board, and
 * found by the rule that counted it (`LightboxPassageIndex.instancesOf`).
 */

import type {
  LightboxBoard,
  LightboxInstancesPassage,
  LightboxParagraphsPassage,
  LightboxPassage,
  LightboxPassageItem,
  LightboxPassageRow,
  LightboxPassageSegment,
  LightboxPassageTerm
} from '@messages';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import type { LightboxSpan } from '@/infrastructure/lightbox/LightboxInstances';
import type { LightboxPassageIndex, LightboxSentenceSpan } from '@/infrastructure/lightbox/LightboxPassageIndex';

/** An instance and its number. */
interface NumberedSpan extends LightboxSpan {
  id: number;
}

/**
 * The count the board shows for `term`, or undefined when the board does not
 * list it: the one place a passage is checked against the board.
 */
export function lightboxBoardCountOf(board: LightboxBoard, term: LightboxPassageTerm): number | undefined {
  const measured = board.measured;
  switch (term.kind) {
    case 'word':
      return measured.topWords.find((entry) => entry.term === term.word)?.count;
    case 'pos':
      return measured.partsOfSpeech.available
        ? measured.partsOfSpeech[term.pos].find((entry) => entry.term === term.word)?.count
        : undefined;
    case 'phrase':
      return [...measured.phrases.bigrams, ...measured.phrases.trigrams].find((entry) => entry.term === term.phrase)?.count;
    case 'hapax':
      return measured.hapax.some((entry) => entry.term === term.word) ? 1 : undefined;
    case 'flag':
      return measured.styleFlags.find((flag) => flag.id === term.flag)?.count;
  }
}

/** The passage `item` names on `board`, cut from `index`, its text. */
export function buildLightboxPassage(
  board: LightboxBoard,
  index: LightboxPassageIndex,
  item: LightboxPassageItem
): LightboxPassage {
  if (item.kind === 'paragraphs') {
    return paragraphsPassage(board, index, item);
  }
  if (lightboxBoardCountOf(board, item.term) === undefined) {
    return { kind: 'refused', reason: 'not-on-board' };
  }
  return instancesPassage(index, numbered(index.instancesOf(item.term)));
}

function numbered(spans: readonly LightboxSpan[]): NumberedSpan[] {
  return [...spans]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((span, id) => ({ ...span, id }));
}

function paragraphsPassage(
  board: LightboxBoard,
  index: LightboxPassageIndex,
  item: Extract<LightboxPassageItem, { kind: 'paragraphs' }>
): LightboxPassage {
  const count = board.paragraphs.length;
  if (item.from < 1 || item.to > count || item.from > item.to) {
    return { kind: 'refused', reason: 'not-on-board' };
  }
  const last = Math.min(item.to, item.from + LIGHTBOX_PASSAGE_BOUNDS.paragraphs - 1);
  const sent = index.paragraphs.filter((paragraph) => paragraph.index >= item.from && paragraph.index <= last);
  // A term that is no longer on the board lights nothing; the paragraph is still the paragraph.
  const via = item.via && lightboxBoardCountOf(board, item.via) !== undefined ? numbered(index.instancesOf(item.via)) : undefined;
  const lit = new Set<number>();
  const passage: LightboxParagraphsPassage = {
    kind: 'paragraphs',
    paragraphs: sent.map((paragraph) => {
      const touching = (via ?? []).filter((span) => span.start < paragraph.end && span.end > paragraph.start);
      touching.forEach((span) => lit.add(span.id));
      return { index: paragraph.index, segments: segmentsOf(index.text, paragraph.start, paragraph.end, touching) };
    }),
    moreParagraphs: item.to - last
  };
  return via ? { ...passage, lit: lit.size } : passage;
}

function instancesPassage(index: LightboxPassageIndex, spans: readonly NumberedSpan[]): LightboxInstancesPassage {
  const sentences = index.sentences();
  // Each instance's first and last sentence, then runs of instances that share a sentence, merged.
  const groups: Array<{ first: number; last: number; spans: NumberedSpan[] }> = [];
  for (const span of spans) {
    const first = firstSentenceEndingAfter(sentences, span.start);
    let last = first;
    while (last + 1 < sentences.length && sentences[last + 1].start < span.end) {
      last += 1;
    }
    const open = groups[groups.length - 1];
    if (open && first <= open.last) {
      open.last = Math.max(open.last, last);
      open.spans.push(span);
    } else {
      groups.push({ first, last, spans: [span] });
    }
  }
  const sentencesIn = (group: { first: number; last: number }) => group.last - group.first + 1;
  const shown = groups.slice(0, LIGHTBOX_PASSAGE_BOUNDS.rows);
  const hidden = groups.slice(LIGHTBOX_PASSAGE_BOUNDS.rows);
  return {
    kind: 'instances',
    instances: spans.length,
    sentences: groups.reduce((sum, group) => sum + sentencesIn(group), 0),
    rows: shown.map((group): LightboxPassageRow => ({
      sentences: sentences.slice(group.first, group.last + 1).map((sentence) => sentenceOf(index.text, sentence, group.spans))
    })),
    more: {
      rows: hidden.length,
      sentences: hidden.reduce((sum, group) => sum + sentencesIn(group), 0),
      instances: hidden.reduce((sum, group) => sum + group.spans.length, 0)
    }
  };
}

/** The first sentence that ends after `offset` (an instance starts inside it), by binary search. */
function firstSentenceEndingAfter(sentences: readonly LightboxSentenceSpan[], offset: number): number {
  let low = 0;
  let high = sentences.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sentences[middle].end <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** One sentence as shown: its leading space trimmed, its instances lit. */
function sentenceOf(text: string, sentence: LightboxSentenceSpan, spans: readonly NumberedSpan[]) {
  let start = sentence.start;
  while (start < sentence.end && /\s/.test(text[start])) {
    start += 1;
  }
  const touching = spans.filter((span) => span.start < sentence.end && span.end > start);
  return { paragraph: sentence.paragraph, sentence: sentence.sentence, segments: segmentsOf(text, start, sentence.end, touching) };
}

/**
 * `text` from `from` to `to`, cut where an instance starts or ends. Each
 * stretch an instance covers names it; stretches no instance covers are
 * joined.
 */
function segmentsOf(text: string, from: number, to: number, spans: readonly NumberedSpan[]): LightboxPassageSegment[] {
  const cuts = new Set<number>([from, to]);
  for (const span of spans) {
    cuts.add(Math.min(to, Math.max(from, span.start)));
    cuts.add(Math.min(to, Math.max(from, span.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: LightboxPassageSegment[] = [];
  for (let index = 0; index + 1 < points.length; index++) {
    const [start, end] = [points[index], points[index + 1]];
    const instances = spans.filter((span) => span.start < end && span.end > start).map((span) => span.id);
    const previous = segments[segments.length - 1];
    if (instances.length === 0 && previous && !previous.instances) {
      previous.text += text.slice(start, end);
    } else {
      segments.push({ text: text.slice(start, end), ...(instances.length > 0 ? { instances } : {}) });
    }
  }
  return segments;
}
