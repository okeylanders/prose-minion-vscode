/**
 * What the Opinion can cite, item by item (ADR 2026-10-19 D7 addendum;
 * Slice 4D). Pure: no host, no I/O, no model. Shared by the host, which
 * renders the call's digest from these items and checks a reply's
 * citations against them, and by the renderer, which checks the Opinion's
 * standing against the board on screen. One function decides both, so they
 * cannot disagree.
 *
 * An item is one board thing, under its host key:
 * - **a reading tile**, by its host-minted id: its lens and kind, its
 *   title and claim, its kind's own fields, its host counts and up to
 *   `opinionQuotesPerItem` of its found quotes, numbered q0, q1, … Group F's
 *   own tile is never an item, and neither is a spark: a spark is an offer
 *   the writer may set aside, not a reading of what the chapter does;
 * - **a measured figure**, by a stable ref: the headline stats
 *   (`headline`), a figure that stands out (`standout:<stat>`), a craft
 *   steering figure's counts (`steering:<stat>`, Slice 4F, always), a
 *   section of the Sections lane (`section:<n>`, from 1).
 * Craft steering's notes show their stance, figure and why; never their
 * nudge or example, which are offers to the writer, not readings of the
 * chapter (epic decision 24).
 * Each item's lines are host words around the board's own values. No
 * paragraph text enters them except a tile's found quotes and its counted
 * terms: a section is named by its range and marker, never by its heading's
 * words. Shares are written "per 100 words", never as percentages, and the
 * writer's other chapters are "the other chapters", so nothing the digest
 * says addresses the writer.
 *
 * **Content identity.** `basis` hashes everything an item's lines and
 * quotes say. A tile read again gets new ids; one carried onto changed text
 * is stale; a figure measured again under a new preset or average says
 * something else; a section that moved has another range. Any of these
 * changes what the Opinion read, and a citation records the basis it read.
 * `current` is false while the item's lens is stale or being read again.
 *
 * **Numeric authority** is narrower than identity (PR #157 F-01): `figures`
 * are the numbers the item shows as evidence (its label, lines, quotes and
 * their paragraph addresses), never digits of its key or of its quotes'
 * q-numbers. A host id carries the run token's first eight characters, so
 * its digits mean nothing.
 */

import type {
  LightboxBoard,
  LightboxNumberRow,
  LightboxReadingGroup,
  LightboxReadingTile,
  LightboxSectionSignal,
  LightboxVerifiedQuote
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  LIGHTBOX_ENDING_LABELS,
  LIGHTBOX_FAMILIAR_KIND_LABELS,
  LIGHTBOX_HANDOFF_EFFECT_LABELS,
  LIGHTBOX_LINEAGE_STANCE_LABELS,
  LIGHTBOX_NUMBER_STAT_LABELS,
  LIGHTBOX_NUMBER_USAGE_LABELS,
  LIGHTBOX_STOCK_TIER_LABELS,
  LIGHTBOX_TILE_KIND_LABELS,
  formatLightboxFigure,
  formatLightboxRatio,
  lightboxGroupReadsBoard,
  lightboxLensLabel
} from '@shared/constants/lightbox';
import {
  LIGHTBOX_ENGAGEMENT_LABELS,
  LIGHTBOX_FRESHNESS_LABEL,
  LIGHTBOX_FRESHNESS_LABELS,
  LIGHTBOX_TEMPLATE_STANCE_LABELS,
  lightboxMovementNumeral
} from '@shared/constants/lightboxPlot';
import {
  LIGHTBOX_STEERING_STANCE_LABELS,
  LIGHTBOX_STEERING_VOICE_DIGEST,
  lightboxSteeringCountLines,
  lightboxSteeringFigure
} from '@shared/constants/lightboxSteering';

const B = PROMPT_BUDGETS.lightbox;

/**
 * What the items are read from: a board's readings and, for its measured
 * figures, its measured set (a carry passes the rebuilt board's; without
 * one there are no measured items to cite).
 */
export interface LightboxOpinionBoard {
  measured?: LightboxBoard['measured'];
  readings: readonly LightboxReadingGroup[];
}

