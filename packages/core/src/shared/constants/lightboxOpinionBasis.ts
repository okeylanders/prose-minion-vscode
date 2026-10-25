/**
 * The Opinion's citation basis (epic decision 25; Slice 5A; ADR 2026-10-19
 * D12 addendum of 2026-10-22). Pure: no host, no I/O.
 *
 * A citation records the basis of the item it cites when the Opinion reads
 * the board, and the Opinion is stale once that item's basis differs
 * (`lightboxOpinionStanding`). The basis hashes the item's **canonical
 * data**: what the digest shows of it, as values, never the words the
 * digest puts around them. So:
 * - rewording the digest (a kind's label, "per 100 words", a line's format,
 *   the paragraph-list cap) moves no basis, and an Opinion read before the
 *   rewording stays current;
 * - any change to what the Opinion read moves it: the item's key and kind,
 *   its lens, title and claim, its kind's own fields, the quotes it may be
 *   cited by with their ¶ addresses and notes, its counted terms with their
 *   counts and paragraphs, and every measured figure it shows.
 *
 * What the digest never shows stays out, as it was out of the rendered
 * basis: a tile's friction, its withheld quotes, a quote's match kind, its
 * quotes past `opinionQuotesPerItem` and terms past `termsPerClaim`, a
 * tension arc's scores, a swatch's colour, a steering note's nudge and
 * example (epic decision 24).
 *
 * The rule has an id, recorded on every board (`rules.opinionBasis`), so a
 * saved board says which basis its citations were read under. A new rule is
 * a new id; `measurementRuleIds.test.ts` pins this one to its output.
 */

