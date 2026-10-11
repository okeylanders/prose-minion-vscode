/**
 * Shared narrative-handling vocabulary (Sprint 05, Slice 0 kickoff decision).
 *
 * Two surfaces speak about how a beat is handled on the page: Sprint 05's
 * five-position local continuum for one beat, and Prose Controller's
 * three-value show:tell lever. They share these words and never state. This
 * module is named after the shared concept, not after either widget, and owns
 * exactly three facts: the five position ids, the three Controller values with
 * their display labels, and the total position → value mapping.
 *
 * Position names, subtitles, tradeoff lines, and the readout table are not
 * shared. Each surface teaches the lever in its own words, so that copy stays
 * feature-owned. Prose Controller imports the values and mapping from here and
 * must not redeclare them.
 */

/** The five local continuum positions, in their fixed telling → showing order. */
export const NARRATIVE_HANDLING_POSITIONS = Object.freeze([
  'state-it',
  'summarize',
  'hinge',
  'evidence',
  'inhabit'
] as const);

export type NarrativeHandlingPosition = typeof NARRATIVE_HANDLING_POSITIONS[number];

/** Prose Controller's show:tell lever values. */
export const NARRATIVE_HANDLING_SHOW_TELL_VALUES = Object.freeze([
  'summary-allowed',
  'mixed',
  'scene-only'
] as const);

export type NarrativeHandlingShowTellValue = typeof NARRATIVE_HANDLING_SHOW_TELL_VALUES[number];

/* eslint-disable @typescript-eslint/naming-convention -- vocabulary ids are persisted protocol literals. */
export const NARRATIVE_HANDLING_SHOW_TELL_LABELS: Readonly<
  Record<NarrativeHandlingShowTellValue, string>
> = Object.freeze({
  'summary-allowed': 'summary allowed',
  mixed: 'mixed',
  'scene-only': 'scene only'
});

/**
 * Five local positions map onto three Controller values, never the reverse:
 * a Controller value names a range of handling, not one position. The record
 * type keeps the mapping total at compile time; a test pins every value.
 */
export const NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION: Readonly<
  Record<NarrativeHandlingPosition, NarrativeHandlingShowTellValue>
> = Object.freeze({
  'state-it': 'summary-allowed',
  summarize: 'summary-allowed',
  hinge: 'mixed',
  evidence: 'scene-only',
  inhabit: 'scene-only'
});
/* eslint-enable @typescript-eslint/naming-convention */
