/**
 * The narration baseline (ADR 2026-10-21, Amendment 2026-10-26: Slice 3b).
 * Host code measures the whole document's narrative tense and person once
 * per run, and sends them beside every chunk. A passage of mostly dialogue,
 * or a short selection, is then judged against the book's narration, not
 * against its own few verbs. Pure and deterministic.
 *
 * - **Narration is the sentences no one speaks.** The shared sentence rule
 *   (`proseSentenceSpans`) cuts the document. A sentence is left out when it
 *   touches double-quoted dialogue (`findDialogueSpans`, which runs an
 *   unclosed quote to its paragraph's end) or a protected region, or when it
 *   holds any quotation mark. That last rule catches single-quoted speech,
 *   which the dialogue matcher leaves alone because apostrophes look the
 *   same; an apostrophe between two letters ("don't") is not a quotation
 *   mark. Speech would otherwise lend its present tense and its "I" to a
 *   past-tense, third-person book.
 * - **Counted by the tagger** (`tagTextTokens`): finite verbs, past (`VBD`)
 *   and present (`VBZ`, `VBP`), and personal pronouns.
 * - **Named only when clear** (`NARRATION_BASELINE`). Otherwise a field is
 *   left out, and the prompt falls back to the passage's own narration.
 *
 * It is a hint: tense and person stay flag-only, whatever it says.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { findDialogueSpans } from '@/utils/dialogueSpans';
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
  thirdPersonShare: 0.01
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

/** The baseline of `text`, leaving out its protected regions. Throws when the tagger cannot load. */
export function measureNarrationBaseline(text: string, protectedRegions: readonly TextRange[]): NarrationBaseline {
  const excluded = [...findDialogueSpans(text), ...protectedRegions];
  const narration = proseSentenceSpans(text)
    .filter((sentence) => !excluded.some((range) => range.start < sentence.end && sentence.start < range.end))
    .map((sentence) => text.slice(sentence.start, sentence.end))
    .filter((sentence) => !holdsQuotationMark(sentence));

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
