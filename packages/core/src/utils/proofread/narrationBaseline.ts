/**
 * The narration baseline (ADR 2026-10-21, Amendment 2026-10-26: Slice 3b).
 * Host code measures the whole document's narrative tense and person once
 * per run, and sends them beside every chunk. A passage of mostly dialogue,
 * or a short selection, is then judged against the book's narration, not
 * against its own few verbs. Pure and deterministic.
 *
 * - **Narration is the sentences no one speaks.** The shared sentence rule
 *   (`proseSentenceSpans`) cuts the document. A sentence is left out when it
 *   touches speech (`findSpeechSpans`: double-quoted dialogue by the shared
 *   matcher, which runs an unclosed quote to its paragraph's end, and
 *   single-quoted speech, which that matcher leaves alone since apostrophes
 *   look the same) or a protected region, or
 *   when it still holds any quotation mark. A speech is left out whole, its
 *   interior sentences too, and a possessive or elision inside it does not end
 *   it (PR #174 F-01 and its re-review): speech would otherwise lend its
 *   present tense and its "I" to a past-tense, third-person book. An
 *   apostrophe between two letters ("don't") is not a quotation mark.
 * - **Counted by the tagger** (`tagTextTokens`): finite verbs, past (`VBD`)
 *   and present (`VBZ`, `VBP`), and personal pronouns. The tagger runs on
 *   the extension host, about 6 µs a word, so it reads at most
 *   `NARRATION_BASELINE.sampleWords` words, chosen evenly across the
 *   document by word position (PR #174 F-02). A sentence longer than
 *   `sentenceWords` is read in pieces, so an unpunctuated draft is sampled
 *   like any other, and a prologue in another tense cannot speak for the
 *   book.
 * - **Named only when clear** (`NARRATION_BASELINE`). Otherwise a field is
 *   left out, and the prompt falls back to the passage's own narration.
 *
 * It is a hint: tense and person stay flag-only, whatever it says.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { findSpeechSpans } from '@/utils/draftEdit/speechSpans';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { tagTextTokens } from '@/tools/measure/wordFrequency';

export type NarrativeTense = 'past' | 'present';
export type NarrativePerson = 'first' | 'third';

/** The document's narration, as far as the counts make it clear; each field only when named. */
export interface NarrationBaseline {
  readonly tense?: NarrativeTense;
  readonly person?: NarrativePerson;
}

/**
 * When a field is named. Measured on *Alice* adaptations (the ADR's Slice 3b
 * amendment): past narration read 87–90% past, present narration 100%
 * present; first-person pronouns were 8% of first-person narration's words
 * and none of third-person narration's.
 */
export const NARRATION_BASELINE = Object.freeze({
  /** Fewer finite verbs in narration than this names no tense. */
  minimumFiniteVerbs: 20,
  /** One tense must hold this share of narration's finite verbs. */
  tenseShare: 0.75,
  /** Fewer narration words than this names no person. */
  minimumWords: 200,
  /** First-person singular pronouns, as a share of narration's words, that name `first`. */
  firstPersonShare: 0.01,
  /** `third` needs first-person pronouns at most this share of narration's words… */
  thirdPersonFirstShare: 0.002,
  /** …and third-person pronouns at least this share. */
  thirdPersonShare: 0.01,
  /** A sentence longer than this is read in pieces of this many words. */
  sentenceWords: 500,
  /** The words the tagger reads at most, chosen evenly across a longer document (about 120 ms). */
  sampleWords: 20_000
});

const PAST_TAGS: ReadonlySet<string> = new Set(['VBD']);
const PRESENT_TAGS: ReadonlySet<string> = new Set(['VBZ', 'VBP']);
const FIRST_PERSON: ReadonlySet<string> = new Set(['i', 'me', 'my', 'mine', 'myself']);
const THIRD_PERSON: ReadonlySet<string> = new Set([
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'
]);

