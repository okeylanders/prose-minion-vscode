/**
 * Group E's shared tables and joins (ADR 2026-10-19 D3, D4, D7 and its
 * 2026-10-20 addendum; Slice 4C). Pure: no host, no I/O. Shared by the
 * host (Bring to Workshop) and the renderer (the tiles and lanes), so both
 * say the same thing from the same board.
 *
 * Nothing here comes from a model's numbers. Every figure is counted from
 * tiles the host drew, and every position comes from where the host found a
 * quote on the current text, so a lane follows content, never an old column:
 * - **The freshness basis** joins group D's tier counts (its signature beats
 *   of the beats it classified and found) with group E's template beats (how
 *   many subvert, of those found). It is shown only when both halves are on
 *   the board and current; otherwise it says which half is missing, stale or
 *   being read again. It is never sent to a model.
 * - **Pressure** counts the drawn threads (resolved, carried out, dormant)
 *   and, per ribbon column, how many are open across it, from each thread's
 *   host span.
 * - **Movements and engagement** per column: the movement holding a column's
 *   first paragraph, by the movements' current ranges, and its engagement
 *   mark when the template drew one for it.
 */

import type {
  LightboxArtifactTile,
  LightboxEngagementLevel,
  LightboxFreshnessLevel,
  LightboxLensId,
  LightboxMovementTile,
  LightboxPressureThreadTile,
  LightboxReadingGroup,
  LightboxReadingTile,
  LightboxRibbonColumn,
  LightboxTemplateStance,
  LightboxTemplateTile
} from '@messages';

/** How a template beat stands, as the board names it. */
export const LIGHTBOX_TEMPLATE_STANCE_LABELS: Readonly<Record<LightboxTemplateStance, string>> = {
  aligns: 'Aligns',
  subverts: 'Subverts',
  departs: 'Departs'
};

/** The freshness scale, in display order. */
export const LIGHTBOX_FRESHNESS_LEVELS: readonly LightboxFreshnessLevel[] = ['familiar', 'mixed', 'fresh'];

export const LIGHTBOX_FRESHNESS_LABELS: Readonly<Record<LightboxFreshnessLevel, string>> = {
  familiar: 'Familiar',
  mixed: 'Mixed',
  fresh: 'Fresh'
};

/** What the freshness reading always says beside it (ADR D7 addendum). */
export const LIGHTBOX_FRESHNESS_LABEL = 'A reading, not a grade';

export const LIGHTBOX_ENGAGEMENT_LEVELS: readonly LightboxEngagementLevel[] = ['low', 'medium', 'high'];

export const LIGHTBOX_ENGAGEMENT_LABELS: Readonly<Record<LightboxEngagementLevel, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

/**
 * "Planted, unused": a reading's flag is kept only when every mention of the
 * object, and every step of its arc, stands within this many paragraphs
 * after its first.
 */
export const LIGHTBOX_UNUSED_REACH = 2;

const NUMERALS: ReadonlyArray<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** A movement's place as the board numbers it: I, II, III … (host-made, never the reading's own label). */
export function lightboxMovementNumeral(ordinal: number): string {
  let rest = Math.max(1, Math.floor(ordinal));
  let numeral = '';
  for (const [value, letters] of NUMERALS) {
    while (rest >= value) {
      numeral += letters;
      rest -= value;
    }
  }
  return numeral;
}

/** Every tile of one kind across the groups, in group order. */
function tilesOfKind<K extends LightboxReadingTile['kind']>(
  readings: readonly LightboxReadingGroup[],
  kind: K
): Array<Extract<LightboxReadingTile, { kind: K }>> {
  return readings.flatMap((group) =>
    group.tiles.filter((tile): tile is Extract<LightboxReadingTile, { kind: K }> => tile.kind === kind));
}

/** Whether a lens's readings on the board are read against an earlier text, or being read again now. */
function lensState(readings: readonly LightboxReadingGroup[], lens: LightboxLensId): 'current' | 'stale' | 'reading' {
  for (const group of readings) {
    if (group.status === 'running' && group.pending?.includes(lens)) {
      return 'reading';
    }
    if (group.staleLenses?.some((mark) => mark.lens === lens)) {
      return 'stale';
    }
  }
  return 'current';
}

// ---------------------------------------------------------------------------
// The freshness basis
// ---------------------------------------------------------------------------

export type LightboxFreshnessBasis =
  | {
      status: 'current';
      /** Group D's found beats tiered signature, of those it classified and found. */
      signature: number;
      classified: number;
      /** Whole percent of `classified`. */
      percent: number;
      /** Group E's found template beats that subvert, of all found. */
      subverted: number;
      beats: number;
      line: string;
    }
  /** `missing`: a half is not on the board; `stale`: a half was read against an earlier text; `reading`: a half is being read again. */
  | { status: 'missing' | 'stale' | 'reading'; line: string };

export const LIGHTBOX_BASIS_LINES = {
  missingBoth: 'Read Stock & signature and Template & freshness to count the basis.',
  missingStock: 'Read Stock & signature to count the signature share.',
  missingTemplate: 'Read Template & freshness to count its subversions.',
  noBeats: 'No template beat was found, so there is no subversion count.',
  staleStock: 'Stock & signature was read against an earlier version of this chapter, so the basis is not counted. Re-read it to count it.',
  staleTemplate: 'Template & freshness was read against an earlier version of this chapter, so the basis is not counted. Re-read it to count it.',
  reading: 'A half of the basis is being read again; it is counted when the reading lands.'
} as const;

