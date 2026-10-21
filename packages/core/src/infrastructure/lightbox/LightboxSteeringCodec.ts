/**
 * Group G's block: craft steering (ADR 2026-10-19 D7 second addendum;
 * Slice 4F). Pure: no host, no I/O. Called by `LightboxReadingCodec` once
 * the block's friction is known; a throw here withholds the whole block.
 *
 * - **Figures.** 0–3, each one of `LIGHTBOX_STEERING_STATS` at most once,
 *   each exactly `{stat, claim, evidence, notes}`. A figure that breaks its
 *   shape is withheld whole, by its host label. A claim that breaks a text
 *   rule (`LightboxSteeringPhrasing`) withholds the figure's reading alone;
 *   its notes are read on their own.
 * - **Notes.** 0–`steeringNotes` per figure, each exactly `{para, quote,
 *   stance, why, nudge, example}`, withheld by its host title when it breaks
 *   a rule: the stance is earns, leans or compensates; the why and the
 *   nudge pass the text rules; a note that earns has `"nudge": null`, and
 *   one that leans or compensates names its nudge.
 * - **The one example** (epic decision 23, the writer's choice): `null`, or
 *   one `{before, after}`. A fault in it withholds the example alone, with
 *   a host reason, and the note stands: an example on a note that earns;
 *   more than one (a list: the first is read and the rest withheld); a
 *   `before` over its word bound; an `after` empty, over its bounds, the
 *   same as the `before`, or breaking a text rule. Whether the `before`
 *   stands in the checked quote and holds the instance is the chapter's
 *   question, answered at assembly (`LightboxSteeringTiles`).
 * Every object decodes with `strictObject`: a field the format does not
 * define is counted, never named, and every reason is host-owned.
 */

import type { LightboxSteeringExample, LightboxSteeringStance, LightboxSteeringStatId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';
import { LIGHTBOX_STEERING_STATS, isLightboxSteeringStat } from '@shared/constants/lightboxSteering';
import { countWords } from '@/utils/textUtils';
import { boundedArrayAt, objectAt, shapeError } from '@/application/services/workshop/persistedValidation';
import { evidence, paragraphNumber, strictObject, text } from '@/infrastructure/lightbox/LightboxReadingFields';
import type { LightboxMalformedItem } from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxSteeringTextFault } from '@/infrastructure/lightbox/LightboxSteeringPhrasing';
import {
  LIGHTBOX_STEERING_STANCES,
  lightboxSteeringNoteTitle,
  type LightboxDecodedSteeringBlock,
  type LightboxDecodedSteeringFigure,
  type LightboxDecodedSteeringNote
} from '@/infrastructure/lightbox/LightboxSteeringWire';

const B = PROMPT_BUDGETS.lightbox;

/** A note that broke one of steering's own rules: its message is the host's whole reason, shown as it is. */
class SteeringNoteRefusal extends Error {}

/** Why an example is not shown, in host words. */
export const LIGHTBOX_STEERING_EXAMPLE_REASONS = {
  earns: 'A note that earns its place shows no example, so this one is not shown.',
  more: 'A note shows one example; the reading gave more, and only the first is shown.',
  shape: 'Its example broke the format, so it is not shown.',
  beforeLong: `Its example's first part runs past ${B.steeringExampleBeforeWords} words or ${B.steeringExampleCharacters} characters: an example is a phrase, never a passage.`,
  afterLong: `Its example's second part runs past ${B.steeringExampleAfterWords} words or ${B.steeringExampleCharacters} characters: an example is a phrase, never a passage.`,
  same: 'Its example shows no change: its second part is its first again.',
  unanchored: 'Its example\'s first part is not a run of whole words of its checked quote holding the instance, so it is not shown.',
  unanchoredCarried: 'Its example\'s first part no longer stands in its checked quote holding the instance, so it is not shown.'
} as const;

export function decodeSteeringBlock(value: unknown, path: string, friction: string): LightboxDecodedSteeringBlock {
  const block = strictObject(value, path, ['figures', 'friction']);
  boundedArrayAt(block.figures, `${path}.figures`, 0, LIGHTBOX_STEERING_STATS.length, 'figures');
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
  const figure = strictObject(item, path, ['stat', 'claim', 'evidence', 'notes']);
  if (!isLightboxSteeringStat(figure.stat)) {
    shapeError(`${path}.stat`, 'one of the figures the task lists');
  }
  const stat = figure.stat;
  const label = LIGHTBOX_NUMBER_STAT_LABELS[stat];
  const claim = text(figure.claim, `${path}.claim`, B.claimCharacters);
  const quotes = evidence(figure.evidence, `${path}.evidence`, 1);
  boundedArrayAt(figure.notes, `${path}.notes`, 0, B.steeringNotes, 'notes');
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
  const note = strictObject(item, path, ['para', 'quote', 'stance', 'why', 'nudge', 'example']);
  const stance = note.stance;
  if (typeof stance !== 'string' || !LIGHTBOX_STEERING_STANCES.includes(stance as LightboxSteeringStance)) {
    shapeError(`${path}.stance`, 'earns, leans or compensates');
  }
  const why = text(note.why, `${path}.why`, B.steeringWhyCharacters);
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
  } else {
    if (note.nudge === null) {
      throw new SteeringNoteRefusal('It leans or compensates, so it names the craft move worth a look, and this one names none.');
    }
    nudge = text(note.nudge, `${path}.nudge`, B.steeringNudgeCharacters);
    const nudgeFault = lightboxSteeringTextFault(nudge, { instruction: true });
    if (nudgeFault) {
      throw new SteeringNoteRefusal(`Its nudge was withheld. ${nudgeFault}`);
    }
  }
  const example = decodeExample(note.example, `${path}.example`, earns);
  return {
    para: paragraphNumber(note.para, `${path}.para`),
    quote: text(note.quote, `${path}.quote`, B.quoteCharacters),
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
    pair = strictObject(value, path, ['before', 'after']);
  } catch {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.shape };
  }
  const nonblank = (field: unknown): field is string => typeof field === 'string' && field.trim().length > 0;
  if (!nonblank(pair.before) || !nonblank(pair.after)) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.shape };
  }
  const before = pair.before.trim();
  const after = pair.after.trim();
  if (countWords(before) > B.steeringExampleBeforeWords || before.length > B.steeringExampleCharacters) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.beforeLong };
  }
  if (countWords(after) > B.steeringExampleAfterWords || after.length > B.steeringExampleCharacters) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.afterLong };
  }
  if (sameWords(before, after)) {
    return { fault: LIGHTBOX_STEERING_EXAMPLE_REASONS.same };
  }
  const fault = lightboxSteeringTextFault(after, { instruction: false });
  return fault ? { fault: `Its example was withheld. ${fault}` } : { example: { before, after } };
}

/** The same words, case, spacing and apostrophes folded. */
function sameWords(a: string, b: string): boolean {
  const fold = (value: string) => value.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'").replace(/\s+/g, ' ').trim();
  return fold(a) === fold(b);
}
