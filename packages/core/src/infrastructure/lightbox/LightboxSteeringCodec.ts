/**
 * Group G's block: craft steering (ADR 2026-10-19 D7 second addendum;
 * Slice 4F). Pure: no host, no I/O. Called by `LightboxReadingCodec` once
 * the block's friction is known; a throw here withholds the whole block.
 *
 * Counts and lengths the prompt states are asks (Slice 4H): more notes or
 * quotes than asked, and a longer claim, why, nudge or example, are read
 * and shown; Bring clips them to a Workshop tile.
 * - **Figures.** Each one of `LIGHTBOX_STEERING_STATS` at most once (a
 *   repeat is withheld by its label), each holding
 *   `{stat, claim, evidence, notes}`. A figure that breaks its
 *   shape is withheld whole, by its host label. A claim that breaks a text
 *   rule (`LightboxSteeringPhrasing`) withholds the figure's reading alone;
 *   its notes are read on their own.
 * - **Notes.** Any number per figure (the prompt asks for at most
 *   `steeringNotes`), each holding `{para, quote,
 *   stance, why, nudge, example}`, withheld by its host title when it breaks
 *   a rule: the stance is earns, leans or compensates; the why and the
 *   nudge pass the text rules; a note that earns has `"nudge": null`. One
 *   that leans or compensates names its nudge, or `null` for an instance in
 *   dialogue (epic decision 26): where the instance stands is the chapter's
 *   question, so a leaning note with no nudge in narration is withheld by
 *   the gate at assembly (`LightboxSteeringVoice`, `LightboxTileGates`).
 * - **The one example** (epic decision 23, the writer's choice): `null`, or
 *   one `{before, after}`. A fault in it withholds the example alone, with
 *   a host reason, and the note stands: an example on a note that earns;
 *   more than one (a list: the first is read and the rest withheld: one
 *   example is the writer's fence, epic decision 23, not an ask); an
 *   `after` empty, the same as the `before` (by the quote verifier's fold),
 *   or breaking a text rule. Its words and characters are asks: a longer
 *   part is shown. Whether the `before` stands in the checked quote and
 *   holds the instance is the chapter's question, answered at assembly
 *   (`LightboxSteeringTiles`), which holds the pair as the chapter has it to
 *   a change between its parts again (PR #160 F-02).
 * Every object decodes with `replyObject`: a field the format does not
 * define is ignored, counted and never named (Slice 4K, epic decision 50),
 * and every reason is host-owned.
 */

import type { LightboxSteeringExample, LightboxSteeringStance, LightboxSteeringStatId } from '@messages';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';
import { isLightboxSteeringStat } from '@shared/constants/lightboxSteering';
import { foldWithMap } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { objectAt, shapeError } from '@/application/services/workshop/persistedValidation';
import {
  evidence,
  listAt,
  paragraphNumber,
  replyObject,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import { LIGHTBOX_BLOCK_FIELDS } from '@/infrastructure/lightbox/LightboxBlockFormat';
import type { LightboxMalformedItem } from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxSteeringTextFault } from '@/infrastructure/lightbox/LightboxSteeringPhrasing';
import {
  LIGHTBOX_STEERING_STANCES,
  lightboxSteeringNoteTitle,
  type LightboxDecodedSteeringBlock,
  type LightboxDecodedSteeringFigure,
  type LightboxDecodedSteeringNote
} from '@/infrastructure/lightbox/LightboxSteeringWire';

/** A note that broke one of steering's own rules: its message is the host's whole reason, shown as it is. */
class SteeringNoteRefusal extends Error {}

