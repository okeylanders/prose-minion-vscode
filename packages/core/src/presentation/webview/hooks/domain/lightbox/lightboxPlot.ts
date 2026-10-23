/**
 * Group E's tiles and lanes as the webview draws them (ADR 2026-10-19 D3,
 * D4, D7; Slice 4C). Pure: no React, no transport.
 *
 * Everything here selects and words what the host decided. Positions come
 * from the tiles' host fields (a movement's range, a thread's quotes and
 * span) and the board's measured sections, mapped onto the current ribbon,
 * so a lane always follows content. The counts and the freshness basis are
 * the shared joins (`@shared/constants/lightboxPlot`), which the host's
 * Bring uses too.
 */

import type {
  LightboxBoard,
  LightboxEngagementLevel,
  LightboxLensId,
  LightboxMovementTile,
  LightboxPressureThreadTile,
  LightboxReadingTile,
  LightboxRibbonColumn,
  LightboxSectionsMeasure,
  LightboxTemplateTile
} from '@messages';
import {
  LIGHTBOX_ENGAGEMENT_LABELS,
  LIGHTBOX_FRESHNESS_LABEL,
  LIGHTBOX_FRESHNESS_LABELS,
  LIGHTBOX_TEMPLATE_STANCE_LABELS,
  LIGHTBOX_UNUSED_REACH,
  lightboxColumnMovements,
  lightboxFreshnessBasis,
  lightboxMovementEngagement,
  lightboxMovementNumeral,
  lightboxPressureLane,
  type LightboxFreshnessBasis
} from '@shared/constants/lightboxPlot';
import { lightboxLensView, lightboxTilesOfKind, pluralize } from '@hooks/domain/lightbox/lightboxReadings';

/** A run of ribbon columns one band covers: 0-based, inclusive. */
export interface LightboxBand<T> {
  start: number;
  end: number;
  value: T;
}

/** Consecutive columns holding the same value become one band; columns holding none, none. */
export function lightboxBands<T>(values: ReadonlyArray<T | undefined>, same: (a: T, b: T) => boolean): Array<LightboxBand<T>> {
  const bands: Array<LightboxBand<T>> = [];
  values.forEach((value, index) => {
    const last = bands[bands.length - 1];
    if (value === undefined) {
      return;
    }
    if (last && last.end === index - 1 && same(last.value, value)) {
      last.end = index;
    } else {
      bands.push({ start: index, end: index, value });
    }
  });
  return bands;
}

