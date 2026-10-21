/**
 * Craft steering, measured (ADR 2026-10-19 D5, D7 second addendum; Slice
 * 4F, epic decision 21). Pure apart from the tagger it calls: no host, no
 * I/O, no model.
 *
 * For each figure craft steering owns (being verbs, adverbs, intensifiers
 * and fillers), the board counts:
 * - **total and rate**, paragraph by paragraph, by the figure's own
 *   detector (`LIGHTBOX_NUMBER_PATTERNS`), over the words the numbers tile
 *   counts, so both equal the numbers row's `instances` and `value`;
 * - **narration and dialogue**: an instance inside a `findDialogueSpans`
 *   span is dialogue. That matcher's limit applies: single-quoted dialogue
 *   (‘…’) reads as narration;
 * - **runs of short sentences**: an instance inside a run of at least
 *   `LIGHTBOX_STEERING_SHORT_RUN` consecutive sentences of at most
 *   `LIGHTBOX_STEERING_SHORT_SENTENCE_WORDS` words, within one paragraph
 *   (`proseSentenceSpans`, the prose-stats word rule). The sentences are the
 *   shared rule's (which keeps a closing quotation mark with its sentence,
 *   ADR 2026-10-21): this module never splits text itself. A span with no
 *   letter (a dash or markup left after a paragraph's last sentence, say)
 *   is no sentence: it neither extends nor breaks a run. A run never crosses a paragraph break, so a
 *   stretch of one-line paragraphs is not a run;
 * - **constructions**, a partition of the instances, from the tokens around
 *   each one as the word-frequency tool's tagger (wink, `tagTextTokens`)
 *   tags its paragraph. Markup tokens (`_`, `*`) are skipped.
 *
 * **The construction rules, with what they get wrong.**
 * - Being verbs, first match wins:
 *   - `expletive`, *there or it + be*: the token before is an existential
 *     *there* (tag `EX`) or the word *it*. A referential *it* ("The key? It
 *     was gold.") counts too, and so does an inverted *it* standing before
 *     a later form ("Was it what it was?").
 *   - Else, skipping adverbs (`RB*`: not, very, never, still): `progressive`
 *     before `VBG`, `passive` before `VBN`, `adjective` before `JJ*`.
 *     The tagger reads an adjectival participle ("was tired", "were
 *     surprised") as `VBN`, so it counts as *be + past participle*, as
 *     Style Flags' passive pattern counts it.
 *   - Else `other`: identity, a noun, a place, a pronoun, or a form before
 *     punctuation ("That is what it was.").
 *   - A contraction (epic decision 26) is its own token once its paragraph
 *     is tagged with curly apostrophes straightened (`withStraightApostrophes`,
 *     the same offsets): "it's" is *there or it + be*, "I'm tired" *be +
 *     adjective*, and a negated form's "n't" is an adverb the rules look
 *     past ("wasn't cold"). The tagger keeps "you're" as one token, so its
 *     word before is the one before "you".
 * - Adverbs (-ly), first match wins:
 *   - `dialogue-tag`: the word before or after is one of
 *     `LIGHTBOX_STEERING_TAG_VERBS` ("said softly"). A tag with the speaker
 *     between ("said Alice softly") is missed.
 *   - `before-adjective`: the next token is `JJ*` ("strangely quiet").
 *   - `with-verb`: the next token is a verb (`VB*`), else the token before,
 *     skipping adverbs, is ("walked slowly", "ran really quickly"). Whether
 *     that verb is on Style Flags' weak-verbs list (`STYLE_FLAG_WEAK_VERBS`)
 *     is counted as `weakVerbs`. A form of *be* is a verb here.
 *   - `before-adverb`: the next token is `RB*` ("really quickly").
 *   - Else `other`. The detector counts any word ending in -ly, so
 *     adjectives ("lovely", "silly"), nouns ("family") and "only" land here
 *     or wherever their neighbors put them.
 * - Intensifiers and fillers, looking past other fillers ("really very"):
 *   - `generic`: the next word is on `LIGHTBOX_STEERING_GENERIC_WORDS`
 *     ("very big"). The list is short and plain on purpose: an apt "very
 *     deep" counts as generic, and a vague word not on the list does not.
 *   - `before-modifier`: the next token is `JJ*` or `RB*`.
 *   - Else `other` ("just then", "rather than", "actually,").
 *
 * A paragraph is tagged on its own, so no rule looks across a paragraph
 * break; the board's part-of-speech lists tag the whole text, so a tag here
 * can differ from theirs where a heading runs into the next paragraph. An
 * instance whose token the tagger did not place counts as `other`. When the
 * tagger cannot load, totals, splits and runs stand, and the constructions
 * are not measured (`tagged: false`).
 *
 * **Work grows with the text (PR #160 F-01).** The measure runs with every
 * board, before any press and whether or not the lens is on, so no step
 * rescans a paragraph per instance. The tagger's tokens (in-order,
 * non-overlapping slices, as `tagTextTokens` makes them) are read once and
 * found by binary search; each token's neighbour past markup, adverbs or
 * fillers comes from one sweep per rule; the dialogue spans and the short
 * runs (coalesced, one interval per run) are answered by binary search over
 * their starts with the furthest end reached so far. Each answer is the one
 * the plain scan gave.
 */

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids. */

