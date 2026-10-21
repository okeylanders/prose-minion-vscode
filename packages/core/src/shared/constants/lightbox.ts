/**
 * Lightbox tables shared by the host and the renderer (ADR 2026-10-19 D3, D6).
 *
 * The register a tile is drawn in is derived from its kind here, never
 * supplied by a reading, so no model output can make a reading look like a
 * count. Every table is exhaustive over its union: a new tile kind or lens
 * does not compile until it is placed.
 */

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */

import type {
  LightboxFamiliarKind,
  LightboxGravityDegree,
  LightboxHandoffEffect,
  LightboxLensId,
  LightboxLineageStance,
  LightboxNumberStatId,
  LightboxNumberUsage,
  LightboxParagraphEnding,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxReadingTileKind,
  LightboxRegister,
  LightboxRunScope,
  LightboxStockTier,
  LightboxTileKind
} from '@messages';

/**
 * The files the Lightbox reads, as a source or as context: Markdown and plain
 * text, by extension (no dot). These are the extensions VS Code opens as the
 * `markdown` and `plaintext` languages that Open File in Lightbox accepts.
 * The pickers offer them first, and the project picker's catalog holds only
 * these (2026-10-20).
 */
export const LIGHTBOX_TEXT_FILE_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

/** Whether a path names a file the Lightbox reads (its extension, case-insensitively). */
export function isLightboxTextFile(filePath: string): boolean {
  const extension = /\.([^./\\]+)$/.exec(filePath)?.[1]?.toLowerCase();
  return extension !== undefined && (LIGHTBOX_TEXT_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

export const LIGHTBOX_TILE_REGISTER: Readonly<Record<LightboxTileKind, LightboxRegister>> = {
  stats: 'measured',
  'top-words': 'measured',
  'parts-of-speech': 'measured',
  headline: 'read',
  motif: 'read',
  'tension-arc': 'read',
  // Words counted by code, grouped or named by a reading.
  'palette-cluster': 'counted-read',
  swatch: 'counted-read',
  'gravity-field': 'counted-read',
  'gravity-literal': 'counted-read',
  'gravity-collision': 'read',
  character: 'read',
  // The voice tile sets host-measured sentence figures beside the reading.
  voice: 'counted-read',
  'genre-neighbor': 'read',
  'reader-promise': 'read',
  subtext: 'read',
  lineage: 'read',
  // A reading's offer, standing on terms code counted.
  spark: 'counted-read',
  // Slice 4B: the tier mix and familiar phrases are counted by code from what the reading names.
  'stock-tiers': 'counted-read',
  signature: 'read',
  'familiar-phrase': 'counted-read',
  'air-lock': 'read',
  echo: 'read',
  'rhythm-endings': 'read',
  handoff: 'read',
  // A figure code measured as standing out, read for how it is used.
  'number-usage': 'counted-read',
  // Slice 4C: the template, its beats, the synopsis and the movements are read;
  // a thread's span and an object's mentions are counted by code.
  template: 'read',
  'template-beat': 'read',
  'pressure-thread': 'counted-read',
  artifact: 'counted-read',
  synopsis: 'read',
  movement: 'read',
  // Slice 4D: the one evaluative tile is read, and drawn with its own chip ("The one evaluative tile").
  opinion: 'read'
};

/** The lens each reading kind belongs to. */
export const LIGHTBOX_TILE_LENS: Readonly<Record<LightboxReadingTileKind, LightboxLensId>> = {
  headline: 'headline',
  motif: 'motif',
  'tension-arc': 'tension',
  'palette-cluster': 'palette',
  swatch: 'palette',
  'gravity-field': 'gravity',
  'gravity-collision': 'gravity',
  'gravity-literal': 'gravity',
  character: 'characters',
  voice: 'voice',
  'genre-neighbor': 'genre',
  'reader-promise': 'genre',
  subtext: 'subtext',
  lineage: 'lineage',
  spark: 'spark',
  'stock-tiers': 'stock',
  signature: 'stock',
  'familiar-phrase': 'stock',
  'air-lock': 'stock',
  echo: 'stock',
  'rhythm-endings': 'rhythm',
  handoff: 'rhythm',
  'number-usage': 'numbers',
  template: 'template',
  'template-beat': 'template',
  'pressure-thread': 'pressure',
  artifact: 'artifacts',
  synopsis: 'summary',
  movement: 'summary',
  opinion: 'opinion'
};

/** What one reading of each kind is called, e.g. in the inspector's "Theme & motif · Motif". */
export const LIGHTBOX_TILE_KIND_LABELS: Readonly<Record<LightboxReadingTileKind, string>> = {
  headline: 'Headline',
  motif: 'Motif',
  'tension-arc': 'Arc',
  'palette-cluster': 'Diction cluster',
  swatch: 'Color',
  'gravity-field': 'Borrowed field',
  'gravity-collision': 'Collision',
  'gravity-literal': 'Set aside',
  character: 'Vibe',
  voice: 'Narration',
  'genre-neighbor': 'Neighbor',
  'reader-promise': 'Reader promise',
  subtext: 'Said / meant',
  lineage: 'Adjacent story',
  spark: 'Open door',
  'stock-tiers': 'Cognitive economy',
  signature: 'Signature',
  'familiar-phrase': 'Familiar phrasing',
  'air-lock': 'Air-lock',
  echo: 'Echo',
  'rhythm-endings': 'How paragraphs end',
  handoff: 'Handoff',
  'number-usage': 'How it is used',
  template: 'Template',
  'template-beat': 'Template beat',
  'pressure-thread': 'Thread',
  artifact: 'Object',
  synopsis: 'Synopsis',
  movement: 'Movement',
  opinion: 'Opinion'
};

/**
 * The gravity line: a borrowed field with fewer host-counted hits than this is
 * drawn below the line, whatever pull its reading claims. It is drawn, not
 * dropped, so the writer sees what the board decided not to call gravity.
 */
export const LIGHTBOX_GRAVITY_LINE_HITS = 3;

/** A field term's degree, as the board names it: 1° latent, 2° felt, 3° overt. */
export const LIGHTBOX_GRAVITY_DEGREES: Readonly<Record<LightboxGravityDegree, string>> = {
  1: 'latent',
  2: 'felt',
  3: 'overt'
};

/** How a lineage stance reads on the board (Slice 4). */
export const LIGHTBOX_LINEAGE_STANCE_LABELS: Readonly<Record<LightboxLineageStance, string>> = {
  matches: 'Matches',
  departs: 'Departs',
  subverts: 'Subverts'
};

/**
 * What an echo always says beside it (Slice 4B; ADR D7 addendum): echoes
 * replace provenance, and the board never presents one as a finding.
 */
export const LIGHTBOX_ECHO_ACCURACY =
  'The quote is checked against your chapter; the resemblance is not. A model’s memory of sources is often wrong, ' +
  'so read this as worth a look, never as a finding.';

/** The cognitive-economy tiers, in display order, as the board names them (Slice 4B). */
export const LIGHTBOX_STOCK_TIER_LABELS: Readonly<Record<LightboxStockTier, string>> = {
  functional: 'Functional stock',
  decorated: 'Decorated',
  weighted: 'Stock carrying weight',
  signature: 'Signature'
};

/** Familiar phrasing's kinds. Familiar means familiar to the reader, not a fault. */
export const LIGHTBOX_FAMILIAR_KIND_LABELS: Readonly<Record<LightboxFamiliarKind, string>> = {
  idiom: 'Idiom',
  cliche: 'Cliché',
  stock: 'Stock phrase',
  weighted: 'Stock carrying weight'
};

/** How a paragraph ends, as the board names it. */
export const LIGHTBOX_ENDING_LABELS: Readonly<Record<LightboxParagraphEnding, string>> = {
  lands: 'Lands',
  holds: 'Holds',
  opens: 'Opens'
};

/** What a sentence handoff does, in Craft Steering's terms. */
export const LIGHTBOX_HANDOFF_EFFECT_LABELS: Readonly<Record<LightboxHandoffEffect, string>> = {
  continues: 'Continues',
  pause: 'Holds a pause',
  closure: 'Earns closure',
  loses: 'Loses the connection'
};

/** The figures the numbers tile measures, as the board names them (Slice 4B). */
export const LIGHTBOX_NUMBER_STAT_LABELS: Readonly<Record<LightboxNumberStatId, string>> = {
  'sentence-length': 'Sentence length',
  dialogue: 'Dialogue',
  'passive-voice': 'Passive voice',
  'being-verbs': 'Being verbs',
  adverbs: 'Adverbs (-ly)',
  intensifiers: 'Intensifiers and fillers'
};

export function isLightboxNumberStat(value: unknown): value is LightboxNumberStatId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LIGHTBOX_NUMBER_STAT_LABELS, value);
}