// ---------------------------------------------------------------------------
// Sections (measured)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/naming-convention -- signals are kebab-case protocol literals. */
const SIGNAL_NOUNS = {
  headings: ['heading', 'headings'],
  'scene-breaks': ['scene break', 'scene breaks'],
  'chapter-lines': ['chapter line', 'chapter lines']
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

/** What the Sections lane says about itself: which signal divides the chapter, or what fired and why it does not. */
export function lightboxSectionsNote(sections: LightboxSectionsMeasure): string {
  const count = sections.sections.length;
  switch (sections.signal) {
    case 'headings':
      return `${count} sections from headings (level ${sections.level ?? 1} and above), found by code.`;
    case 'scene-breaks':
      return `${count} scenes from scene-break lines, found by code.`;
    case 'chapter-lines':
      return `${count} sections from chapter lines, found by code.`;
    case 'none': {
      const fired = (Object.keys(SIGNAL_NOUNS) as Array<keyof typeof SIGNAL_NOUNS>)
        .filter((signal) => sections.fired[signal].length > 0)
        .map((signal) => {
          const at = sections.fired[signal];
          const [one, many] = SIGNAL_NOUNS[signal];
          return `${at.length === 1 ? `one ${one}` : `${at.length} ${many}`} (${at.slice(0, 4).map((index) => `¶${index}`).join(', ')})`;
        });
      return fired.length === 0
        ? 'No headings, scene breaks or chapter lines found, so the ribbon stays in paragraphs.'
        : `Found ${fired.join(' and ')}, which does not divide the chapter into two or more sections, so the ribbon stays in paragraphs.`;
    }
  }
}

/** Each column's section (1-based index), by the section holding its first paragraph. */
export function lightboxSectionBands(board: LightboxBoard): Array<LightboxBand<number>> {
  const { sections } = board.measured.sections;
  return lightboxBands(
    board.ribbon.map((column) => {
      const index = sections.findIndex((section) => section.from <= column.from && column.from <= section.to);
      return index >= 0 ? index + 1 : undefined;
    }),
    (a, b) => a === b
  );
}

// ---------------------------------------------------------------------------
// Movements and engagement (read)
// ---------------------------------------------------------------------------

/** What a read lane shows and says: its bands, whether it is stale, and its own note. */
export interface LightboxReadLane<T> {
  bands: Array<LightboxBand<T>>;
  stale: boolean;
  note: string;
}

function lensNote(board: LightboxBoard, lens: LightboxLensId, label: string, lensOn: boolean): string | undefined {
  if (!lensOn) {
    return `The ${label} lens is off.`;
  }
  const view = lightboxLensView(board, lens);
  switch (view.phase) {
    case 'reading':
      return `Reading ${label.toLowerCase()}…`;
    case 'failed':
    case 'cancelled':
      return `${label} did not come back.`;
    case 'not-run':
      return `${label} is a reading. Not analyzed yet.`;
    case 'ok':
      return undefined;
  }
}

/** The Movements lane: each movement over the columns whose first paragraph it holds. */
export function lightboxMovementsLane(board: LightboxBoard, lensOn: boolean): LightboxReadLane<LightboxMovementTile> {
  const view = lightboxLensView(board, 'summary');
  const pending = lensNote(board, 'summary', 'Summary & movements', lensOn);
  const movements = lightboxTilesOfKind(board, 'movement');
  if (pending || movements.length === 0) {
    // A withheld block (a format fault, or a reply cut off at the output ceiling, Slice 4H) is not a tiling fault: its frame says why.
    const absent = view.withheldBlocks.length > 0
      ? 'The movements were withheld: Summary & movements says why.'
      : 'The movements were withheld: they did not tile the chapter.';
    return { bands: [], stale: view.stale, note: pending ?? absent };
  }
  const bands = lightboxBands(lightboxColumnMovements(movements, board.ribbon), (a, b) => a.id === b.id);
  return {
    bands,
    stale: view.stale,
    note: view.stale
      ? 'Read against an earlier version of this chapter: each movement starts where its boundary quote now stands.'
      : 'Movements are a reading, drawn hatched. Code checked each boundary quote and that they tile the chapter.'
  };
}

/** The Engagement lane: each movement's read level, apart from tension. */
export function lightboxEngagementLane(
  board: LightboxBoard,
  lensesOff: readonly LightboxLensId[]
): LightboxReadLane<{ movement: LightboxMovementTile; level: LightboxEngagementLevel | null }> {
  const pending = lensNote(board, 'template', 'Template & freshness', !lensesOff.includes('template'));
  const [template] = lightboxTilesOfKind(board, 'template');
  const stale = lightboxLensView(board, 'template').stale;
  if (pending) {
    return { bands: [], stale, note: pending };
  }
  if (lensesOff.includes('summary')) {
    return { bands: [], stale, note: 'Engagement sits on the movements: turn on Summary & movements to read it.' };
  }
  const movements = lightboxTilesOfKind(board, 'movement');
  if (!template || template.engagement.length === 0 || movements.length === 0) {
    return { bands: [], stale, note: 'No engagement on the board: it was withheld, or there are no movements to sit on.' };
  }
  const bands = lightboxBands(lightboxColumnMovements(movements, board.ribbon), (a, b) => a.id === b.id)
    .map((band) => ({ ...band, value: { movement: band.value, level: lightboxMovementEngagement(template, band.value.id) ?? null } }));
  return {
    bands,
    stale,
    note: 'Engagement is a reading of pull per movement, drawn hatched; it is not the tension score.'
  };
}

// ---------------------------------------------------------------------------
// Pressure (counted from read threads)
// ---------------------------------------------------------------------------

export interface LightboxPressureLaneView {
  /** Open threads across each column, counted by code; absent before threads land. */
  counts?: number[];
  stale: boolean;
  note: string;
}

export function lightboxPressureLaneView(board: LightboxBoard, lensOn: boolean): LightboxPressureLaneView {
  const view = lightboxLensView(board, 'pressure');
  const pending = lensNote(board, 'pressure', 'Pressure', lensOn);
  if (pending) {
    return { stale: view.stale, note: pending };
  }
  const threads = lightboxTilesOfKind(board, 'pressure-thread');
  return {
    counts: lightboxPressureLane(threads, board.ribbon),
    stale: view.stale,
    note: view.stale
      ? 'Read against an earlier version of this chapter: the threads\' quotes were found again, and the lane counts where they now stand.'
      : 'Open threads per paragraph, counted by code from the threads read.'
  };
}

/** One thread across the ribbon: where it is planted, builds, resolves, runs open, or stays open at the end. */
export type LightboxThreadCell = 'plant' | 'esc' | 'res' | 'run' | 'open' | 'none';

export function lightboxThreadTrack(
  thread: LightboxPressureThreadTile,
  ribbon: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]
): LightboxThreadCell[] {
  const holds = (column: Pick<LightboxRibbonColumn, 'from' | 'to'>, paragraph: number) => column.from <= paragraph && paragraph <= column.to;
  return ribbon.map((column, index): LightboxThreadCell => {
    if (holds(column, thread.planted.paragraph)) {
      return 'plant';
    }
    if (thread.resolution && holds(column, thread.resolution.paragraph)) {
      return 'res';
    }
    if (thread.escalations.some((quote) => holds(column, quote.paragraph))) {
      return 'esc';
    }
    if (column.from > thread.span.from && column.to <= thread.span.to) {
      return !thread.resolution && index === ribbon.length - 1 ? 'open' : 'run';
    }
    return 'none';
  });
}

