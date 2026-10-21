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
 * - **Outside every sentence.** The sentence rule counts no sentence in a
 *   stretch of only space, closing marks and end marks, but a counted token
 *   can stand there (a straight `'` is a word to the vocabulary figures).
 *   Its row is that stretch of its own paragraph, lit, and the passage
 *   counts it apart (`outside`): never a sentence nearby, never a sentence
 *   invented (PR #161 N-01).
 *
 * Instances are numbered from 0 in text order, the same in both kinds, so
 * the number of distinct instances lit is the number found, and the number
 * found is the board's count: every term is checked to be on the board, and
 * found by the rule that counted it (`LightboxPassageIndex.instancesOf`).
 *
 * The row bound limits rows, not what one row holds: a sentence can hold
 * thousands of instances, and an instance run can join thousands of
 * sentences. So the cutting is linear in what is sent (PR #159 N-01): one
 * walk matches sentences or paragraphs to the instances that touch them, and
 * one sweep over where instances open and close cuts each into segments.
 */

import type {
  LightboxBoard,
  LightboxInstancesPassage,
  LightboxParagraphsPassage,
  LightboxPassage,
  LightboxPassageItem,
  LightboxPassageRow,
  LightboxPassageSegment,
  LightboxPassageSentence,
  LightboxPassageTerm
} from '@messages';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import type { LightboxSpan } from '@/infrastructure/lightbox/LightboxInstances';
import type { LightboxPassageIndex, LightboxSentenceSpan } from '@/infrastructure/lightbox/LightboxPassageIndex';
import type { LightboxParagraph } from '@/infrastructure/lightbox/LightboxParagraphs';

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
  const touching = instancesTouching(sent, via ?? []);
  const lit = new Set<number>();
  const passage: LightboxParagraphsPassage = {
    kind: 'paragraphs',
    paragraphs: sent.map((paragraph, position) => {
      touching[position].forEach((span) => lit.add(span.id));
      return { index: paragraph.index, segments: segmentsOf(index.text, paragraph.start, paragraph.end, touching[position]) };
    }),
    moreParagraphs: item.to - last
  };
  return via ? { ...passage, lit: lit.size } : passage;
}

/** A row in the making: instances sharing sentences, or sharing one stretch that no sentence holds. */
type RowGroup =
  | { kind: 'sentences'; first: number; last: number; spans: NumberedSpan[] }
  | { kind: 'outside'; paragraph: number; start: number; end: number; spans: NumberedSpan[] };

function instancesPassage(index: LightboxPassageIndex, spans: readonly NumberedSpan[]): LightboxInstancesPassage {
  const sentences = index.sentences();
  // Each instance's first and last sentence, then runs of instances that share a sentence, merged.
  // An instance no sentence touches keeps its own stretch of its paragraph (PR #161 N-01).
  const groups: RowGroup[] = [];
  for (const span of spans) {
    const first = firstSentenceEndingAfter(sentences, span.start);
    const open = groups[groups.length - 1];
    const sentence = sentences[first];
    if (sentence === undefined || sentence.end <= span.start || sentence.start >= span.end) {
      const stretch = outsideStretch(index, sentences, first, span);
      if (open?.kind === 'outside' && open.start === stretch.start) {
        open.spans.push(span);
      } else {
        groups.push({ kind: 'outside', ...stretch, spans: [span] });
      }
      continue;
    }
    let last = first;
    while (last + 1 < sentences.length && sentences[last + 1].start < span.end) {
      last += 1;
    }
    if (open?.kind === 'sentences' && first <= open.last) {
      open.last = Math.max(open.last, last);
      open.spans.push(span);
    } else {
      groups.push({ kind: 'sentences', first, last, spans: [span] });
    }
  }
  const sentencesIn = (group: RowGroup) => (group.kind === 'sentences' ? group.last - group.first + 1 : 0);
  const outsideIn = (group: RowGroup) => (group.kind === 'outside' ? group.spans.length : 0);
  const sum = (of: readonly RowGroup[], count: (group: RowGroup) => number) => of.reduce((total, group) => total + count(group), 0);
  const shown = groups.slice(0, LIGHTBOX_PASSAGE_BOUNDS.rows);
  const hidden = groups.slice(LIGHTBOX_PASSAGE_BOUNDS.rows);
  return {
    kind: 'instances',
    instances: spans.length,
    sentences: sum(groups, sentencesIn),
    outside: sum(groups, outsideIn),
    rows: shown.map((group): LightboxPassageRow => (group.kind === 'sentences'
      ? { sentences: rowSentences(index.text, sentences.slice(group.first, group.last + 1), group.spans) }
      : { outside: { paragraph: group.paragraph, segments: segmentsOf(index.text, group.start, group.end, group.spans) } })),
    more: {
      rows: hidden.length,
      sentences: sum(hidden, sentencesIn),
      instances: sum(hidden, (group) => group.spans.length),
      outside: sum(hidden, outsideIn)
    }
  };
}

/**
 * The stretch of its own paragraph that holds `span`, which no sentence
 * touches: from the end of the sentence before it in that paragraph (or the
 * paragraph's start) to the start of the sentence after it there (or the
 * paragraph's end), outer space trimmed. `first` is the first sentence
 * ending after the span's start, as `firstSentenceEndingAfter` found it.
 */
function outsideStretch(
  index: LightboxPassageIndex,
  sentences: readonly LightboxSentenceSpan[],
  first: number,
  span: LightboxSpan
): { paragraph: number; start: number; end: number } {
  const paragraph = paragraphAt(index.paragraphs, span.start);
  const after = sentences[first] !== undefined && sentences[first].end > span.start ? sentences[first] : undefined;
  const before = after ? sentences[first - 1] : sentences[first];
  let start = before?.paragraph === paragraph.index ? before.end : paragraph.start;
  let end = after?.paragraph === paragraph.index ? after.start : paragraph.end;
  while (start < span.start && /\s/.test(index.text[start])) {
    start += 1;
  }
  while (end > span.end && /\s/.test(index.text[end - 1])) {
    end -= 1;
  }
  return { paragraph: paragraph.index, start, end };
}

/**
 * The paragraph holding `offset`: the last one starting at or before it. A
 * counted token is never space, and paragraphs hold all of a text but the
 * space between them, so it is always inside the one found.
 */
function paragraphAt(paragraphs: readonly LightboxParagraph[], offset: number): LightboxParagraph {
  let low = 0;
  let high = paragraphs.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (paragraphs[middle].start <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return paragraphs[low];
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

/** A row's sentences as shown: each with its leading space trimmed and its instances lit. */
function rowSentences(
  text: string,
  sentences: readonly LightboxSentenceSpan[],
  spans: readonly NumberedSpan[]
): LightboxPassageSentence[] {
  const shown = sentences.map((sentence) => {
    let start = sentence.start;
    while (start < sentence.end && /\s/.test(text[start])) {
      start += 1;
    }
    return { sentence, start, end: sentence.end };
  });
  const touching = instancesTouching(shown, spans);
  return shown.map(({ sentence, start, end }, position) => ({
    paragraph: sentence.paragraph,
    sentence: sentence.sentence,
    segments: segmentsOf(text, start, end, touching[position])
  }));
}

/**
 * For each of `ranges` (in text order, not overlapping), the instances that
 * touch it, in number order, in one walk. `spans` are in number order, which
 * is text order by start. An instance joins the open list when a range ends
 * after its start, and leaves it once a range starts at or after its end,
 * since no later range can touch it then.
 */
function instancesTouching(ranges: readonly LightboxSpan[], spans: readonly NumberedSpan[]): NumberedSpan[][] {
  let next = 0;
  let open: NumberedSpan[] = [];
  return ranges.map((range) => {
    // A new list each time: the one returned for the range before is left as it was.
    open = open.filter((span) => span.end > range.start);
    for (; next < spans.length && spans[next].start < range.end; next++) {
      if (spans[next].end > range.start) {
        open.push(spans[next]);
      }
    }
    return open;
  });
}

/**
 * `text` from `from` to `to`, cut where an instance opens or closes. Each
 * stretch names the instances that cover it; stretches no instance covers
 * are joined. One sweep over the openings and closings, in text order, with
 * the instances open at each point: overlapping instances (a phrase that
 * shares words with the next) keep their own numbers.
 */
function segmentsOf(text: string, from: number, to: number, spans: readonly NumberedSpan[]): LightboxPassageSegment[] {
  const clamp = (offset: number) => Math.min(to, Math.max(from, offset));
  const events: Array<{ at: number; id: number; opens: boolean }> = [];
  for (const span of spans) {
    const [start, end] = [clamp(span.start), clamp(span.end)];
    if (start < end) {
      events.push({ at: start, id: span.id, opens: true }, { at: end, id: span.id, opens: false });
    }
  }
  events.sort((a, b) => a.at - b.at);
  const covering = new Set<number>();
  const segments: LightboxPassageSegment[] = [];
  let event = 0;
  for (let start = from; start < to;) {
    for (; event < events.length && events[event].at === start; event++) {
      if (events[event].opens) {
        covering.add(events[event].id);
      } else {
        covering.delete(events[event].id);
      }
    }
    const end = event < events.length ? events[event].at : to;
    const previous = segments[segments.length - 1];
    if (covering.size === 0 && previous && !previous.instances) {
      previous.text += text.slice(start, end);
    } else {
      const instances = [...covering].sort((a, b) => a - b);
      segments.push({ text: text.slice(start, end), ...(instances.length > 0 ? { instances } : {}) });
    }
    start = end;
  }
  return segments;
}
