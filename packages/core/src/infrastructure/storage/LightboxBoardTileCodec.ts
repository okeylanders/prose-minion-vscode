/**
 * The saved board's reading tiles (ADR 2026-10-19 D12 addendum; Slice 5A):
 * one decoder per kind, in a `Record` over the closed `LightboxReadingTileKind`
 * union, so a new kind does not compile until it has a decoder here, and
 * each decoder's `Shape` is held to its contract type, so a new field does
 * not compile either. `LightboxBoardCodec.test.ts` also checks the map's keys
 * against `LIGHTBOX_TILE_REGISTER`.
 *
 * A tile is read whole or not at all: its host-derived fields (counts, column
 * keys, tiers, the Opinion's citations and their bases) are what make it the
 * reading it was. A tile that fails is dropped from its group and counted
 * (`droppable`); its siblings stand. Paragraph numbers a reading holds are
 * from 1 (`ordinal`); a withheld quote keeps the number the reading named,
 * declared or not. Pure: no host, no I/O.
 */

import type {
  LightboxAirLockTile,
  LightboxArtifactStep,
  LightboxArtifactTile,
  LightboxCharacterTile,
  LightboxCountedSupport,
  LightboxEchoTile,
  LightboxEngagementLevel,
  LightboxEngagementMark,
  LightboxFamiliarKind,
  LightboxFamiliarPhraseTile,
  LightboxFreshnessLevel,
  LightboxGenreNeighborTile,
  LightboxGravityCollisionTile,
  LightboxGravityDegree,
  LightboxGravityDrift,
  LightboxGravityFieldTile,
  LightboxGravityLiteralTile,
  LightboxGravityTerm,
  LightboxHandoffEffect,
  LightboxHandoffTile,
  LightboxHeadlineTile,
  LightboxLensId,
  LightboxLineageStance,
  LightboxLineageTile,
  LightboxMotifTile,
  LightboxMovementTile,
  LightboxNumberStatId,
  LightboxNumberUsage,
  LightboxNumberUsageTile,
  LightboxOpinionCite,
  LightboxOpinionObservation,
  LightboxOpinionTile,
  LightboxOpinionView,
  LightboxOpinionViewId,
  LightboxOpinionWeight,
  LightboxOpinionWhy,
  LightboxPaletteClusterTile,
  LightboxParagraphEnding,
  LightboxPressureThreadTile,
  LightboxQuoteFailure,
  LightboxQuoteMatch,
  LightboxReaderPromiseTile,
  LightboxReadingTile,
  LightboxReadingTileBase,
  LightboxReadingTileKind,
  LightboxRhythmEndingsTile,
  LightboxSignatureTile,
  LightboxSparkTile,
  LightboxSteeringNoteTile,
  LightboxSteeringReadingTile,
  LightboxSteeringStance,
  LightboxSteeringStatId,
  LightboxStockTier,
  LightboxStockTiersTile,
  LightboxSubtextTile,
  LightboxSwatchTile,
  LightboxSynopsisTile,
  LightboxTemplateBeatTile,
  LightboxTemplateStance,
  LightboxTemplateTile,
  LightboxTensionArcTile,
  LightboxVerifiedQuote,
  LightboxVoiceTile,
  LightboxVoiceTrait,
  LightboxWithheldQuote
} from '@messages';
import {
  Decoder,
  LightboxBoardShapeError,
  Shape,
  finite,
  flag,
  integer,
  keyed,
  list,
  literal,
  nullable,
  object,
  oneOf,
  optional,
  ordinal,
  pair,
  text,
  triple,
  whole
} from '@/infrastructure/storage/LightboxBoardSchema';