/** "¶4 → still open", "¶7 → resolved ¶7", "¶5 · dormant, never touched again". */
export function lightboxThreadMeta(thread: LightboxPressureThreadTile): string {
  if (thread.dormant) {
    return `¶${thread.planted.paragraph} · dormant, never touched again`;
  }
  const builds = thread.escalations.length > 0 ? ` · builds ${thread.escalations.map((quote) => `¶${quote.paragraph}`).join(', ')}` : '';
  return `¶${thread.planted.paragraph}${builds} → ${thread.resolution ? `resolved ¶${thread.resolution.paragraph}` : 'still open'}`;
}

// ---------------------------------------------------------------------------
// The template's parts
// ---------------------------------------------------------------------------

export interface LightboxEngagementRow {
  movement: LightboxMovementTile;
  numeral: string;
  level: LightboxEngagementLevel;
}

/** The template's engagement, by movement in order, with the board's numerals. */
export function lightboxEngagementRows(board: LightboxBoard, template: LightboxTemplateTile): LightboxEngagementRow[] {
  return lightboxTilesOfKind(board, 'movement').flatMap((movement) => {
    const level = lightboxMovementEngagement(template, movement.id);
    return level ? [{ movement, numeral: lightboxMovementNumeral(movement.ordinal), level }] : [];
  });
}

/** Why the template shows no engagement, when it shows none. */
export function lightboxEngagementAbsence(board: LightboxBoard, lensesOff: readonly LightboxLensId[]): string {
  if (lensesOff.includes('summary')) {
    return 'Engagement needs the movements: turn on Summary & movements, and it is read with them.';
  }
  return lightboxTilesOfKind(board, 'movement').length === 0
    ? 'Engagement sits on the movements, and none are on the board.'
    : 'No engagement was drawn: the reading did not give one level for each movement.';
}

/** The freshness basis, from the board (the shared host join). */
export function lightboxBasisOf(board: LightboxBoard): LightboxFreshnessBasis {
  return lightboxFreshnessBasis(board.readings);
}