import type {
  LightboxSteeringConstruction,
  LightboxSteeringFigure,
  LightboxSteeringMeasure,
  LightboxSteeringStatId
} from '@messages';
import { findDialogueSpans } from '@/utils/dialogueSpans';
import { countWords } from '@/utils/textUtils';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { STYLE_FLAG_FILLER_WORDS, STYLE_FLAG_WEAK_VERBS } from '@/tools/measure/styleFlags';
import { tagTextTokens, type TaggedToken } from '@/tools/measure/wordFrequency';
import { withStraightApostrophes } from '@/tools/measure/beingVerbs';
import {
  LIGHTBOX_NUMBER_PATTERNS,
  emptyLightboxFigureCounts,
  lightboxFigureFraction,
  lightboxFigureRate
} from '@/infrastructure/lightbox/LightboxNumbers';
import { LIGHTBOX_STEERING_CONSTRUCTIONS, LIGHTBOX_STEERING_STATS } from '@shared/constants/lightboxSteering';

/** A run of short sentences needs at least this many in a row. */
export const LIGHTBOX_STEERING_SHORT_RUN = 3;
/** A sentence of at most this many words is short. */
export const LIGHTBOX_STEERING_SHORT_SENTENCE_WORDS = 8;

/** Dialogue-tag verbs an -ly word beside them is read with ("said softly"). Lower case. */
export const LIGHTBOX_STEERING_TAG_VERBS: readonly string[] = ['said', 'says', 'asked', 'asks'];

/** Plain, generic descriptors an intensifier before them is read as propping up ("very big"). Lower case. */
export const LIGHTBOX_STEERING_GENERIC_WORDS: readonly string[] = [
  'good', 'bad', 'nice', 'fine', 'great', 'big', 'small', 'little', 'large', 'huge', 'tiny', 'long', 'short',
  'old', 'new', 'young', 'hard', 'easy', 'fast', 'slow', 'quick', 'hot', 'cold', 'warm', 'cool', 'happy', 'sad',
  'angry', 'scared', 'afraid', 'tired', 'glad', 'sure', 'pretty', 'beautiful', 'interesting', 'important',
  'different', 'strange', 'weird', 'real', 'true', 'much', 'many', 'well', 'bright', 'dark', 'loud', 'quiet',
  'close', 'far', 'high', 'low', 'deep', 'strong', 'weak'
];