export interface LightboxOpinionItem {
  /** A tile id, or a measured ref (`headline`, `standout:<stat>`, `steering:<stat>`, `section:<n>`). */
  key: string;
  kind: 'tile' | 'measured';
  /** Host words naming it: its lens and kind, and its title. */
  label: string;
  /** What the digest says of it, after its label: host words around the board's values. */
  lines: string[];
  /** The quotes it may be cited by, q0 first; a tile's found quotes only. */
  quotes: LightboxVerifiedQuote[];
  /** What it lights on the ribbon, ascending. */
  paragraphs: number[];
  /** False while its lens is stale or being read again; measured items are always current. */
  current: boolean;
  /** Its content identity (`lightboxOpinionHash` of everything it says). */
  basis: string;
  /**
   * Every number its label, lines and quotes (with their paragraph addresses)
   * show, without thousands commas: what an Opinion citing it may state.
   * Never a digit of its key or of a quote's q-number (PR #157 F-01).
   */
  figures: ReadonlySet<string>;
}

/** Every item on the board the Opinion could cite, current or not: the measured figures, then the readings in board order. */
export function lightboxOpinionItems(board: LightboxOpinionBoard): LightboxOpinionItem[] {
  return [...measuredItems(board), ...board.readings.flatMap((group) => readingItems(group, board))];
}

/** The items by key. */
export function lightboxOpinionItemMap(board: LightboxOpinionBoard): ReadonlyMap<string, LightboxOpinionItem> {
  return new Map(lightboxOpinionItems(board).map((item) => [item.key, item]));
}

/** The item's digest block: its key and label, its lines, then its quotes numbered q0, q1, … */
export function lightboxOpinionItemText(item: LightboxOpinionItem): string {
  return [
    `[${item.key}] ${item.label}`,
    ...item.lines.map((line) => `  ${line}`),
    ...item.quotes.map((quote, index) => `  q${index} ¶${quote.paragraph}: “${quote.text}”${quote.note ? ` (peak: ${quote.note})` : ''}`)
  ].join('\n');
}