/**
 * The basis line under the freshness reading: a host join of group D's tier
 * counts and group E's found template beats, from the board's own tiles.
 */
export function lightboxFreshnessBasis(readings: readonly LightboxReadingGroup[]): LightboxFreshnessBasis {
  const [tiers] = tilesOfKind(readings, 'stock-tiers');
  const [template] = tilesOfKind(readings, 'template');
  if (!tiers && !template) {
    return { status: 'missing', line: LIGHTBOX_BASIS_LINES.missingBoth };
  }
  if (!tiers) {
    return { status: 'missing', line: LIGHTBOX_BASIS_LINES.missingStock };
  }
  if (!template) {
    return { status: 'missing', line: LIGHTBOX_BASIS_LINES.missingTemplate };
  }
  const stock = lensState(readings, 'stock');
  const read = lensState(readings, 'template');
  if (stock === 'reading' || read === 'reading') {
    return { status: 'reading', line: LIGHTBOX_BASIS_LINES.reading };
  }
  if (stock === 'stale') {
    return { status: 'stale', line: LIGHTBOX_BASIS_LINES.staleStock };
  }
  if (read === 'stale') {
    return { status: 'stale', line: LIGHTBOX_BASIS_LINES.staleTemplate };
  }
  const beats = tilesOfKind(readings, 'template-beat');
  if (beats.length === 0) {
    return { status: 'missing', line: LIGHTBOX_BASIS_LINES.noBeats };
  }
  const signature = tiers.tiers.signature;
  const classified = tiers.classified;
  const percent = classified > 0 ? Math.round((signature / classified) * 100) : 0;
  const subverted = beats.filter((beat) => beat.stance === 'subverts').length;
  return {
    status: 'current',
    signature,
    classified,
    percent,
    subverted,
    beats: beats.length,
    line: `${signature} of ${classified} classified beats signature (${percent}%) · ` +
      `${subverted} of ${beats.length} template ${beats.length === 1 ? 'beat' : 'beats'} subverted`
  };
}

// ---------------------------------------------------------------------------
// Pressure
// ---------------------------------------------------------------------------

export interface LightboxPressureCounts {
  threads: number;
  /** Resolved inside the chapter. */
  resolved: number;
  /** Still open at its end. */
  carriedOut: number;
  /** Planted and never touched again (read, and checked to have no later quote). */
  dormant: number;
}

export function lightboxPressureCounts(threads: readonly LightboxPressureThreadTile[]): LightboxPressureCounts {
  return {
    threads: threads.length,
    resolved: threads.filter((thread) => thread.resolution !== null).length,
    carriedOut: threads.filter((thread) => thread.resolution === null).length,
    dormant: threads.filter((thread) => thread.dormant).length
  };
}

/**
 * Whether a thread is open across a run of paragraphs: planted at or before
 * its last, and not yet resolved by its first (a thread closes in the
 * paragraph that resolves it).
 */
export function lightboxThreadOpenAcross(
  thread: Pick<LightboxPressureThreadTile, 'planted' | 'resolution'>,
  column: Pick<LightboxRibbonColumn, 'from' | 'to'>
): boolean {
  return thread.planted.paragraph <= column.to &&
    (thread.resolution === null || thread.resolution.paragraph > column.from);
}

/** How many drawn threads are open across each ribbon column. */
export function lightboxPressureLane(
  threads: readonly LightboxPressureThreadTile[],
  ribbon: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]
): number[] {
  return ribbon.map((column) => threads.filter((thread) => lightboxThreadOpenAcross(thread, column)).length);
}

// ---------------------------------------------------------------------------
// Movements and engagement, per column
// ---------------------------------------------------------------------------

/** The movement holding each column's first paragraph, by the movements' current ranges. */
export function lightboxColumnMovements(
  movements: readonly LightboxMovementTile[],
  ribbon: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]
): Array<LightboxMovementTile | undefined> {
  return ribbon.map((column) => movements.find((movement) => movement.from <= column.from && column.from <= movement.to));
}

/** A movement's engagement mark, when the template drew one for it. */
export function lightboxMovementEngagement(
  template: Pick<LightboxTemplateTile, 'engagement'> | undefined,
  movementId: string
): LightboxEngagementLevel | undefined {
  return template?.engagement.find((mark) => mark.movementId === movementId)?.level;
}

/** Each column's engagement, as read on the movement holding it; `null` where there is none. */
export function lightboxEngagementColumns(
  template: Pick<LightboxTemplateTile, 'engagement'> | undefined,
  movements: readonly LightboxMovementTile[],
  ribbon: readonly Pick<LightboxRibbonColumn, 'from' | 'to'>[]
): Array<LightboxEngagementLevel | null> {
  return lightboxColumnMovements(movements, ribbon)
    .map((movement) => (movement ? lightboxMovementEngagement(template, movement.id) ?? null : null));
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export interface LightboxArtifactsSummary {
  objects: number;
  /** Objects whose arc holds two or more found steps. */
  changeState: number;
  /** Objects whose "planted, unused" the host kept. */
  unused: number;
}

export function lightboxArtifactsSummary(artifacts: readonly LightboxArtifactTile[]): LightboxArtifactsSummary {
  return {
    objects: artifacts.length,
    changeState: artifacts.filter((artifact) => artifact.arc.length >= 2).length,
    unused: artifacts.filter((artifact) => artifact.plantedUnused).length
  };
}