// ---------------------------------------------------------------------------
// Inspector details
// ---------------------------------------------------------------------------

export interface LightboxPlotDetail {
  label: string;
  value: string;
  measured?: string;
}

/** A group E reading's fields and checks, for the inspector; undefined for any other kind. */
export function lightboxPlotDetails(tile: LightboxReadingTile, board: LightboxBoard): LightboxPlotDetail[] | undefined {
  switch (tile.kind) {
    case 'template': {
      const basis = lightboxBasisOf(board);
      const engagement = lightboxEngagementRows(board, tile);
      return [
        { label: 'Freshness', value: `${LIGHTBOX_FRESHNESS_LABELS[tile.freshness.level]} · ${LIGHTBOX_FRESHNESS_LABEL.toLowerCase()}. ${tile.freshness.note}` },
        basis.status === 'current'
          ? { label: 'Basis', value: 'Joined by code from Stock & signature and this template’s beats', measured: basis.line }
          : { label: 'Basis', value: basis.line },
        {
          label: 'Engagement',
          value: engagement.length > 0
            ? `${engagement.map((row) => `${row.numeral} ${LIGHTBOX_ENGAGEMENT_LABELS[row.level].toLowerCase()}`).join(' · ')}: a reading of pull, not tension`
            : 'None on the board'
        }
      ];
    }
    case 'template-beat':
      return [{ label: 'Stance', value: LIGHTBOX_TEMPLATE_STANCE_LABELS[tile.stance] }];
    case 'pressure-thread':
      return [
        { label: 'Planted', value: `¶${tile.planted.paragraph}` },
        ...(tile.escalations.length > 0 ? [{ label: 'Builds', value: tile.escalations.map((quote) => `¶${quote.paragraph}`).join(', ') }] : []),
        { label: 'Ends', value: tile.resolution ? `Resolved in ¶${tile.resolution.paragraph}` : 'Still open: carried out of the chapter' },
        ...(tile.dormant ? [{ label: 'Dormant', value: 'Planted once and never touched again; code checked it has no later quote' }] : []),
        { label: 'Span', value: 'Counted by code from where its quotes stand', measured: `¶${tile.span.from}–¶${tile.span.to}` },
        { label: 'Order', value: 'Planted, builds and resolution stand in paragraph order, checked by code' }
      ];
    case 'artifact':
      return [
        { label: 'Terms', value: tile.support.map((term) => term.term).join(', ') },
        { label: 'Mentions', value: 'Counted by code, each mention once', measured: `×${tile.mentions} · first ¶${tile.firstParagraph}` },
        { label: 'Arc', value: tile.arc.length > 0 ? tile.claim : 'No step stands' },
        ...(tile.plantedUnused
          ? [{ label: 'Planted, unused', value: `Every mention and step within ${LIGHTBOX_UNUSED_REACH} ¶ of its first, checked by code` }]
          : tile.unusedWithheld ? [{ label: 'Planted, unused', value: tile.unusedWithheld }] : [])
      ];
    case 'synopsis':
      return [{ label: 'Quotes', value: `${pluralize(tile.evidence.length, 'quote')} found; a synopsis needs two` }];
    case 'movement': {
      const [template] = lightboxTilesOfKind(board, 'template');
      const level = lightboxMovementEngagement(template, tile.id);
      const count = lightboxTilesOfKind(board, 'movement').length;
      return [
        { label: 'Range', value: `Movement ${lightboxMovementNumeral(tile.ordinal)} of ${count}`, measured: `¶${tile.from}–¶${tile.to}` },
        { label: 'Boundary', value: `Found in ¶${tile.boundary.paragraph}, its first paragraph, by code` },
        { label: 'The set', value: `Contiguous, no overlap, ¶1 to ¶${board.paragraphs.length}, checked by code` },
        { label: 'Engagement', value: level ? `${LIGHTBOX_ENGAGEMENT_LABELS[level]}: a reading of pull, not tension` : 'None drawn' }
      ];
    }
    default:
      return undefined;
  }
}