/** Every number written in `text`, thousands commas dropped ("3,087" is "3087"). */
export function lightboxOpinionFigures(text: string): string[] {
  return (text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((figure) => figure.replace(/,/g, ''));
}

/**
 * A short, deterministic content hash (53 bits, as hex), the same in the
 * extension host and the webview. An identity check, not a secret: it says
 * whether an item still says what it said.
 */
export function lightboxOpinionHash(text: string): string {
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

// ---------------------------------------------------------------------------
// Measured figures
// ---------------------------------------------------------------------------

function measuredItems(board: LightboxOpinionBoard): LightboxOpinionItem[] {
  const measured = board.measured;
  if (!measured) {
    return [];
  }
  const headline = measured.headline;
  const items: LightboxOpinionItem[] = [
    item('headline', 'measured', 'Measured · Headline stats', [
      `${headline.wordCount.toLocaleString('en-US')} words · ${headline.sentenceCount.toLocaleString('en-US')} sentences · ` +
        `${headline.paragraphCount.toLocaleString('en-US')} paragraphs`,
      `${headline.averageWordsPerSentence} words per sentence · dialogue ${headline.dialoguePercentage} per 100 words · ` +
        `pacing: ${headline.pacing}`
    ], [], [], true)
  ];
  for (const row of measured.numbers.rows) {
    if (row.standout) {
      items.push(item(`standout:${row.stat}`, 'measured', `Measured · The numbers: ${row.label}`, standoutLines(row), [], [...row.paragraphs], true));
    }
  }
  // Craft steering's counts, every figure, written as evidence on purpose: what they show becomes citable (Slice 4F).
  for (const figure of measured.steering.figures) {
    items.push(item(`steering:${figure.stat}`, 'measured', `Measured · Craft steering: ${LIGHTBOX_NUMBER_STAT_LABELS[figure.stat]}`,
      lightboxSteeringCountLines(figure), [], [...figure.paragraphs], true));
  }
  const sections = measured.sections;
  sections.sections.forEach((section, index) => {
    const opened = section.marker !== undefined
      ? `opened by ${SIGNAL_NOUNS[sections.signal === 'none' ? 'headings' : sections.signal]} in ¶${section.marker}`
      : 'before the first marker';
    items.push(item(
      `section:${index + 1}`,
      'measured',
      `Measured · Sections: section ${index + 1} of ${sections.sections.length}`,
      [`¶${section.from}–¶${section.to}, ${opened}`],
      [],
      range(section.from, section.to),
      true
    ));
  });
  return items;
}

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the signals' kebab-case protocol ids. */
const SIGNAL_NOUNS: Readonly<Record<LightboxSectionSignal, string>> = {
  headings: 'a heading',
  'scene-breaks': 'a scene break',
  'chapter-lines': 'a chapter line'
};
/* eslint-enable @typescript-eslint/naming-convention */

function standoutLines(row: LightboxNumberRow): string[] {
  const unit = row.unit.replace(/^% of /, 'per 100 ');
  const against: string[] = [];
  if (row.standout?.against.includes('standards') && row.range) {
    against.push(`the preset's range ${row.range.min ?? '…'}–${row.range.max ?? '…'}`);
  }
  if (row.standout?.against.includes('writer') && row.writer) {
    against.push(`the other chapters' average of ${formatLightboxFigure(row.writer.average)}` +
      (row.writer.ratio !== undefined ? ` (×${formatLightboxRatio(row.writer.ratio)})` : ' (none in the other chapters)'));
  }
  return [
    `${formatLightboxFigure(row.value)} ${unit}; stands out ${row.standout?.direction ?? ''} ${against.join(' and ')}`.trim(),
    `${row.instances.toLocaleString('en-US')} ${row.instanceLabel}${row.paragraphs.length > 0 ? `, in ${paragraphList(row.paragraphs)}` : ''}`
  ];
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

function readingItems(group: LightboxReadingGroup, board: LightboxOpinionBoard): LightboxOpinionItem[] {
  if (lightboxGroupReadsBoard(group.group)) {
    return [];
  }
  return group.tiles
    .filter((tile) => tile.kind !== 'spark')
    .map((tile) => {
      const stale = group.staleLenses?.some((mark) => mark.lens === tile.lens) ?? false;
      const reading = group.status === 'running' && (group.pending?.includes(tile.lens) ?? false);
      const label = `${lightboxLensLabel(tile.lens)} · ${LIGHTBOX_TILE_KIND_LABELS[tile.kind]}: ${tile.title}`;
      const claim = tile.claim.trim().length > 0 && tile.claim !== tile.title ? [`claim: ${tile.claim}`] : [];
      return item(tile.id, 'tile', label, [...claim, ...kindLines(tile, board), ...countedLines(tile)],
        tile.evidence.slice(0, B.opinionQuotesPerItem), [...tile.paragraphs], !stale && !reading);
    });
}

/**
 * A digest line that holds host-authored routing or labels beside its values
 * (PR #157 F-01): `shown` is rendered in the digest as it always was, so no
 * basis moves; `evidence` is the same line without them, and is all the line
 * lends the item's figures.
 */
interface AnnotatedLine {
  shown: string;
  evidence: string;
}
type ItemLine = string | AnnotatedLine;

function annotated(shown: string, evidence: string): AnnotatedLine {
  return { shown, evidence };
}

/**
 * Each kind's own fields, in host words around the tile's values. A line
 * with routing or labels in it (Subtext's q0, a field's degree labels) is
 * `annotated`; every other number a line writes is the reading's or the
 * board's own value: a count, a share, a claimed pull or affinity, a ¶
 * address, a measured figure, a section's number and how many there are, or
 * a unit ("per 1,000 words"). Movement numbers are written as Roman
 * numerals, which hold no digit.
 */
function kindLines(tile: LightboxReadingTile, board: LightboxOpinionBoard): ItemLine[] {
  switch (tile.kind) {
    case 'motif':
      return [`gist: ${tile.gist}`];
    case 'gravity-field': {
      const rest = (tile.belowLine ? ' · below the gravity line' : '') +
        (tile.drift ? ` · first ¶${tile.drift.first}, last ¶${tile.drift.last}, densest ¶${tile.drift.densest.from}–¶${tile.drift.densest.to}` : '');
      const [first, second, third] = tile.degreeHits;
      return [
        `metaphor: ${tile.metaphor} · claimed pull ${tile.pull} (a claim, not a measurement)`,
        // The degree labels 1°, 2°, 3° name the buckets; only the hits in them are evidence.
        annotated(`hits ${tile.hits} (1° ${first}, 2° ${second}, 3° ${third})${rest}`, `hits ${tile.hits} (${first}, ${second}, ${third})${rest}`)
      ];
    }
    case 'gravity-collision':
      return [`fields: ${tile.fields[0]} and ${tile.fields[1]} share a sentence in ¶${tile.witness.paragraph}`];
    case 'gravity-literal':
      return [`set aside as literal in the scene · hits ${tile.hits}`];
    case 'character':
      return [`archetype: ${tile.archetype} · energy: ${tile.energy}`, `wants: ${tile.wants} · hides: ${tile.hides}`];
    case 'voice':
      return tile.traits.map((trait) => `${trait.label}: ${trait.value}${trait.measured ? ` (measured: ${trait.measured})` : ''}`);
    case 'genre-neighbor':
      return [`claimed affinity ${tile.affinity} (a claim, not a score)`, ...(tile.nearMiss ? [`near miss: ${tile.nearMiss}`] : [])];
    case 'subtext':
      // "q0" routes the reader to the said line; only the speaker is evidence.
      return [annotated(`speaker: ${tile.speaker} · the said line is q0; the claim is what it is read as meaning`, `speaker: ${tile.speaker}`)];
    case 'lineage':
      return [`source: ${tile.source}`, ...tile.stances.map((row) => `${LIGHTBOX_LINEAGE_STANCE_LABELS[row.stance]}: ${row.note}`)];
    case 'stock-tiers':
      return [`tiers, counted by code from ${tile.classified} beats the reading classified: ` +
        (['functional', 'decorated', 'weighted', 'signature'] as const).map((tier) => `${LIGHTBOX_STOCK_TIER_LABELS[tier]} ${tile.tiers[tier]}`).join(' · ')];
    case 'familiar-phrase':
      return [`kind: ${LIGHTBOX_FAMILIAR_KIND_LABELS[tile.familiar]} (familiar to a reader, not a fault)`];
    case 'echo':
      return [`sounds reminiscent of: ${tile.reminiscentOf} (unchecked: a model's memory, never a finding)`];
    case 'rhythm-endings':
      return [`endings, as read across ${tile.endings.length} ribbon columns: ` +
        (['lands', 'holds', 'opens'] as const).map((ending) => `${LIGHTBOX_ENDING_LABELS[ending]} ${tile.endings.filter((value) => value === ending).length}`).join(' · ')];
    case 'handoff':
      return [`carried: ${tile.carried} · effect: ${LIGHTBOX_HANDOFF_EFFECT_LABELS[tile.effect]}`];
    case 'number-usage': {
      const row = board.measured?.numbers.rows.find((candidate) => candidate.stat === tile.stat);
      return [`${LIGHTBOX_NUMBER_USAGE_LABELS[tile.usage]}`, ...(row?.standout ? standoutLines(row) : [])];
    }
    case 'template':
      return [
        `freshness, as read: ${LIGHTBOX_FRESHNESS_LABELS[tile.freshness.level]} (${LIGHTBOX_FRESHNESS_LABEL.toLowerCase()}): ${tile.freshness.note}`,
        ...engagementLine(tile, board)
      ];
    case 'template-beat':
      return [`stance: ${LIGHTBOX_TEMPLATE_STANCE_LABELS[tile.stance]}`];
    case 'pressure-thread':
      return [
        `planted ¶${tile.planted.paragraph}` +
          (tile.escalations.length > 0 ? `; builds ${tile.escalations.map((quote) => `¶${quote.paragraph}`).join(', ')}` : '') +
          (tile.resolution ? `; resolved ¶${tile.resolution.paragraph}` : '; still open, carried out of the chapter') +
          (tile.dormant ? '; dormant' : '') +
          `; span ¶${tile.span.from}–¶${tile.span.to}`
      ];
    case 'artifact':
      return [
        `mentions ×${tile.mentions}, first ¶${tile.firstParagraph}, counted by code` + (tile.plantedUnused ? ' · planted, unused' : ''),
        `arc: ${tile.arc.map((step) => `${step.step} (¶${step.quote.paragraph})`).join(' → ')}`
      ];
    case 'movement':
      return [`movement ${lightboxMovementNumeral(tile.ordinal)}: ¶${tile.from}–¶${tile.to}`];
    case 'steering-reading': {
      const figure = lightboxSteeringFigure(board.measured?.steering.figures, tile.stat);
      return figure ? lightboxSteeringCountLines(figure) : [];
    }
    case 'steering-note':
      // The why is the claim; the nudge and the example never enter the digest (epic decision 24). A note in
      // dialogue says so, so a stance on a character's voice is not read as the narration's craft (decision 26).
      return [`stance: ${LIGHTBOX_STEERING_STANCE_LABELS[tile.stance]} · figure: ${LIGHTBOX_NUMBER_STAT_LABELS[tile.stat]}` +
        (tile.voice !== undefined ? ` · ${LIGHTBOX_STEERING_VOICE_DIGEST}` : '')];
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
      return [];
  }
}

function engagementLine(tile: Extract<LightboxReadingTile, { kind: 'template' }>, board: LightboxOpinionBoard): string[] {
  const movements = board.readings.flatMap((group) => group.tiles)
    .filter((candidate): candidate is Extract<LightboxReadingTile, { kind: 'movement' }> => candidate.kind === 'movement');
  const marks = tile.engagement.flatMap((mark) => {
    const movement = movements.find((candidate) => candidate.id === mark.movementId);
    return movement ? [`${lightboxMovementNumeral(movement.ordinal)} ${LIGHTBOX_ENGAGEMENT_LABELS[mark.level].toLowerCase()}`] : [];
  });
  return marks.length > 0 ? [`engagement, a reading of pull: ${marks.join(' · ')}`] : [];
}

/** The tile's counted terms, as code counted them. */
function countedLines(tile: LightboxReadingTile): string[] {
  const terms = tile.support.slice(0, B.termsPerClaim)
    .map((term) => `${term.term} ×${term.count}${term.paragraphs.length > 0 ? ` (${paragraphList(term.paragraphs)})` : ''}`);
  return terms.length > 0 ? [`counted by code: ${terms.join(' · ')}`] : [];
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function item(
  key: string,
  kind: LightboxOpinionItem['kind'],
  label: string,
  lines: readonly ItemLine[],
  quotes: LightboxVerifiedQuote[],
  paragraphs: number[],
  current: boolean
): LightboxOpinionItem {
  const shown = lines.map((line) => (typeof line === 'string' ? line : line.shown));
  const shaped: Omit<LightboxOpinionItem, 'basis' | 'figures'> = { key, kind, label, lines: shown, quotes, paragraphs, current };
  // Identity is everything the digest block says; numeric authority is only what the item shows (PR #157 F-01).
  const text = lightboxOpinionItemText({ ...shaped, basis: '', figures: new Set() });
  const evidence = lines.map((line) => (typeof line === 'string' ? line : line.evidence));
  return { ...shaped, basis: lightboxOpinionHash(text), figures: new Set(lightboxOpinionFigures(evidenceText(label, evidence, quotes))) };
}

/**
 * What an item shows as evidence: its label, its lines' evidence (an
 * annotated line without its routing or labels), and its quotes with their
 * paragraph addresses and notes. Never its key, which is identity (a
 * host-minted id holds the run token's digits), nor the q0, q1, … numbers
 * the digest gives its quotes or a line uses to route, which are addresses.
 */
function evidenceText(label: string, lines: readonly string[], quotes: readonly LightboxVerifiedQuote[]): string {
  return [label, ...lines, ...quotes.map((quote) => `¶${quote.paragraph} ${quote.text}${quote.note ? ` ${quote.note}` : ''}`)].join('\n');
}

/** "¶2, ¶4, ¶7", at most `opinionParagraphsPerLine` addresses, then how many more. */
function paragraphList(paragraphs: readonly number[]): string {
  const shown = paragraphs.slice(0, B.opinionParagraphsPerLine).map((paragraph) => `¶${paragraph}`).join(', ');
  const more = paragraphs.length - B.opinionParagraphsPerLine;
  return more > 0 ? `${shown} and ${more.toLocaleString('en-US')} more` : shown;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_unused, offset) => from + offset);
}