/** A quotation mark, single or double, curly or straight; an apostrophe between two letters is not one. */
const QUOTATION_MARK = /["“”‘’']/gu;
const LETTER = /\p{L}/u;

/** One stretch the tagger reads: a narration sentence, or a piece of a long one. */
interface Piece {
  readonly text: string;
  readonly words: number;
}

/** The baseline of `text`, leaving out its protected regions. Throws when the tagger cannot load. */
export function measureNarrationBaseline(text: string, protectedRegions: readonly TextRange[]): NarrationBaseline {
  const excluded = [...findSpeechSpans(text), ...protectedRegions];
  const narration = sampled(clearOf(proseSentenceSpans(text), excluded)
    .map((sentence) => text.slice(sentence.start, sentence.end))
    .filter((sentence) => !holdsQuotationMark(sentence))
    .flatMap(pieces));

  let past = 0;
  let present = 0;
  let words = 0;
  let first = 0;
  let third = 0;
  for (const token of tagTextTokens(narration.join(' '))) {
    if (!LETTER.test(token.value)) {
      continue;
    }
    words += 1;
    if (PAST_TAGS.has(token.pos)) {
      past += 1;
    } else if (PRESENT_TAGS.has(token.pos)) {
      present += 1;
    }
    const word = token.value.toLowerCase();
    if (FIRST_PERSON.has(word)) {
      first += 1;
    } else if (THIRD_PERSON.has(word)) {
      third += 1;
    }
  }
  const tense = tenseOf(past, present);
  const person = personOf(words, first, third);
  return { ...(tense ? { tense } : {}), ...(person ? { person } : {}) };
}

/** The sentences touching none of `excluded`, in one sweep over both in order. */
function clearOf(sentences: readonly TextRange[], excluded: readonly TextRange[]): TextRange[] {
  const ranges = [...excluded].sort((a, b) => a.start - b.start);
  let next = 0;
  return sentences.filter((sentence) => {
    while (next < ranges.length && ranges[next].end <= sentence.start) {
      next += 1;
    }
    for (let index = next; index < ranges.length && ranges[index].start < sentence.end; index += 1) {
      if (ranges[index].end > sentence.start) {
        return false;
      }
    }
    return true;
  });
}

/** A sentence, or a long one cut into pieces of `sentenceWords` words. */
function pieces(sentence: string): Piece[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const size = NARRATION_BASELINE.sentenceWords;
  if (words.length <= size) {
    return [{ text: sentence, words: words.length }];
  }
  const cut: Piece[] = [];
  for (let at = 0; at < words.length; at += size) {
    const piece = words.slice(at, at + size);
    cut.push({ text: piece.join(' '), words: piece.length });
  }
  return cut;
}

/**
 * At most `sampleWords` words, evenly across the document: a piece is taken
 * while the words taken lag the budget's share of the words seen, and never
 * past the budget (PR #174 F-02).
 */
function sampled(all: readonly Piece[]): string[] {
  const budget = NARRATION_BASELINE.sampleWords;
  const total = all.reduce((sum, piece) => sum + piece.words, 0);
  if (total <= budget) {
    return all.map((piece) => piece.text);
  }
  const taken: string[] = [];
  let seen = 0;
  let used = 0;
  for (const piece of all) {
    if (used + piece.words <= budget && used * total <= seen * budget) {
      taken.push(piece.text);
      used += piece.words;
    }
    seen += piece.words;
  }
  return taken;
}

function tenseOf(past: number, present: number): NarrativeTense | undefined {
  const finite = past + present;
  if (finite < NARRATION_BASELINE.minimumFiniteVerbs) {
    return undefined;
  }
  if (past >= NARRATION_BASELINE.tenseShare * finite) {
    return 'past';
  }
  return present >= NARRATION_BASELINE.tenseShare * finite ? 'present' : undefined;
}

function personOf(words: number, first: number, third: number): NarrativePerson | undefined {
  if (words < NARRATION_BASELINE.minimumWords) {
    return undefined;
  }
  if (first >= NARRATION_BASELINE.firstPersonShare * words) {
    return 'first';
  }
  return first <= NARRATION_BASELINE.thirdPersonFirstShare * words && third >= NARRATION_BASELINE.thirdPersonShare * words
    ? 'third'
    : undefined;
}

function holdsQuotationMark(sentence: string): boolean {
  for (const match of sentence.matchAll(QUOTATION_MARK)) {
    const at = match.index ?? 0;
    const apostrophe = (match[0] === '’' || match[0] === "'")
      && LETTER.test(sentence[at - 1] ?? '') && LETTER.test(sentence[at + 1] ?? '');
    if (!apostrophe) {
      return true;
    }
  }
  return false;
}
