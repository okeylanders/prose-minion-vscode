/**
 * Craft steering as the webview draws it (ADR 2026-10-19 D3, D7 second
 * addendum; Slice 4F). Pure: no React, no transport.
 *
 * Everything here selects and words what the host decided: each figure's
 * counts and breakdown are the host's measurement, and each reading and
 * note is a tile the host checked. The only arithmetic is presentation: a
 * construction's share of its figure, for the bar.
 *
 * - `lightboxSteeringSections`: one section per figure, with its measured
 *   counts and its reading (its notes are drawn by `LightboxSteeringNotes`).
 * - `lightboxSteeringItem`: a measured row (a figure, or one construction
 *   of it) as an inspector item that lights its paragraphs.
 * - `lightboxSteeringDetails`: a reading's or a note's inspector details,
 *   the example labelled as an illustration, never as a quote.
 */

import type {
  LightboxBoard,
  LightboxReadingTile,
  LightboxSteeringConstruction,
  LightboxSteeringFigure,
  LightboxSteeringReadingTile,
  LightboxSteeringStatId
} from '@messages';
import { LIGHTBOX_NUMBER_STAT_LABELS, formatLightboxFigure } from '@shared/constants/lightbox';
import {
  LIGHTBOX_STEERING_CONSTRUCTION_LABELS,
  LIGHTBOX_STEERING_CONSTRUCTIONS,
  LIGHTBOX_STEERING_EXAMPLE_LABEL,
  LIGHTBOX_STEERING_EXAMPLE_NOTE,
  LIGHTBOX_STEERING_NOUNS,
  LIGHTBOX_STEERING_STANCE_LABELS,
  LIGHTBOX_STEERING_STANCE_NOTES,
  LIGHTBOX_STEERING_STATS,
  LIGHTBOX_STEERING_VOICE_LABEL,
  isLightboxSteeringStat,
  lightboxSteeringFigure
} from '@shared/constants/lightboxSteering';
import { lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import type { LightboxResolvedItem } from '@hooks/domain/lightbox/lightboxItems';

/** A measured steering row: a whole figure, or one construction of it. */
export interface LightboxSteeringRef {
  kind: 'steering';
  stat: LightboxSteeringStatId;
  construction?: LightboxSteeringConstruction;
}

export interface LightboxSteeringBarSegment {
  construction: LightboxSteeringConstruction;
  label: string;
  count: number;
  /** Of the figure's instances, 0–100, unrounded (for widths). */
  share: number;
}

export interface LightboxSteeringSection {
  stat: LightboxSteeringStatId;
  label: string;
  /** The host's measurement. */
  figure?: LightboxSteeringFigure;
  /** "34 being verbs · 21.4 per 1,000 words" */
  headline: string;
  /** "28 in narration · 6 in dialogue" */
  split: string;
  segments: LightboxSteeringBarSegment[];
  /** "Weak verbs among them: 3" (adverbs with a verb), when there are any. */
  weakVerbs?: string;
  /** "7 in runs of short sentences (3 or more in a row, each 8 words or fewer)" */
  runs: string;
  reading?: LightboxSteeringReadingTile;
}

/** One section per steering figure, measured first, then what was read of it. */
export function lightboxSteeringSections(board: LightboxBoard): LightboxSteeringSection[] {
  const measure = board.measured.steering;
  const readings = lightboxTilesOfKind(board, 'steering-reading');
  return LIGHTBOX_STEERING_STATS.map((stat) => {
    const figure = lightboxSteeringFigure(measure.figures, stat);
    const total = figure?.total ?? 0;
    return {
      stat,
      label: LIGHTBOX_NUMBER_STAT_LABELS[stat],
      ...(figure ? { figure } : {}),
      headline: `${total.toLocaleString('en-US')} ${LIGHTBOX_STEERING_NOUNS[stat]} · ${formatLightboxFigure(figure?.rate ?? 0)} per 1,000 words`,
      split: `${(figure?.narration ?? 0).toLocaleString('en-US')} in narration · ${(figure?.dialogue ?? 0).toLocaleString('en-US')} in dialogue`,
      segments: (figure?.constructions ?? []).map((row) => ({
        construction: row.construction,
        label: LIGHTBOX_STEERING_CONSTRUCTION_LABELS[row.construction],
        count: row.count,
        share: total > 0 ? (row.count / total) * 100 : 0
      })),
      ...(figure?.weakVerbs ? { weakVerbs: `Weak verbs among them: ${figure.weakVerbs.toLocaleString('en-US')}` } : {}),
      runs: `${(figure?.inShortRuns ?? 0).toLocaleString('en-US')} in runs of short sentences` +
        ` (${measure.shortRun.sentences} or more in a row, each ${measure.shortRun.maxWords} words or fewer)`,
      ...(readings.find((tile) => tile.stat === stat) ? { reading: readings.find((tile) => tile.stat === stat) } : {})
    };
  });
}

/** The key a steering row is compared by. */
export function lightboxSteeringRefKey(ref: LightboxSteeringRef): string {
  return `steering:${ref.stat}:${ref.construction ?? ''}`;
}

/** A persisted steering row, or null when it is malformed. */
export function parseLightboxSteeringRef(record: Record<string, unknown>): LightboxSteeringRef | null {
  if (!isLightboxSteeringStat(record.stat)) {
    return null;
  }
  if (record.construction === undefined) {
    return { kind: 'steering', stat: record.stat };
  }
  const construction = LIGHTBOX_STEERING_CONSTRUCTIONS[record.stat].find((candidate) => candidate === record.construction);
  return construction ? { kind: 'steering', stat: record.stat, construction } : null;
}

/** A measured row as an inspector item, lighting the paragraphs that hold its instances. */
export function lightboxSteeringItem(board: LightboxBoard, ref: LightboxSteeringRef): LightboxResolvedItem | undefined {
  const figure = lightboxSteeringFigure(board.measured.steering.figures, ref.stat);
  if (!figure) {
    return undefined;
  }
  const label = LIGHTBOX_NUMBER_STAT_LABELS[ref.stat];
  const row = ref.construction ? figure.constructions.find((candidate) => candidate.construction === ref.construction) : undefined;
  if (ref.construction && !row) {
    return undefined;
  }
  const support = [
    `${figure.total.toLocaleString('en-US')} ${LIGHTBOX_STEERING_NOUNS[ref.stat]}`,
    `${formatLightboxFigure(figure.rate)} per 1,000 words`
  ];
  return row
    ? {
        ref,
        register: 'measured',
        where: 'Measure · Craft steering',
        title: `${label}: ${LIGHTBOX_STEERING_CONSTRUCTION_LABELS[row.construction]}`,
        claim: `${row.count.toLocaleString('en-US')} of the chapter's ${support[0]}, sorted by the words around each, lit here. ` +
          'Counted by code; nothing here is a reading.',
        paragraphs: [...row.paragraphs],
        support: [`${row.count.toLocaleString('en-US')} ${LIGHTBOX_STEERING_CONSTRUCTION_LABELS[row.construction]}`, ...support]
      }
    : {
        ref,
        register: 'measured',
        where: 'Measure · Craft steering',
        title: label,
        claim: `${support[0]}, ${support[1]}: ${figure.narration.toLocaleString('en-US')} in narration and ` +
          `${figure.dialogue.toLocaleString('en-US')} in dialogue, lit here. Counted by code, the same count as the numbers; nothing here is a reading.`,
        paragraphs: [...figure.paragraphs],
        support
      };
}

/** What the inspector says of a steering reading or note; undefined for any other kind. */
export function lightboxSteeringDetails(
  tile: LightboxReadingTile,
  board: LightboxBoard
): Array<{ label: string; value: string; measured?: string }> | undefined {
  if (tile.kind !== 'steering-reading' && tile.kind !== 'steering-note') {
    return undefined;
  }
  const figure = lightboxSteeringFigure(board.measured.steering.figures, tile.stat);
  const figureRow = {
    label: 'Figure',
    value: LIGHTBOX_NUMBER_STAT_LABELS[tile.stat],
    ...(figure ? { measured: `${figure.total.toLocaleString('en-US')} · ${formatLightboxFigure(figure.rate)} per 1,000` } : {})
  };
  const instances = { label: 'Instances', value: 'Each quote holds one, checked by the detector that counted the figure' };
  if (tile.kind === 'steering-reading') {
    return [figureRow, instances];
  }
  return [
    { label: 'Stance', value: `${LIGHTBOX_STEERING_STANCE_LABELS[tile.stance]}: ${LIGHTBOX_STEERING_STANCE_NOTES[tile.stance]}` },
    ...(tile.nudge ? [{ label: 'Worth a look', value: tile.nudge }] : []),
    ...(tile.example
      ? [{ label: LIGHTBOX_STEERING_EXAMPLE_LABEL, value: `${tile.example.before} → ${tile.example.after} (${LIGHTBOX_STEERING_EXAMPLE_NOTE})` }]
      : []),
    ...(tile.exampleWithheld ? [{ label: 'Example withheld', value: tile.exampleWithheld }] : []),
    ...(tile.voice ? [{ label: LIGHTBOX_STEERING_VOICE_LABEL, value: tile.voice }] : []),
    figureRow,
    instances
  ];
}