const ADVERB = /^RB[RS]?$/;
const ADJECTIVE = /^JJ[RS]?$/;
const VERB = /^VB[DGNPZ]?$/;
/** Emphasis marks the tagger gives tokens of their own. */
const MARKUP = /^[_*]+$/;
const LETTER = /\p{L}/u;
const FILLERS: ReadonlySet<string> = new Set(STYLE_FLAG_FILLER_WORDS);
const WEAK_VERBS: ReadonlySet<string> = new Set(STYLE_FLAG_WEAK_VERBS);
const GENERIC: ReadonlySet<string> = new Set(LIGHTBOX_STEERING_GENERIC_WORDS);
const TAG_VERBS: ReadonlySet<string> = new Set(LIGHTBOX_STEERING_TAG_VERBS);

export interface LightboxSteeringInput {
  /** The text as measured (the words the numbers tile counts over), and its paragraphs (index 0 is ¶1). */
  text: string;
  paragraphs: readonly string[];
  /** The tagger; the word-frequency tool's by default. A throw means it could not load. */
  tag?: (text: string) => TaggedToken[];
}

interface Classified {
  construction: LightboxSteeringConstruction;
  weakVerb?: boolean;
}

interface FigureTally {
  total: number;
  narration: number;
  dialogue: number;
  inShortRuns: number;
  weakVerbs: number;
  paragraphs: Set<number>;
  constructions: Map<LightboxSteeringConstruction, { count: number; paragraphs: Set<number> }>;
}

/** Every steering figure of the text, measured. */
export function measureLightboxSteering(input: LightboxSteeringInput): LightboxSteeringMeasure {
  const tag = input.tag ?? tagTextTokens;
  const words = countWords(input.text);
  const tallies = new Map<LightboxSteeringStatId, FigureTally>(LIGHTBOX_STEERING_STATS.map((stat) => [stat, emptyTally(stat)]));
  let tagged = true;
  input.paragraphs.forEach((paragraph, index) => {
    const found = LIGHTBOX_STEERING_STATS.map((stat) => ({ stat, matches: LIGHTBOX_NUMBER_PATTERNS[stat](paragraph) }));
    if (found.every(({ matches }) => matches.length === 0)) {
      return;
    }
    const dialogue = intervalReach(findDialogueSpans(paragraph));
    const runs = intervalReach(shortRunIntervals(paragraph));
    let tokens: TokenIndex | undefined;
    if (tagged) {
      try {
        // Curly apostrophes straightened, as the being-verb detector tags: "I’m" is then "I" and "'m".
        tokens = indexTokens(tag(withStraightApostrophes(paragraph)));
      } catch {
        tagged = false;
      }
    }
    for (const { stat, matches } of found) {
      const tally = tallies.get(stat) as FigureTally;
      for (const match of matches) {
        tally.total += 1;
        tally.paragraphs.add(index + 1);
        // Inside a dialogue span: one starting at or before the instance ends at or after the instance's end.
        tally[dialogue(match.start) >= match.end ? 'dialogue' : 'narration'] += 1;
        // In a run: one starting at or before the instance's start ends after it.
        tally.inShortRuns += runs(match.start) > match.start ? 1 : 0;
        const classified = tokens ? classify(stat, tokens, match.start) : { construction: 'other' as const };
        const row = tally.constructions.get(classified.construction);
        if (row) {
          row.count += 1;
          row.paragraphs.add(index + 1);
        }
        tally.weakVerbs += classified.weakVerb ? 1 : 0;
      }
    }
  });
  return {
    figures: LIGHTBOX_STEERING_STATS.map((stat) => figureOf(stat, tallies.get(stat) as FigureTally, words, tagged)),
    shortRun: { sentences: LIGHTBOX_STEERING_SHORT_RUN, maxWords: LIGHTBOX_STEERING_SHORT_SENTENCE_WORDS },
    tagged
  };
}

function emptyTally(stat: LightboxSteeringStatId): FigureTally {
  return {
    total: 0,
    narration: 0,
    dialogue: 0,
    inShortRuns: 0,
    weakVerbs: 0,
    paragraphs: new Set(),
    constructions: new Map(LIGHTBOX_STEERING_CONSTRUCTIONS[stat].map((construction) => [construction, { count: 0, paragraphs: new Set<number>() }]))
  };
}