/**
 * A measured figure as the board shows it: one decimal. A nonzero figure
 * too small for that shows as "<0.1", never as "0" (PR #155 F-04).
 */
export function formatLightboxFigure(value: number): string {
  return formatAtPrecision(value, 1);
}

/** A ratio as the board shows it: two decimals, "<0.01" for a nonzero ratio below them. */
export function formatLightboxRatio(ratio: number): string {
  return formatAtPrecision(ratio, 2);
}

function formatAtPrecision(value: number, decimals: number): string {
  const scale = 10 ** decimals;
  const shown = Math.round(value * scale) / scale;
  if (value !== 0 && shown === 0) {
    return `${value < 0 ? '>-' : '<'}${(1 / scale).toFixed(decimals)}`;
  }
  return String(shown);
}

/** How a standout figure reads in use: a reading, never a fix. */
export const LIGHTBOX_NUMBER_USAGE_LABELS: Readonly<Record<LightboxNumberUsage, string>> = {
  deliberate: 'Reads as deliberate',
  mixed: 'Reads as mixed',
  habit: 'Reads as habit'
};

/** The reading groups, in board order (D6): A–E read the chapter, and F, last, reads the board (Slice 4D). */
export const LIGHTBOX_READING_GROUPS: readonly LightboxReadingGroupId[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * The group that reads the board, not the chapter (Slice 4D): the Opinion.
 * In a press it starts only after every other group of that press has
 * settled, on the board's verified digest as those groups left it.
 */
export const LIGHTBOX_BOARD_GROUP = 'F' satisfies LightboxReadingGroupId;

/** Whether a group reads the board (the Opinion's digest) rather than the chapter. */
export function lightboxGroupReadsBoard(group: LightboxReadingGroupId): boolean {
  return group === LIGHTBOX_BOARD_GROUP;
}

export interface LightboxLensDescriptor {
  id: LightboxLensId;
  /** The lens's name in the rail and on its tile. */
  label: string;
  group: LightboxReadingGroupId;
}

const LENS_DESCRIPTORS: Readonly<Record<LightboxLensId, Omit<LightboxLensDescriptor, 'id'>>> = {
  headline: { label: 'Headline', group: 'A' },
  motif: { label: 'Theme & motif', group: 'A' },
  tension: { label: 'Tension arc', group: 'A' },
  gravity: { label: 'Lexical gravity', group: 'A' },
  palette: { label: 'Palette', group: 'A' },
  characters: { label: 'Characters', group: 'B' },
  voice: { label: 'Voice', group: 'B' },
  subtext: { label: 'Subtext', group: 'B' },
  genre: { label: 'Genre neighborhood', group: 'C' },
  lineage: { label: 'Lineage', group: 'C' },
  spark: { label: 'Spark', group: 'C' },
  stock: { label: 'Stock & signature', group: 'D' },
  rhythm: { label: 'Rhythm & handoffs', group: 'D' },
  numbers: { label: 'The numbers', group: 'D' },
  template: { label: 'Template & freshness', group: 'E' },
  pressure: { label: 'Pressure', group: 'E' },
  artifacts: { label: 'Artifacts', group: 'E' },
  summary: { label: 'Summary & movements', group: 'E' },
  opinion: { label: 'Opinion', group: 'F' }
};

/** Every lens, in rail order (which is also group order). */
export const LIGHTBOX_LENSES: readonly LightboxLensDescriptor[] = (
  Object.keys(LENS_DESCRIPTORS) as LightboxLensId[]
).map((id) => ({ id, ...LENS_DESCRIPTORS[id] }));

export function isLightboxLensId(value: unknown): value is LightboxLensId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LENS_DESCRIPTORS, value);
}

