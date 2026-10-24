/**
 * Keep, lens by lens, until replaced (Slice 4J, epic decision 49): the words
 * and the rules shared by the host, which decides what a call replaces, and
 * the renderer, which says so. Pure.
 *
 * - **A lens's reading** is its tiles on the board. A lens with none (never
 *   read, withheld, or empty) has no reading to keep.
 * - **Provenance** records, per lens, the run, model and time that produced
 *   what is on screen; a board read before Slice 4J has none, and its
 *   readings fall back to the group's model (`lightboxLensModel`).
 * - **The models that read a board** are those of the readings on it, not
 *   of every call its groups made (`lightboxBoardModels`).
 * - **The copy** says calmly that a reading on screen is the earlier one, and
 *   why the latest call did not replace it. The reason is always the host's.
 */

import type { LightboxLensId, LightboxLensProvenance, LightboxReadingGroup } from '@messages';
import { LIGHTBOX_LENSES, lightboxLensLabel } from '@shared/constants/lightbox';

/** The quiet label on a reading the latest call did not replace. */
export const LIGHTBOX_EARLIER_LABEL = 'Earlier reading';

/** What a frame says beside a reading kept while its call reads it again, and after one that did not replace it. */
export interface LightboxKeepWords {
  /** While the call in flight reads it again. */
  reading: string;
  /** After the latest call did not replace it, before the host's reason. */
  kept: string;
}

/** Every reading's words; the Opinion keeps its own (decision 47). */
export const LIGHTBOX_KEEP_WORDS: LightboxKeepWords = {
  reading: 'Analyzing… This is the earlier reading until the new one lands.',
  kept: 'The re-analysis did not replace it.'
};

/** The host's reasons a call that came back did not replace a lens's reading (the other reasons are the call's own). */
export const LIGHTBOX_KEEP_REASONS = {
  /** The block decoded, but every claim in it was withheld. */
  noTile: (withheld: number): string => withheld === 1
    ? 'The new reading drew no tile: its one claim was withheld.'
    : `The new reading drew no tile: its ${withheld.toLocaleString('en-US')} claims were withheld.`,
  /** The block decoded with nothing in it. */
  empty: 'The new reading came back with nothing to draw.',
  /** A lens kept because the lens it is read with was kept (template and summary, Slice 4C). */
  together: (partner: LightboxLensId): string =>
    `${lightboxLensLabel(partner)} was not replaced, and the two are kept together, since engagement sits on the movements.`
} as const;

/**
 * Lenses decided as one (Slice 4C): engagement, in the template block, sits
 * on the movements the summary block draws in the same reply, so one is
 * never replaced while the other keeps an earlier reading.
 */
export const LIGHTBOX_KEPT_TOGETHER: ReadonlyArray<readonly LightboxLensId[]> = [['template', 'summary']];

/** Whether the group holds a reading of `lens`: at least one of its tiles. */
export function lightboxLensHasReading(group: Pick<LightboxReadingGroup, 'tiles'> | undefined, lens: LightboxLensId): boolean {
  return group?.tiles.some((tile) => tile.lens === lens) ?? false;
}

/** The lens's provenance on the board, when the run that produced it recorded one. */
export function lightboxLensProvenance(
  group: Pick<LightboxReadingGroup, 'provenance'> | undefined,
  lens: LightboxLensId
): LightboxLensProvenance | undefined {
  return group?.provenance?.find((entry) => entry.lens === lens);
}

/** The model that produced the lens's reading on screen: its provenance's, or (a board read before Slice 4J) its group's. */
export function lightboxLensModel(
  group: Pick<LightboxReadingGroup, 'model' | 'provenance'> | undefined,
  lens: LightboxLensId
): string | undefined {
  const provenance = lightboxLensProvenance(group, lens);
  return provenance ? provenance.model : group?.model;
}

/** Why the lens's reading on screen is an earlier one, when it is. */
export function lightboxEarlierReason(
  group: Pick<LightboxReadingGroup, 'earlierLenses' | 'tiles'> | undefined,
  lens: LightboxLensId
): string | undefined {
  return lightboxLensHasReading(group, lens) ? group?.earlierLenses?.find((mark) => mark.lens === lens)?.reason : undefined;
}

/**
 * Whether the group shows a reading of `lens` that a call produced: its
 * tiles, or the empty answer its friction says (the lenses a saved board's
 * row lists as read).
 */
export function lightboxLensWasRead(group: Pick<LightboxReadingGroup, 'lenses' | 'tiles' | 'frictions'>, lens: LightboxLensId): boolean {
  return group.lenses.includes(lens)
    && (group.tiles.some((tile) => tile.lens === lens) || group.frictions.some((friction) => friction.lens === lens));
}

/**
 * The models of the readings on the board, once each, in rail order: for
 * each lens read, the model that produced what is on screen. A call whose
 * reading replaced nothing (it failed, was stopped, or every lens of it kept
 * its earlier reading) is not named, since nothing of it is on screen.
 */
export function lightboxBoardModels(readings: readonly LightboxReadingGroup[]): string[] {
  const models = new Set<string>();
  for (const { id: lens } of LIGHTBOX_LENSES) {
    for (const group of readings) {
      const model = lightboxLensWasRead(group, lens) ? lightboxLensModel(group, lens) : undefined;
      if (model) {
        models.add(model);
      }
    }
  }
  return [...models];
}

/** How many lenses on the board show an earlier reading. */
export function lightboxEarlierLensCount(readings: readonly LightboxReadingGroup[]): number {
  return readings.reduce((sum, group) => sum + (group.earlierLenses?.filter((mark) => lightboxLensHasReading(group, mark.lens)).length ?? 0), 0);
}