function figureOf(stat: LightboxSteeringStatId, tally: FigureTally, words: number, tagged: boolean): LightboxSteeringFigure {
  // The numbers tile's own fraction, so the rate is its value exactly.
  const counts = emptyLightboxFigureCounts();
  counts.words = words;
  counts.patterns[stat] = tally.total;
  const sorted = (paragraphs: ReadonlySet<number>) => [...paragraphs].sort((a, b) => a - b);
  return {
    stat,
    total: tally.total,
    rate: lightboxFigureRate(lightboxFigureFraction(stat, counts)),
    narration: tally.narration,
    dialogue: tally.dialogue,
    constructions: tagged
      ? LIGHTBOX_STEERING_CONSTRUCTIONS[stat].map((construction) => {
        const row = tally.constructions.get(construction) as { count: number; paragraphs: Set<number> };
        return { construction, count: row.count, paragraphs: sorted(row.paragraphs) };
      })
      : [],
    ...(stat === 'adverbs' && tagged ? { weakVerbs: tally.weakVerbs } : {}),
    inShortRuns: tally.inShortRuns,
    paragraphs: sorted(tally.paragraphs)
  };
}

/**
 * The paragraph's runs of short sentences, one interval per run, from its
 * first sentence's start to its last one's end. Between two sentences of a
 * run lies only what the sentence rule set aside (spaces, end marks, a span
 * with no letter), where no instance of a figure starts.
 */
export function shortRunIntervals(paragraph: string): Array<{ start: number; end: number }> {
  const sentences = proseSentenceSpans(paragraph).filter(({ start, end }) => LETTER.test(paragraph.slice(start, end)));
  const runs: Array<{ start: number; end: number }> = [];
  let first = 0;
  let last = 0;
  let count = 0;
  const close = () => {
    if (count >= LIGHTBOX_STEERING_SHORT_RUN) {
      runs.push({ start: first, end: last });
    }
    count = 0;
  };
  for (const span of sentences) {
    if (countWords(paragraph.slice(span.start, span.end)) <= LIGHTBOX_STEERING_SHORT_SENTENCE_WORDS) {
      first = count === 0 ? span.start : first;
      last = span.end;
      count += 1;
    } else {
      close();
    }
  }
  close();
  return runs;
}

/**
 * For intervals in any order: at a position, the furthest end of any
 * interval starting at or before it (-Infinity when none does), by binary
 * search over the sorted starts and a running maximum of the ends. "Some
 * interval holds [a, b]" is `reach(a) >= b`, exactly what a scan finds.
 */
function intervalReach(intervals: ReadonlyArray<{ start: number; end: number }>): (at: number) => number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const starts = sorted.map((interval) => interval.start);
  const reach: number[] = [];
  sorted.forEach((interval, index) => {
    reach.push(Math.max(index > 0 ? reach[index - 1] : -Infinity, interval.end));
  });
  return (at) => {
    const index = lastAtOrBefore(starts, at);
    return index < 0 ? -Infinity : reach[index];
  };
}