export function lightboxLensLabel(lens: LightboxLensId): string {
  return LENS_DESCRIPTORS[lens].label;
}

export function lightboxLensGroup(lens: LightboxLensId): LightboxReadingGroupId {
  return LENS_DESCRIPTORS[lens].group;
}

/** The group's lenses in rail order. */
export function lightboxGroupLenses(group: LightboxReadingGroupId): LightboxLensId[] {
  return LIGHTBOX_LENSES.filter((lens) => lens.group === group).map((lens) => lens.id);
}

/** A group before any call. */
export function emptyLightboxReadingGroup(group: LightboxReadingGroupId): LightboxReadingGroup {
  return { group, status: 'not-run', lenses: [], tiles: [], withheldBlocks: [], withheldClaims: [], frictions: [], quoteChecks: [] };
}

/** One call a press would make: a group with the lenses it reads. */
export interface LightboxPlannedCall {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
}

/**
 * Lenses read together whenever either is re-read on its own (Slice 4C):
 * engagement, in the template block, sits on the movements the summary block
 * draws, and the host checks one against the other in the same response, so
 * re-reading one alone would leave engagement on movements of another call.
 */
const LIGHTBOX_READ_TOGETHER: Readonly<Partial<Record<LightboxLensId, readonly LightboxLensId[]>>> = {
  template: ['summary'],
  summary: ['template']
};

