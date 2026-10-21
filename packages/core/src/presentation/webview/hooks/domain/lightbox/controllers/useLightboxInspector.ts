/**
 * useLightboxInspector — the pinned item's view model (ADR 2026-10-19 D3, D4).
 *
 * The inspector shows the pinned item with its register, its claim, the exact
 * paragraphs it lives in (even when the ribbon buckets them), and what code
 * counted. A reading (Slice 2B) also shows its evidence (each quote as it
 * stands in the chapter, its ¶ and how it was found), the quotes withheld and
 * why, its own fields, and where it strains (D7).
 *
 * Every exact address stays reachable without rendering them all (PR #148
 * F-04): the addresses are shown a page of `LIGHTBOX_PARAGRAPH_PAGE_SIZE` at
 * a time, with previous/next and a jump to a paragraph number. Paging is
 * transient and belongs to the current pin: it never changes the pin, a new
 * pin starts on the first page, and a rebuilt board keeps the page (clamped).
 *
 * A presentation controller: the pin itself is owned by `useLightbox` and
 * changed through the injected callback; paging is its only state.
 */

/* eslint-disable @typescript-eslint/naming-convention -- register ids are kebab-case protocol literals (ADR 2026-10-19 D3). */

import * as React from 'react';
import type { LightboxBoard, LightboxLensId, LightboxReadingTile, LightboxRegister } from '@messages';
import {
  LightboxItemRef,
  lightboxItemsTouching,
  paragraphCountLabel,
  resolveLightboxItem
} from '@hooks/domain/lightbox/lightboxItems';
import { lightboxLensIsStale, lightboxWithheldQuoteText, pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { isLightboxTermRef } from '@hooks/domain/lightbox/lightboxTerms';
import { LightboxDegreeRow, lightboxDegreeRows, lightboxDriftNote } from '@hooks/domain/lightbox/lightboxGravity';
import { lightboxEndingTally, lightboxNumberValue, lightboxTierShares } from '@hooks/domain/lightbox/lightboxCraft';
import { lightboxPlotDetails } from '@hooks/domain/lightbox/lightboxPlot';
import { lightboxOpinionDetails } from '@hooks/domain/lightbox/lightboxOpinion';
import { lightboxSteeringDetails } from '@hooks/domain/lightbox/lightboxSteering';
import { lightboxOpinionStanding } from '@shared/constants/lightboxOpinion';
import {
  LIGHTBOX_ECHO_ACCURACY,
  LIGHTBOX_FAMILIAR_KIND_LABELS,
  LIGHTBOX_HANDOFF_EFFECT_LABELS,
  LIGHTBOX_LINEAGE_STANCE_LABELS,
  LIGHTBOX_NUMBER_USAGE_LABELS
} from '@shared/constants/lightbox';

export const LIGHTBOX_REGISTER_LABELS: Readonly<Record<LightboxRegister, string>> = {
  measured: 'Measured',
  read: 'Read',
  'counted-read': 'Counted · read'
};

export const LIGHTBOX_REGISTER_NOTES: Readonly<Record<LightboxRegister, string>> = {
  measured: 'Counted by code. No model was asked.',
  read: 'A reading, not a measurement. Quotes are checked against the text; a claim whose quote isn’t found is withheld.',
  'counted-read': 'Words counted by code, then grouped or named by a reading.'
};

/** How many touching items the inspector offers for one paragraph. */
const TOUCHING_SHOWN = 8;

/** Paragraph addresses the inspector renders at once; the rest are a page away. */
export const LIGHTBOX_PARAGRAPH_PAGE_SIZE = 48;

/** One page of a pinned item's exact paragraph addresses. */
export interface LightboxParagraphPage {
  /** 0-based. */
  page: number;
  pageCount: number;
  /** This page's addresses, ascending; at most `LIGHTBOX_PARAGRAPH_PAGE_SIZE`. */
  shown: number[];
  /** 1-based positions of the first and last shown address among all of them. */
  from: number;
  to: number;
  /** How many addresses the item has. */
  total: number;
  /** The address a jump landed on, when this page is the jump's. */
  target?: number;
  /**
   * Which explicit jump `target` answers, numbered per jump. A repeated jump
   * to the same address gets a new number, so it focuses again; a passive
   * re-render keeps the number and moves no focus (PR #148 F-05).
   */
  jump?: number;
}

/** Page `page` of `paragraphs`, clamped to the pages there are. */
export function pageLightboxParagraphs(
  paragraphs: readonly number[],
  page: number,
  target?: number,
  jump?: number
): LightboxParagraphPage {
  const size = LIGHTBOX_PARAGRAPH_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(paragraphs.length / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pageCount - 1);
  const start = current * size;
  const shown = paragraphs.slice(start, start + size);
  const onPage = target !== undefined && shown.includes(target);
  return {
    page: current,
    pageCount,
    shown,
    from: shown.length > 0 ? start + 1 : 0,
    to: start + shown.length,
    total: paragraphs.length,
    target: onPage ? target : undefined,
    jump: onPage ? jump : undefined
  };
}

/**
 * Where a jump to ¶`index` lands: on that address, or the next one the item
 * has after it, or its last address when `index` is past them all.
 */
export function lightboxParagraphJump(
  paragraphs: readonly number[],
  index: number
): { page: number; target: number } | undefined {
  if (paragraphs.length === 0 || !Number.isFinite(index)) {
    return undefined;
  }
  let low = 0;
  let high = paragraphs.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (paragraphs[middle] < index) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const position = Math.min(low, paragraphs.length - 1);
  return { page: Math.floor(position / LIGHTBOX_PARAGRAPH_PAGE_SIZE), target: paragraphs[position] };
}

export interface LightboxInspectorTouch {
  ref: LightboxItemRef;
  label: string;
}

export interface LightboxInspectorEvidence {
  paragraph: number;
  /** As it stands in the chapter. */
  text: string;
  /** "found verbatim", or "found with typography folded". */
  matchLabel: string;
  note?: string;
}

export interface LightboxInspectorDetail {
  label: string;
  value: string;
  /** A host-measured figure beside the reading. */
  measured?: string;
}

/** What only a reading has. */
export interface LightboxInspectorReading {
  /** The reading tile itself, for actions that name it (Build as a lens). */
  tile: LightboxReadingTile;
  lens: LightboxLensId;
  /** Read against an earlier version of the text (D4). */
  stale: boolean;
  /** The Opinion's own words for why it is stale (Slice 4D); other readings use the board's. */
  staleNote?: string;
  evidence: LightboxInspectorEvidence[];
  withheld: Array<{ paragraph: number; text: string }>;
  details: LightboxInspectorDetail[];
  /** A borrowed field's terms by degree, with the host's hits at each (Slice 3). */
  degrees: LightboxDegreeRow[];
  friction: string;
}

export interface LightboxInspectorView {
  register: LightboxRegister;
  registerLabel: string;
  registerNote: string;
  where: string;
  title: string;
  claim: string;
  /** Every paragraph, exact (never bucketed). */
  paragraphs: number[];
  paragraphLabel: string;
  support: string[];
  /** For a single paragraph: the items that touch it. */
  touching: LightboxInspectorTouch[];
  reading?: LightboxInspectorReading;
}

function readingDetails(tile: LightboxReadingTile, board: LightboxBoard): LightboxInspectorDetail[] {
  switch (tile.kind) {
    case 'motif':
      return [{ label: 'How it moves', value: tile.gist }];
    case 'character':
      return [
        { label: 'Archetype', value: tile.archetype },
        { label: 'Energy', value: tile.energy },
        { label: 'Wants', value: tile.wants },
        { label: 'Hides', value: tile.hides }
      ];
    case 'voice':
      return tile.traits.map((trait) => ({ label: trait.label, value: trait.value, ...(trait.measured ? { measured: trait.measured } : {}) }));
    case 'genre-neighbor':
      return [
        { label: 'Claimed affinity', value: `${tile.affinity.toFixed(2)} · a claim, not a score` },
        ...(tile.nearMiss ? [{ label: 'Near miss', value: tile.nearMiss }] : [])
      ];
    case 'gravity-field':
      return [
        { label: 'Governing metaphor', value: tile.metaphor },
        { label: 'Claimed pull', value: `${tile.pull.toFixed(2)} · a claim, not a measurement` },
        {
          label: 'Hits',
          value: `${tile.hits} counted by code, each occurrence once` + (tile.belowLine ? '; below the gravity line' : '')
        },
        { label: 'Drift', value: lightboxDriftNote(tile) }
      ];
    case 'gravity-collision':
      return [{ label: 'Fields', value: `${tile.fields[0]} · ${tile.fields[1]}` }];
    case 'gravity-literal':
      return [{ label: 'Hits', value: `${tile.hits} counted by code; literal in the scene, so nothing is borrowed` }];
    case 'swatch':
      return [{ label: 'Swatch color', value: `${tile.hex} · the reading's choice; only the words are counted` }];
    case 'subtext':
      return [
        { label: 'Who says it', value: tile.speaker },
        { label: 'Said', value: `¶${tile.said.paragraph}, inside quoted dialogue, found by code` },
        { label: 'Reads as', value: 'The claim above is a reading of the line, not what the character thinks' }
      ];
    case 'lineage':
      return [
        { label: 'Source', value: tile.source },
        ...tile.stances.map((row) => ({ label: LIGHTBOX_LINEAGE_STANCE_LABELS[row.stance], value: row.note }))
      ];
    case 'spark':
      return [{ label: 'An open door', value: 'A question to think with: an offer, never an instruction' }];
    case 'stock-tiers':
      return [
        ...lightboxTierShares(tile).map((share) => ({ label: share.label, value: `${share.count} of ${pluralize(tile.classified, 'beat')}`, measured: `${share.percent}%` })),
        { label: 'Counted', value: 'By code, from the beats the reading classified and code found: a share of those beats, not of the chapter' }
      ];
    case 'signature':
      return [{ label: 'Signature', value: 'A line the reading calls the chapter’s own' }];
    case 'familiar-phrase':
      return [
        { label: 'Kind', value: LIGHTBOX_FAMILIAR_KIND_LABELS[tile.familiar] },
        ...(tile.support[0] ? [{ label: 'Counted', value: `${tile.support[0].count} in the chapter, by code` }] : []),
        { label: 'Familiar', value: 'Familiar to a reader, not a fault' }
      ];
    case 'air-lock':
      return [{ label: 'Air-lock', value: 'Closure-complete and quotable: a craft signal, not a risk' }];
    case 'echo':
      return [
        { label: 'Sounds reminiscent of', value: tile.reminiscentOf },
        { label: 'Accuracy', value: LIGHTBOX_ECHO_ACCURACY }
      ];
    case 'rhythm-endings': {
      const tally = lightboxEndingTally(tile, board.ribbon);
      return [
        { label: 'Endings, as read', value: `Lands ${tally.lands} · Holds ${tally.holds} · Opens ${tally.opens}` },
        ...(tally.opensAt.length > 0 ? [{ label: 'Opens at', value: tally.opensAt.map((index) => `¶${index}`).join(', ') }] : []),
        ...(tally.unread > 0 ? [{ label: 'Not shown', value: `${tally.unread} changed since the reading` }] : [])
      ];
    }
    case 'handoff':
      return [
        { label: 'Sentences', value: `¶${tile.from.paragraph}: two adjacent sentences, checked by code` },
        { label: 'Carried', value: tile.carried },
        { label: 'Effect', value: LIGHTBOX_HANDOFF_EFFECT_LABELS[tile.effect] }
      ];
    case 'number-usage': {
      const row = board.measured.numbers.rows.find((candidate) => candidate.stat === tile.stat);
      return [
        ...(row ? [{ label: 'Figure', value: row.label, measured: lightboxNumberValue(row) }] : []),
        { label: 'Reads as', value: LIGHTBOX_NUMBER_USAGE_LABELS[tile.usage].replace(/^Reads as /, '') },
        { label: 'Instances', value: 'Each quote holds one, checked by the detector that counted the figure' }
      ];
    }
    // Group E (Slice 4C): each kind's fields and the checks code ran (the boundary, the span, the counts).
    case 'template':
    case 'template-beat':
    case 'pressure-thread':
    case 'artifact':
    case 'synopsis':
    case 'movement':
      return lightboxPlotDetails(tile, board) ?? [];
    // Slice 4D: the one evaluative tile, what stood and what it read.
    case 'opinion':
      return lightboxOpinionDetails(tile);
    // Slice 4F: a figure's reading, or a note's stance, nudge and its one example, labelled as one.
    case 'steering-reading':
    case 'steering-note':
      return lightboxSteeringDetails(tile, board) ?? [];
    case 'headline':
    case 'tension-arc':
    case 'palette-cluster':
    case 'reader-promise':
      return [];
  }
}

/** Read against an earlier text (D4); the Opinion, also when anything it cites changed since (Slice 4D). */
function readingIsStale(board: LightboxBoard, tile: LightboxReadingTile): boolean {
  return lightboxLensIsStale(board, tile.lens) || (tile.kind === 'opinion' && lightboxOpinionStanding(tile, board).stale);
}

function readingView(tile: LightboxReadingTile, stale: boolean, board: LightboxBoard): LightboxInspectorReading {
  const staleNote = tile.kind === 'opinion' ? lightboxOpinionStanding(tile, board).note : undefined;
  return {
    tile,
    lens: tile.lens,
    stale,
    ...(staleNote ? { staleNote } : {}),
    evidence: tile.evidence.map((quote) => ({
      paragraph: quote.paragraph,
      text: quote.text,
      matchLabel: quote.match === 'exact' ? 'found verbatim' : 'found with typography folded',
      ...(quote.note ? { note: quote.note } : {})
    })),
    withheld: tile.withheldQuotes.map((quote) => ({ paragraph: quote.paragraph, text: lightboxWithheldQuoteText(quote) })),
    details: readingDetails(tile, board),
    degrees: tile.kind === 'gravity-field' ? lightboxDegreeRows(tile) : [],
    friction: tile.friction
  };
}

/** The view model for a pinned reference, or null when nothing (resolvable) is pinned. */
export function buildLightboxInspectorView(
  board: LightboxBoard | null,
  ref: LightboxItemRef | null
): LightboxInspectorView | null {
  if (!board || !ref) {
    return null;
  }
  const item = resolveLightboxItem(board, ref);
  if (!item) {
    return null;
  }
  const single = ref.kind === 'paragraphs' && ref.from === ref.to;
  return {
    register: item.register,
    registerLabel: LIGHTBOX_REGISTER_LABELS[item.register],
    registerNote: LIGHTBOX_REGISTER_NOTES[item.register],
    where: item.where,
    title: item.title,
    // A headline's claim is its title; say it once.
    claim: item.claim === item.title ? '' : item.claim,
    paragraphs: item.paragraphs,
    paragraphLabel: paragraphCountLabel(item.paragraphs.length),
    support: item.support,
    touching: single
      ? lightboxItemsTouching(board, ref.from)
          .slice(0, TOUCHING_SHOWN)
          .map((touch) => ({ ref: touch.ref, label: touch.title }))
      : [],
    ...(item.reading ? { reading: readingView(item.reading, readingIsStale(board, item.reading), board) } : {})
  };
}

export interface UseLightboxInspectorArgs {
  board: LightboxBoard | null;
  selected: LightboxItemRef | null;
  onSelect: (ref: LightboxItemRef | null) => void;
}

export interface LightboxInspectorState {
  view: LightboxInspectorView | null;
  /** The page of the pinned item's addresses on show; null with nothing pinned. */
  paragraphPage: LightboxParagraphPage | null;
}

export interface LightboxInspectorActions {
  clear: () => void;
  /** Pin one paragraph (the ¶ chips); from a counted term, the paragraph keeps it to light (Slice 4E). */
  pinParagraph: (index: number) => void;
  /** Show another page of the pinned item's addresses; the pin stays. */
  showParagraphPage: (page: number) => void;
  /** Show the page holding ¶`index` (or the item's next address after it) and mark it. */
  jumpToParagraph: (index: number) => void;
}

/** The pin is persisted by `useLightbox`; paging is transient. */
export type LightboxInspectorPersistence = Record<string, never>;

export type UseLightboxInspectorReturn = LightboxInspectorState & LightboxInspectorActions & {
  persistedState: LightboxInspectorPersistence;
};

const NO_PERSISTENCE: LightboxInspectorPersistence = {};

/** Paging for one pin, compared by identity: a new pin, even of the same item, starts over. */
interface LightboxParagraphPaging {
  pin: LightboxItemRef;
  page: number;
  target?: number;
  jump?: number;
}

export function useLightboxInspector({
  board,
  selected,
  onSelect
}: UseLightboxInspectorArgs): UseLightboxInspectorReturn {
  const view = React.useMemo(() => buildLightboxInspectorView(board, selected), [board, selected]);
  const [paging, setPaging] = React.useState<LightboxParagraphPaging | null>(null);
  const jumps = React.useRef(0);

  const paragraphPage = React.useMemo(() => {
    if (!view) {
      return null;
    }
    const current = paging && paging.pin === selected ? paging : undefined;
    return pageLightboxParagraphs(view.paragraphs, current?.page ?? 0, current?.target, current?.jump);
  }, [paging, selected, view]);

  const clear = React.useCallback(() => onSelect(null), [onSelect]);
  const pinParagraph = React.useCallback((index: number) => {
    // What brought the writer here: the pinned term, or the term the pinned paragraph was itself reached from.
    const via = isLightboxTermRef(selected) ? selected : selected?.kind === 'paragraphs' ? selected.via : undefined;
    onSelect({ kind: 'paragraphs', from: index, to: index, ...(via ? { via } : {}) });
  }, [onSelect, selected]);
  const showParagraphPage = React.useCallback((page: number) => {
    if (selected) {
      setPaging({ pin: selected, page });
    }
  }, [selected]);
  const jumpToParagraph = React.useCallback((index: number) => {
    const landing = selected && view ? lightboxParagraphJump(view.paragraphs, index) : undefined;
    if (selected && landing) {
      jumps.current += 1;
      setPaging({ pin: selected, page: landing.page, target: landing.target, jump: jumps.current });
    }
  }, [selected, view]);

  return {
    view,
    paragraphPage,
    clear,
    pinParagraph,
    showParagraphPage,
    jumpToParagraph,
    persistedState: NO_PERSISTENCE
  };
}