/* eslint-disable @typescript-eslint/naming-convention -- vocabularies keyed by their kebab-case protocol words. */
export const LIGHTBOX_BOARD_LENSES: Readonly<Record<LightboxLensId, true>> = {
  headline: true, motif: true, tension: true, gravity: true, palette: true, characters: true, voice: true, subtext: true,
  genre: true, lineage: true, spark: true, stock: true, rhythm: true, numbers: true, template: true, pressure: true,
  artifacts: true, summary: true, opinion: true, steering: true
};
const MATCHES: Readonly<Record<LightboxQuoteMatch, true>> = { exact: true, normalized: true };
const QUOTE_FAILURES: Readonly<Record<LightboxQuoteFailure, true>> = {
  'undeclared-paragraph': true, 'not-in-paragraph': true, 'not-in-chapter': true, 'too-short': true,
  'no-longer-in-chapter': true, 'no-instance': true, 'out-of-order': true
};
const LINEAGE_STANCES: Readonly<Record<LightboxLineageStance, true>> = { matches: true, departs: true, subverts: true };
const STOCK_TIERS: Readonly<Record<LightboxStockTier, true>> = { functional: true, decorated: true, weighted: true, signature: true };
const FAMILIAR_KINDS: Readonly<Record<LightboxFamiliarKind, true>> = { idiom: true, cliche: true, stock: true, weighted: true };
const ENDINGS: Readonly<Record<LightboxParagraphEnding, true>> = { lands: true, holds: true, opens: true };
const HANDOFF_EFFECTS: Readonly<Record<LightboxHandoffEffect, true>> = { continues: true, pause: true, closure: true, loses: true };
const NUMBER_USAGES: Readonly<Record<LightboxNumberUsage, true>> = { deliberate: true, mixed: true, habit: true };
const NUMBER_STATS: Readonly<Record<LightboxNumberStatId, true>> = {
  'sentence-length': true, dialogue: true, 'passive-voice': true, 'being-verbs': true, adverbs: true, intensifiers: true
};
const TEMPLATE_STANCES: Readonly<Record<LightboxTemplateStance, true>> = { aligns: true, subverts: true, departs: true };
const FRESHNESS: Readonly<Record<LightboxFreshnessLevel, true>> = { familiar: true, mixed: true, fresh: true };
const ENGAGEMENT: Readonly<Record<LightboxEngagementLevel, true>> = { low: true, medium: true, high: true };
const VIEWS: Readonly<Record<LightboxOpinionViewId, true>> = { enthusiastic: true, neutral: true, blunt: true };
const WEIGHTS: Readonly<Record<LightboxOpinionWeight, true>> = { strength: true, even: true, concern: true };
const STEERING_STATS: Readonly<Record<LightboxSteeringStatId, true>> = { 'being-verbs': true, adverbs: true, intensifiers: true };
const STEERING_STANCES: Readonly<Record<LightboxSteeringStance, true>> = { earns: true, leans: true, compensates: true };
/* eslint-enable @typescript-eslint/naming-convention */

const lens = oneOf(LIGHTBOX_BOARD_LENSES);

/** A quote the host found, with its paragraph from 1. */
export const lightboxVerifiedQuoteDecoder: Decoder<LightboxVerifiedQuote> = object<LightboxVerifiedQuote>({
  paragraph: ordinal,
  text,
  match: oneOf(MATCHES),
  note: optional(text)
});
const quote = lightboxVerifiedQuoteDecoder;

/** A withheld quote: the paragraph the reading named (declared or not) and the host's reason; never its words. */
export const lightboxWithheldQuoteDecoder: Decoder<LightboxWithheldQuote> = object<LightboxWithheldQuote>({
  paragraph: integer,
  reason: oneOf(QUOTE_FAILURES),
  foundIn: optional(list(ordinal))
});

const support = object<LightboxCountedSupport>({ term: text, count: whole, paragraphs: list(ordinal) });

const degree: Decoder<LightboxGravityDegree> = (value, at) => {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new LightboxBoardShapeError(at, 'a degree of 1, 2 or 3');
  }
  return value;
};

/** Every reading tile's own fields; each kind adds its `kind` and fields. */
const base: Shape<LightboxReadingTileBase> = {
  id: text,
  lens,
  title: text,
  claim: text,
  paragraphs: list(ordinal),
  evidence: list(quote),
  withheldQuotes: list(lightboxWithheldQuoteDecoder),
  support: list(support),
  friction: text
};

const gravityTerm = object<LightboxGravityTerm>({ term: text, count: whole, paragraphs: list(ordinal), degree });
const drift = object<LightboxGravityDrift>({
  first: ordinal,
  last: ordinal,
  densest: object<LightboxGravityDrift['densest']>({ from: ordinal, to: ordinal, hits: whole })
});
const score: Decoder<number | null> = nullable(whole);
const ending: Decoder<LightboxParagraphEnding | null> = nullable(oneOf(ENDINGS));