import type {
  LightboxBoard,
  LightboxCountedSupport,
  LightboxHeadlineStats,
  LightboxNumberRow,
  LightboxReadingGroup,
  LightboxReadingTile,
  LightboxSection,
  LightboxSectionSignal,
  LightboxSteeringFigure,
  LightboxVerifiedQuote
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const B = PROMPT_BUDGETS.lightbox;

/** What a tile's joined fields are read from: the board's readings and, when there is one, its measured set. */
interface LightboxOpinionBoardData {
  measured?: LightboxBoard['measured'];
  readings: readonly LightboxReadingGroup[];
}

/** The basis rule's id, recorded on each board as `rules.opinionBasis`. A new rule is a new id. */
export const LIGHTBOX_OPINION_BASIS_RULE_ID = 'item-data-2026-10-22';

/** A JSON value: what an item's canonical data is made of. */
export type LightboxOpinionDatum =
  | string
  | number
  | boolean
  | null
  | readonly LightboxOpinionDatum[]
  | { readonly [key: string]: LightboxOpinionDatum };

/** The basis of an item's canonical data: its JSON with keys sorted, hashed. */
export function lightboxOpinionBasis(data: LightboxOpinionDatum): string {
  return lightboxOpinionHash(canonicalJson(data));
}

/**
 * A short, deterministic content hash (53 bits, as hex), the same in the
 * extension host and the webview. An identity check, not a secret: it says
 * whether an item still says what it said.
 */
function lightboxOpinionHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** JSON with every object's keys in sorted order, so equal data always writes equal text. */
function canonicalJson(value: LightboxOpinionDatum): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${(value as readonly LightboxOpinionDatum[]).map(canonicalJson).join(',')}]`;
  }
  const record = value as { readonly [key: string]: LightboxOpinionDatum };
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// Measured items
// ---------------------------------------------------------------------------

export function lightboxOpinionHeadlineData(headline: LightboxHeadlineStats): LightboxOpinionDatum {
  return measured('headline', 'headline', {
    words: headline.wordCount,
    sentences: headline.sentenceCount,
    paragraphs: headline.paragraphCount,
    wordsPerSentence: headline.averageWordsPerSentence,
    dialogue: headline.dialoguePercentage,
    pacing: headline.pacing
  });
}

/** A figure that stands out, as the digest's standout lines show it. */
export function lightboxOpinionStandoutData(row: LightboxNumberRow): LightboxOpinionDatum {
  return measured(`standout:${row.stat}`, 'standout', standoutFields(row));
}

/** A craft steering figure's counts, as `lightboxSteeringCountLines` shows them. */
export function lightboxOpinionSteeringData(figure: LightboxSteeringFigure): LightboxOpinionDatum {
  return measured(`steering:${figure.stat}`, 'steering', steeringFields(figure));
}

/** A section of the Sections lane: its place and how many there are, its range, and what opened it. */
export function lightboxOpinionSectionData(
  section: LightboxSection,
  place: number,
  count: number,
  signal: LightboxSectionSignal | 'none'
): LightboxOpinionDatum {
  return measured(`section:${place}`, 'section', {
    place,
    count,
    from: section.from,
    to: section.to,
    marker: section.marker ?? null,
    signal: section.marker !== undefined ? signal : null
  });
}

function measured(key: string, kind: string, fields: LightboxOpinionDatum): LightboxOpinionDatum {
  return { key, kind, fields };
}

function standoutFields(row: LightboxNumberRow): LightboxOpinionDatum {
  const against = row.standout?.against ?? [];
  return {
    stat: row.stat,
    value: row.value,
    direction: row.standout?.direction ?? null,
    reference: row.standout?.reference ?? null,
    range: against.includes('standards') && row.range ? { min: row.range.min ?? null, max: row.range.max ?? null } : null,
    writer: against.includes('writer') && row.writer ? { average: row.writer.average, ratio: row.writer.ratio ?? null } : null,
    instances: row.instances,
    paragraphs: [...row.paragraphs]
  };
}

function steeringFields(figure: LightboxSteeringFigure): LightboxOpinionDatum {
  return {
    stat: figure.stat,
    total: figure.total,
    rate: figure.rate,
    narration: figure.narration,
    dialogue: figure.dialogue,
    constructions: figure.constructions.map((row) => [row.construction, row.count]),
    weakVerbs: figure.weakVerbs ?? null,
    inShortRuns: figure.inShortRuns
  };
}

// ---------------------------------------------------------------------------
// Reading tiles
// ---------------------------------------------------------------------------

/**
 * A reading tile's canonical data: its identity, its words, the quotes it may
 * be cited by, its counted terms, and its kind's own fields, read against
 * `board` where the digest joins another item (a number usage's figure, a
 * template's movements, a steering reading's counts).
 */
export function lightboxOpinionTileData(tile: LightboxReadingTile, board: LightboxOpinionBoardData): LightboxOpinionDatum {
  return {
    key: tile.id,
    kind: tile.kind,
    lens: tile.lens,
    title: tile.title,
    claim: tile.claim,
    quotes: tile.evidence.slice(0, B.opinionQuotesPerItem).map(quoteData),
    counted: tile.support.slice(0, B.termsPerClaim).map(supportData),
    fields: kindFields(tile, board)
  };
}

function quoteData(quote: LightboxVerifiedQuote): LightboxOpinionDatum {
  return [quote.paragraph, quote.text, quote.note ?? null];
}

function supportData(term: LightboxCountedSupport & { degree?: number }): LightboxOpinionDatum {
  return [term.term, term.count, [...term.paragraphs], term.degree ?? null];
}

/** Each kind's own fields, as `kindLines` in `lightboxOpinionItems` shows them, as values. */
function kindFields(tile: LightboxReadingTile, board: LightboxOpinionBoardData): LightboxOpinionDatum {
  switch (tile.kind) {
    case 'motif':
      return { gist: tile.gist };
    case 'gravity-field':
      return {
        metaphor: tile.metaphor,
        pull: tile.pull,
        hits: tile.hits,
        degreeHits: [...tile.degreeHits],
        belowLine: tile.belowLine,
        drift: tile.drift ? [tile.drift.first, tile.drift.last, tile.drift.densest.from, tile.drift.densest.to] : null
      };
    case 'gravity-collision':
      return { fields: [...tile.fields], witness: quoteData(tile.witness) };
    case 'gravity-literal':
      return { hits: tile.hits };
    case 'character':
      return { archetype: tile.archetype, energy: tile.energy, wants: tile.wants, hides: tile.hides };
    case 'voice':
      return { traits: tile.traits.map((trait) => [trait.label, trait.value, trait.measured ?? null]) };
    case 'genre-neighbor':
      return { affinity: tile.affinity, nearMiss: tile.nearMiss };
    case 'subtext':
      return { speaker: tile.speaker };
    case 'lineage':
      return { source: tile.source, stances: tile.stances.map((row) => [row.stance, row.note]) };
    case 'stock-tiers':
      return { classified: tile.classified, tiers: [tile.tiers.functional, tile.tiers.decorated, tile.tiers.weighted, tile.tiers.signature] };
    case 'familiar-phrase':
      return { phrase: tile.phrase, familiar: tile.familiar };
    case 'echo':
      return { reminiscentOf: tile.reminiscentOf };
    case 'rhythm-endings':
      return {
        columns: tile.endings.length,
        endings: (['lands', 'holds', 'opens'] as const).map((ending) => tile.endings.filter((value) => value === ending).length)
      };
    case 'handoff':
      return { carried: tile.carried, effect: tile.effect };
    case 'number-usage': {
      const row = board.measured?.numbers.rows.find((candidate) => candidate.stat === tile.stat);
      return { stat: tile.stat, usage: tile.usage, figure: row?.standout ? standoutFields(row) : null };
    }
    case 'template':
      return { freshness: [tile.freshness.level, tile.freshness.note], engagement: engagementData(tile, board) };
    case 'template-beat':
      return { stance: tile.stance };
    case 'pressure-thread':
      return {
        planted: tile.planted.paragraph,
        escalations: tile.escalations.map((quote) => quote.paragraph),
        resolution: tile.resolution?.paragraph ?? null,
        dormant: tile.dormant,
        span: [tile.span.from, tile.span.to]
      };
    case 'artifact':
      return {
        mentions: tile.mentions,
        firstParagraph: tile.firstParagraph,
        plantedUnused: tile.plantedUnused,
        arc: tile.arc.map((step) => [step.step, step.quote.paragraph])
      };
    case 'movement':
      return { ordinal: tile.ordinal, from: tile.from, to: tile.to };
    case 'steering-reading': {
      const figure = board.measured?.steering.figures.find((candidate) => candidate.stat === tile.stat);
      return { stat: tile.stat, figure: figure ? steeringFields(figure) : null };
    }
    case 'steering-note':
      // The nudge and the example never enter the digest (decision 24); whether the instance is in dialogue does (decision 26).
      return { stat: tile.stat, stance: tile.stance, inDialogue: tile.voice !== undefined };
    case 'headline':
    case 'tension-arc':
    case 'palette-cluster':
    case 'swatch':
    case 'reader-promise':
    case 'spark':
    case 'signature':
    case 'air-lock':
    case 'synopsis':
    case 'opinion':
      return {};
    default:
      return unknownKind(tile);
  }
}

/** A template's engagement as the digest shows it: each drawn movement's numeral and level. */
function engagementData(tile: Extract<LightboxReadingTile, { kind: 'template' }>, board: LightboxOpinionBoardData): LightboxOpinionDatum {
  const movements = board.readings.flatMap((group) => group.tiles)
    .filter((candidate): candidate is Extract<LightboxReadingTile, { kind: 'movement' }> => candidate.kind === 'movement');
  return tile.engagement.flatMap((mark) => {
    const movement = movements.find((candidate) => candidate.id === mark.movementId);
    return movement ? [[movement.ordinal, mark.level]] : [];
  });
}

/** Unreachable while the switch covers the union: a new kind fails to compile until it has its fields here. */
function unknownKind(tile: never): never {
  throw new Error(`The Opinion's basis has no fields for a tile kind: ${(tile as { kind?: string }).kind ?? 'unknown'}`);
}