/** What "Re-read this tile" reads for `lens`: the lens, with any lens read together with it that is on, in rail order. */
export function lightboxRereadLenses(lens: LightboxLensId, lensesOff: readonly LightboxLensId[]): LightboxLensId[] {
  if (lensesOff.includes(lens)) {
    return [];
  }
  const together = [lens, ...(LIGHTBOX_READ_TOGETHER[lens] ?? [])].filter((candidate) => !lensesOff.includes(candidate));
  return LIGHTBOX_LENSES.map((descriptor) => descriptor.id).filter((candidate) => together.includes(candidate));
}

/**
 * The calls a press makes (D6). A lens that is off is left out of its group,
 * and a group with no lens on is not called. `rest` skips the groups whose
 * readings already landed; `lens` re-reads one lens that is on, with the
 * lenses read together with it (`lightboxRereadLenses`). Group F, the
 * Opinion, is always the last call: the runner starts it only once the
 * others have settled (Slice 4D).
 */
export function lightboxPlannedCalls(
  lensesOff: readonly LightboxLensId[],
  scope: LightboxRunScope,
  readings: readonly Pick<LightboxReadingGroup, 'group' | 'status'>[] = []
): LightboxPlannedCall[] {
  if (scope.mode === 'lens') {
    const lenses = lightboxRereadLenses(scope.lens, lensesOff);
    return lenses.length === 0 ? [] : [{ group: lightboxLensGroup(scope.lens), lenses }];
  }
  return LIGHTBOX_READING_GROUPS.flatMap((group) => {
    const lenses = lightboxGroupLenses(group).filter((lens) => !lensesOff.includes(lens));
    const landed = readings.find((reading) => reading.group === group)?.status === 'ok';
    return lenses.length === 0 || (scope.mode === 'rest' && landed) ? [] : [{ group, lenses }];
  });
}