const cite = object<LightboxOpinionCite>({ item: text, quote: optional(quote), label: text, basis: text });
const observation = object<LightboxOpinionObservation>({ id: text, text, cites: list(cite), paragraphs: list(ordinal) });
const why = object<LightboxOpinionWhy>({ weight: oneOf(WEIGHTS), text, observations: list(text) });
const view = object<LightboxOpinionView>({ view: oneOf(VIEWS), headline: text, body: text, why: list(why) });

type TileOf<K extends LightboxReadingTileKind> = Extract<LightboxReadingTile, { kind: K }>;

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the tile kinds' kebab-case protocol words. */
/** One decoder per reading tile kind. A kind missing here does not compile. */
export const LIGHTBOX_BOARD_TILE_DECODERS: { readonly [K in LightboxReadingTileKind]: Decoder<TileOf<K>> } = {
  headline: object<LightboxHeadlineTile>({ ...base, kind: literal('headline') }),
  motif: object<LightboxMotifTile>({ ...base, kind: literal('motif'), gist: text }),
  'tension-arc': object<LightboxTensionArcTile>({ ...base, kind: literal('tension-arc'), scores: list(score), columnKeys: list(text) }),
  'palette-cluster': object<LightboxPaletteClusterTile>({ ...base, kind: literal('palette-cluster') }),
  swatch: object<LightboxSwatchTile>({ ...base, kind: literal('swatch'), hex: text }),
  'gravity-field': object<LightboxGravityFieldTile>({
    ...base,
    kind: literal('gravity-field'),
    metaphor: text,
    pull: finite,
    support: list(gravityTerm),
    hits: whole,
    degreeHits: triple(whole, whole, whole),
    belowLine: flag,
    drift: nullable(drift)
  }),
  'gravity-collision': object<LightboxGravityCollisionTile>({ ...base, kind: literal('gravity-collision'), fields: pair(text, text), witness: quote }),
  'gravity-literal': object<LightboxGravityLiteralTile>({ ...base, kind: literal('gravity-literal'), hits: whole }),
  character: object<LightboxCharacterTile>({
    ...base, kind: literal('character'), archetype: text, energy: text, wants: text, hides: text
  }),
  voice: object<LightboxVoiceTile>({
    ...base,
    kind: literal('voice'),
    traits: list(object<LightboxVoiceTrait>({ label: text, value: text, measured: optional(text) }))
  }),
  'genre-neighbor': object<LightboxGenreNeighborTile>({ ...base, kind: literal('genre-neighbor'), affinity: finite, nearMiss: text }),
  'reader-promise': object<LightboxReaderPromiseTile>({ ...base, kind: literal('reader-promise') }),
  subtext: object<LightboxSubtextTile>({ ...base, kind: literal('subtext'), speaker: text, said: quote }),
  lineage: object<LightboxLineageTile>({
    ...base,
    kind: literal('lineage'),
    source: text,
    stances: list(object<LightboxLineageTile['stances'][number]>({ stance: oneOf(LINEAGE_STANCES), note: text }))
  }),
  spark: object<LightboxSparkTile>({ ...base, kind: literal('spark'), dismissedOrder: optional(whole) }),
  'stock-tiers': object<LightboxStockTiersTile>({
    ...base,
    kind: literal('stock-tiers'),
    beats: list(object<LightboxStockTiersTile['beats'][number]>({ quote, tier: oneOf(STOCK_TIERS) })),
    tiers: keyed(STOCK_TIERS, whole),
    classified: whole
  }),
  signature: object<LightboxSignatureTile>({ ...base, kind: literal('signature') }),
  'familiar-phrase': object<LightboxFamiliarPhraseTile>({
    ...base, kind: literal('familiar-phrase'), phrase: text, familiar: oneOf(FAMILIAR_KINDS)
  }),
  'air-lock': object<LightboxAirLockTile>({ ...base, kind: literal('air-lock') }),
  echo: object<LightboxEchoTile>({ ...base, kind: literal('echo'), reminiscentOf: text }),
  'rhythm-endings': object<LightboxRhythmEndingsTile>({
    ...base, kind: literal('rhythm-endings'), endings: list(ending), columnKeys: list(text)
  }),
  handoff: object<LightboxHandoffTile>({
    ...base, kind: literal('handoff'), from: quote, to: quote, carried: text, effect: oneOf(HANDOFF_EFFECTS)
  }),
  'number-usage': object<LightboxNumberUsageTile>({
    ...base, kind: literal('number-usage'), stat: oneOf(NUMBER_STATS), usage: oneOf(NUMBER_USAGES)
  }),
  template: object<LightboxTemplateTile>({
    ...base,
    kind: literal('template'),
    freshness: object<LightboxTemplateTile['freshness']>({ level: oneOf(FRESHNESS), note: text }),
    engagement: list(object<LightboxEngagementMark>({ movementId: text, level: oneOf(ENGAGEMENT) }))
  }),
  'template-beat': object<LightboxTemplateBeatTile>({ ...base, kind: literal('template-beat'), stance: oneOf(TEMPLATE_STANCES) }),
  'pressure-thread': object<LightboxPressureThreadTile>({
    ...base,
    kind: literal('pressure-thread'),
    planted: quote,
    escalations: list(quote),
    resolution: nullable(quote),
    dormant: flag,
    span: object<LightboxPressureThreadTile['span']>({ from: ordinal, to: ordinal })
  }),
  artifact: object<LightboxArtifactTile>({
    ...base,
    kind: literal('artifact'),
    mentions: whole,
    firstParagraph: ordinal,
    arc: list(object<LightboxArtifactStep>({ step: text, quote })),
    plantedUnused: flag,
    unusedWithheld: optional(text)
  }),
  synopsis: object<LightboxSynopsisTile>({ ...base, kind: literal('synopsis') }),
  movement: object<LightboxMovementTile>({
    ...base, kind: literal('movement'), ordinal: ordinal, from: ordinal, to: ordinal, boundary: quote
  }),
  opinion: object<LightboxOpinionTile>({
    ...base,
    kind: literal('opinion'),
    observations: list(observation),
    withheldObservations: list(object<LightboxOpinionTile['withheldObservations'][number]>({ id: text, reason: text })),
    views: list(view),
    withheldViews: list(object<LightboxOpinionTile['withheldViews'][number]>({ view: oneOf(VIEWS), reason: text })),
    digest: object<LightboxOpinionTile['digest']>({ key: text, items: whole, leftOut: whole })
  }),
  'steering-reading': object<LightboxSteeringReadingTile>({ ...base, kind: literal('steering-reading'), stat: oneOf(STEERING_STATS) }),
  'steering-note': object<LightboxSteeringNoteTile>({
    ...base,
    kind: literal('steering-note'),
    stat: oneOf(STEERING_STATS),
    stance: oneOf(STEERING_STANCES),
    nudge: optional(text),
    example: optional(object<NonNullable<LightboxSteeringNoteTile['example']>>({ before: text, after: text })),
    exampleWithheld: optional(text),
    voice: optional(text),
    ordinal: ordinal
  })
};
/* eslint-enable @typescript-eslint/naming-convention */

/** The reading tile kinds, from the decoder map: the vocabulary a withheld block or claim names. */
export const LIGHTBOX_BOARD_TILE_KINDS: Readonly<Record<LightboxReadingTileKind, true>> = Object.fromEntries(
  Object.keys(LIGHTBOX_BOARD_TILE_DECODERS).map((kind) => [kind, true])
) as Record<LightboxReadingTileKind, true>;

/** A reading tile of any kind, by its `kind`. */
export const lightboxTileDecoder: Decoder<LightboxReadingTile> = (value, at, context) => {
  const kind = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>).kind : undefined;
  if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(LIGHTBOX_BOARD_TILE_DECODERS, kind)) {
    throw new LightboxBoardShapeError(`${at}.kind`, 'a tile kind this build knows');
  }
  return (LIGHTBOX_BOARD_TILE_DECODERS[kind as LightboxReadingTileKind] as Decoder<LightboxReadingTile>)(value, at, context);
};
