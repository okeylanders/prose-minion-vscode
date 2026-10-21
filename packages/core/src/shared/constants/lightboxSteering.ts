/**
 * Craft steering's tables, shared by the host and the renderer (ADR
 * 2026-10-19 D7 second addendum; Slice 4F). Pure: no host, no I/O, no model.
 *
 * - **Ownership** (epic decision 20): the three figures craft steering
 *   reads, and the ones left to the numbers lens. The numbers tile keeps
 *   every figure's bar, range and standout flag either way.
 * - **Words**: the stances, the constructions, and the one example's label.
 * - **Count lines**: a figure's measured counts in host words, the same for
 *   the Opinion's digest (where they become citable figures, on purpose)
 *   and for Bring. They state no threshold or other host parameter, so they
 *   lend the Opinion no number that is not a count.
 */

/* eslint-disable @typescript-eslint/naming-convention -- keyed by kebab-case protocol ids. */

import type {
  LightboxNumberStatId,
  LightboxSteeringConstruction,
  LightboxSteeringFigure,
  LightboxSteeringStance,
  LightboxSteeringStatId
} from '@messages';
import { formatLightboxFigure } from '@shared/constants/lightbox';

/** The figures craft steering owns, in display order. */
export const LIGHTBOX_STEERING_STATS: readonly LightboxSteeringStatId[] = ['being-verbs', 'adverbs', 'intensifiers'];

export function isLightboxSteeringStat(value: unknown): value is LightboxSteeringStatId {
  return typeof value === 'string' && (LIGHTBOX_STEERING_STATS as readonly string[]).includes(value);
}

/** The figures the numbers lens still reads (Slice 4B, less craft steering's). */
export const LIGHTBOX_NUMBERS_READ_STATS: readonly LightboxNumberStatId[] = ['sentence-length', 'dialogue', 'passive-voice'];

/** What one instance of each figure is called, in the plural. */
export const LIGHTBOX_STEERING_NOUNS: Readonly<Record<LightboxSteeringStatId, string>> = {
  'being-verbs': 'being verbs',
  adverbs: '-ly words',
  intensifiers: 'intensifiers and fillers'
};

/** How an instance works where it stands: a reading of use, never a grade. */
export const LIGHTBOX_STEERING_STANCE_LABELS: Readonly<Record<LightboxSteeringStance, string>> = {
  earns: 'Earns',
  leans: 'Leans',
  compensates: 'Compensates'
};

/** What each stance means, in the board's words. */
export const LIGHTBOX_STEERING_STANCE_NOTES: Readonly<Record<LightboxSteeringStance, string>> = {
  earns: 'It does work the sentence needs.',
  leans: 'The sentence leans on it where another choice could carry the meaning.',
  compensates: 'It props up something thin: a plain word or a run of plain sentences.'
};

/** Each figure's constructions, in display order: a partition of its instances. */
export const LIGHTBOX_STEERING_CONSTRUCTIONS: Readonly<Record<LightboxSteeringStatId, readonly LightboxSteeringConstruction[]>> = {
  'being-verbs': ['adjective', 'progressive', 'passive', 'expletive', 'other'],
  adverbs: ['with-verb', 'dialogue-tag', 'before-adjective', 'before-adverb', 'other'],
  intensifiers: ['generic', 'before-modifier', 'other']
};

export const LIGHTBOX_STEERING_CONSTRUCTION_LABELS: Readonly<Record<LightboxSteeringConstruction, string>> = {
  adjective: 'be + adjective',
  progressive: 'be + -ing',
  passive: 'be + past participle',
  expletive: 'there or it + be',
  'with-verb': 'with a verb',
  'dialogue-tag': 'in a dialogue tag',
  'before-adjective': 'before an adjective',
  'before-adverb': 'before an adverb',
  generic: 'before a generic word',
  'before-modifier': 'before an adjective or adverb',
  other: 'other'
};

/** The one example a nudge may carry (epic decision 23): never a quote of the chapter. */
export const LIGHTBOX_STEERING_EXAMPLE_LABEL = 'One way it could go';
export const LIGHTBOX_STEERING_EXAMPLE_NOTE = 'an illustration, not your text';

/** "34 being verbs" */
function instances(figure: Pick<LightboxSteeringFigure, 'stat' | 'total'>): string {
  return `${figure.total.toLocaleString('en-US')} ${LIGHTBOX_STEERING_NOUNS[figure.stat]}`;
}

/**
 * A figure's constructions in host words ("be + adjective 4 · be + -ing 5"),
 * with the weak verbs among the adverbs' verbs; undefined when none was
 * measured (the tagger did not load).
 */
export function lightboxSteeringConstructionLine(figure: LightboxSteeringFigure): string | undefined {
  if (figure.constructions.length === 0) {
    return undefined;
  }
  return figure.constructions.map((row) => {
    const weak = row.construction === 'with-verb' && figure.weakVerbs !== undefined && figure.weakVerbs > 0
      ? ` (weak verbs ${figure.weakVerbs})`
      : '';
    return `${LIGHTBOX_STEERING_CONSTRUCTION_LABELS[row.construction]} ${row.count}${weak}`;
  }).join(' · ');
}

/**
 * A figure's measured counts in host words: total and rate, narration and
 * dialogue, the constructions (with the weak verbs among the adverbs' verbs)
 * and the instances in runs of short sentences. Every number is a count or
 * the figure's rate; none is a threshold.
 */
export function lightboxSteeringCountLines(figure: LightboxSteeringFigure): string[] {
  const constructions = lightboxSteeringConstructionLine(figure);
  return [
    `${instances(figure)}, ${formatLightboxFigure(figure.rate)} per 1,000 words: ` +
      `${figure.narration.toLocaleString('en-US')} in narration, ${figure.dialogue.toLocaleString('en-US')} in dialogue`,
    ...(constructions ? [`by construction, counted by code: ${constructions}`] : []),
    `in runs of short sentences: ${figure.inShortRuns.toLocaleString('en-US')}`
  ];
}

/** The figure a board measured for `stat`, if any. */
export function lightboxSteeringFigure(
  figures: readonly LightboxSteeringFigure[] | undefined,
  stat: LightboxSteeringStatId
): LightboxSteeringFigure | undefined {
  return figures?.find((figure) => figure.stat === stat);
}
/* eslint-enable @typescript-eslint/naming-convention */