/** Why an example is not shown, in host words. */
export const LIGHTBOX_STEERING_EXAMPLE_REASONS = {
  earns: 'A note that earns its place shows no example, so this one is not shown.',
  more: 'A note shows one example; the reading gave more, and only the first is shown.',
  shape: 'Its example broke the format, so it is not shown.',
  same: 'Its example shows no change: its second part is its first again.',
  unanchored: 'Its example\'s first part is not a run of whole words of its checked quote holding the instance, so it is not shown.',
  unanchoredCarried: 'Its example\'s first part no longer stands in its checked quote holding the instance, so it is not shown.',
  /** Dialogue is voice (epic decision 26): fresh and carried alike. */
  voice: 'Its example\'s first part holds an instance only in dialogue, the character\'s voice, so it is not shown.',
  /** A first part that holds narration but also takes in a character's words (PR #162 F-02): fresh and carried alike. */
  speech: 'Its example\'s first part takes in words a character speaks, the character\'s voice, so it is not shown.',
  /** The pair as the chapter has it, once anchored (PR #160 F-02): fresh and carried alike. */
  anchoredSame: 'Its example shows no change: as the chapter has it, its first part reads as its second.'
} as const;

/**
 * The pair's own contract: a change between its parts. Its words and
 * characters are asks (Slice 4H): a longer part is shown on the board, and
 * Bring clips the pair to one Workshop point. The text rules are the second
 * part's alone.
 */
export function lightboxSteeringExampleShowsNoChange(example: LightboxSteeringExample): boolean {
  return sameWords(example.before, example.after);
}