/** The last index whose value is at most `at`, in ascending `values`; -1 when there is none. */
function lastAtOrBefore(values: readonly number[], at: number): number {
  let low = 0;
  let high = values.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** A paragraph's tokens, read once: where each placed one stands, and each token's neighbour by each rule. */
interface TokenIndex {
  tokens: readonly TaggedToken[];
  /** The tokens the tagger placed in the text, by index, in text order, with where each starts and ends. */
  placed: number[];
  starts: number[];
  ends: number[];
  /** Per token, its neighbour's index past markup (and adverbs or fillers); out of range when there is none. */
  next: Int32Array;
  previous: Int32Array;
  nextPastAdverbs: Int32Array;
  previousPastAdverbs: Int32Array;
  nextPastFillers: Int32Array;
}

function indexTokens(source: readonly TaggedToken[]): TokenIndex {
  // One read of each token; every later look is at this copy.
  const tokens = Array.from({ length: source.length }, (_, index) => source[index]);
  const placed: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  tokens.forEach((token, index) => {
    if (token.offset !== undefined) {
      placed.push(index);
      starts.push(token.offset);
      ends.push(token.offset + Math.max(1, token.value.length));
    }
  });
  const markup = tokens.map((token) => MARKUP.test(token.value));
  const adverb = tokens.map((token) => ADVERB.test(token.pos));
  const filler = tokens.map((token) => FILLERS.has(token.value.toLowerCase()));
  // The nearest token in direction `by` that is neither markup nor skipped, for every token, in one pass.
  const sweep = (by: 1 | -1, skip: (index: number) => boolean): Int32Array => {
    const out = new Int32Array(tokens.length);
    let nearest = by === 1 ? tokens.length : -1;
    for (let index = by === 1 ? tokens.length - 1 : 0; index >= 0 && index < tokens.length; index -= by) {
      out[index] = nearest;
      if (!markup[index] && !skip(index)) {
        nearest = index;
      }
    }
    return out;
  };
  return {
    tokens,
    placed,
    starts,
    ends,
    next: sweep(1, () => false),
    previous: sweep(-1, () => false),
    nextPastAdverbs: sweep(1, (index) => adverb[index]),
    previousPastAdverbs: sweep(-1, (index) => adverb[index]),
    nextPastFillers: sweep(1, (index) => filler[index])
  };
}

/** The token whose span holds `offset`, or -1. Placed tokens do not overlap, so at most one does. */
function tokenAt(index: TokenIndex, offset: number): number {
  const at = lastAtOrBefore(index.starts, offset);
  return at >= 0 && offset < index.ends[at] ? index.placed[at] : -1;
}

/** The construction of the instance starting at `offset`, by the tokens around it. */
function classify(stat: LightboxSteeringStatId, index: TokenIndex, offset: number): Classified {
  const at = tokenAt(index, offset);
  if (at < 0) {
    return { construction: 'other' };
  }
  const { tokens } = index;
  const lower = (token: TaggedToken | undefined) => (token?.value ?? '').toLowerCase();
  const isAdverb = (token: TaggedToken) => ADVERB.test(token.pos);
  const before = tokens[index.previous[at]];
  const after = tokens[index.next[at]];
  switch (stat) {
    case 'being-verbs': {
      if (before && (before.pos === 'EX' || lower(before) === 'it')) {
        return { construction: 'expletive' };
      }
      const head = tokens[index.nextPastAdverbs[at]];
      const pos = head?.pos ?? '';
      return { construction: pos === 'VBG' ? 'progressive' : pos === 'VBN' ? 'passive' : ADJECTIVE.test(pos) ? 'adjective' : 'other' };
    }
    case 'adverbs': {
      if (TAG_VERBS.has(lower(before)) || TAG_VERBS.has(lower(after))) {
        return { construction: 'dialogue-tag' };
      }
      if (after && ADJECTIVE.test(after.pos)) {
        return { construction: 'before-adjective' };
      }
      const verb = after && VERB.test(after.pos) ? after : tokens[index.previousPastAdverbs[at]];
      if (verb && VERB.test(verb.pos)) {
        return { construction: 'with-verb', weakVerb: WEAK_VERBS.has(lower(verb)) };
      }
      return { construction: after && isAdverb(after) ? 'before-adverb' : 'other' };
    }
    case 'intensifiers': {
      const head = tokens[index.nextPastFillers[at]];
      if (head && GENERIC.has(lower(head))) {
        return { construction: 'generic' };
      }
      return { construction: head && (ADJECTIVE.test(head.pos) || isAdverb(head)) ? 'before-modifier' : 'other' };
    }
  }
}
/* eslint-enable @typescript-eslint/naming-convention */