export function decodeSteeringBlock(value: unknown, path: string, friction: string): LightboxDecodedSteeringBlock {
  const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.steering);
  // At most one reading per figure: held by the figure, a repeat withheld by its label, never by the list's length.
  listAt(block.figures, `${path}.figures`, 0, 'figures');
  const figures: LightboxDecodedSteeringFigure[] = [];
  const malformed: LightboxMalformedItem[] = [];
  block.figures.forEach((item, index) => {
    const itemPath = `${path}.figures[${index}]`;
    const named = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>).stat : undefined;
    const title = isLightboxSteeringStat(named) ? LIGHTBOX_NUMBER_STAT_LABELS[named] : `Figure ${index + 1}`;
    try {
      const figure = decodeFigure(objectAt(item, itemPath), itemPath);
      if (figures.some((kept) => kept.stat === figure.stat)) {
        malformed.push({ title, reason: 'Another reading in this block already reads that figure.' });
        return;
      }
      figures.push(figure);
    } catch (error) {
      malformed.push({ title, reason: `It broke the format: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
  return { lens: 'steering', figures, malformed, friction };
}

function decodeFigure(item: Record<string, unknown>, path: string): LightboxDecodedSteeringFigure {
  const figure = replyObject(item, path, ['stat', 'claim', 'evidence', 'notes']);
  if (!isLightboxSteeringStat(figure.stat)) {
    shapeError(`${path}.stat`, 'one of the figures the task lists');
  }
  const stat = figure.stat;
  const label = LIGHTBOX_NUMBER_STAT_LABELS[stat];
  const claim = text(figure.claim, `${path}.claim`);
  const quotes = evidence(figure.evidence, `${path}.evidence`, 1);
  listAt(figure.notes, `${path}.notes`, 0, 'notes');
  const notes: LightboxDecodedSteeringNote[] = [];
  const malformedNotes: LightboxMalformedItem[] = [];
  figure.notes.forEach((note, index) => {
    const notePath = `${path}.notes[${index}]`;
    try {
      notes.push(decodeNote(objectAt(note, notePath), notePath, index + 1));
    } catch (error) {
      malformedNotes.push({
        title: lightboxSteeringNoteTitle(label, index + 1),
        reason: error instanceof SteeringNoteRefusal ? error.message : `It broke the format: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  const fault = lightboxSteeringTextFault(claim, { instruction: false });
  return {
    stat: stat as LightboxSteeringStatId,
    reading: fault ? { withheld: fault } : { claim, evidence: quotes },
    notes,
    malformedNotes
  };
}

function decodeNote(item: Record<string, unknown>, path: string, ordinal: number): LightboxDecodedSteeringNote {
  const note = replyObject(item, path, ['para', 'quote', 'stance', 'why', 'nudge', 'example']);
  const stance = note.stance;
  if (typeof stance !== 'string' || !LIGHTBOX_STEERING_STANCES.includes(stance as LightboxSteeringStance)) {
    shapeError(`${path}.stance`, 'earns, leans or compensates');
  }
  const why = text(note.why, `${path}.why`);
  const whyFault = lightboxSteeringTextFault(why, { instruction: true });
  if (whyFault) {
    throw new SteeringNoteRefusal(`Its why was withheld. ${whyFault}`);
  }
  const earns = stance === 'earns';
  let nudge: string | undefined;
  if (earns) {
    if (note.nudge !== null) {
      throw new SteeringNoteRefusal('It earns its place, so it names no nudge, and this one does.');
    }
  } else if (note.nudge !== null) {
    // A null nudge is the shape for an instance in dialogue (epic decision 26); in narration the gate withholds it.
    nudge = text(note.nudge, `${path}.nudge`);
    const nudgeFault = lightboxSteeringTextFault(nudge, { instruction: true });
    if (nudgeFault) {
      throw new SteeringNoteRefusal(`Its nudge was withheld. ${nudgeFault}`);
    }
  }
  const example = decodeExample(note.example, `${path}.example`, earns);
  return {
    para: paragraphNumber(note.para, `${path}.para`),
    quote: text(note.quote, `${path}.quote`),
    ordinal,
    stance: stance as LightboxSteeringStance,
    why,
    ...(nudge !== undefined ? { nudge } : {}),
    ...example
  };
}

/** The one example, or why none is shown; never a throw: a fault withholds the example, not the note. */
function decodeExample(
  value: unknown,
  path: string,
  earns: boolean
): Pick<LightboxDecodedSteeringNote, 'example' | 'exampleWithheld'> {
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    return {};
  }
  if (earns) {
    return { exampleWithheld: LIGHTBOX_STEERING_EXAMPLE_REASONS.earns };
  }
  const [first, ...rest] = Array.isArray(value) ? value : [value];
  const more = rest.length > 0 ? LIGHTBOX_STEERING_EXAMPLE_REASONS.more : undefined;
  const example = exampleOf(first, path);
  if ('fault' in example) {
    return { exampleWithheld: example.fault };
  }
  return { example: example.example, ...(more ? { exampleWithheld: more } : {}) };
}

function exampleOf(value: unknown, path: string): { example: LightboxSteeringExample } | { fault: string } {
  let pair: Record<string, unknown>;
  try {
    pair = replyObject(value, path, ['before', 'after']);
  } catch {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.shape };
  }
  const nonblank = (field: unknown): field is string => typeof field === 'string' && field.trim().length > 0;
  if (!nonblank(pair.before) || !nonblank(pair.after)) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.shape };
  }
  // Whole, however far past its ask: the first part is anchored in its note's checked quote, and both are checked
  // as written, fresh, on carry and at Bring (PR #165 F-01). Bring clips the pair to one Workshop point after.
  const before = pair.before.trim();
  const after = pair.after.trim();
  if (lightboxSteeringExampleShowsNoChange({ before, after })) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.same };
  }
  const fault = lightboxSteeringTextFault(after, { instruction: false });
  return fault ? { fault: `Its example was withheld. ${fault}` } : { example: { before, after } };
}

/**
 * The same words: equal under the quote verifier's own fold (compatibility
 * forms, quotation marks and apostrophes, dashes, spacing), case folded too,
 * so a pair the verifier would read as one text is no change (PR #160 F-02:
 * "was-quiet" against "was—quiet").
 */
function sameWords(a: string, b: string): boolean {
  const fold = (value: string) => foldWithMap(value.trim()).folded.toLocaleLowerCase('en-US');
  return fold(a) === fold(b);
}
