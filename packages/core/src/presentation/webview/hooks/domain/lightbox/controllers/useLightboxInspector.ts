/**
 * useLightboxInspector — the pinned item's view model (ADR 2026-10-19 D3, D4).
 *
 * The inspector shows the pinned item with its register, its claim, the exact
 * paragraphs it lives in (even when the ribbon buckets them), and what code
 * counted. A reading (Slice 2B) also shows its evidence (each quote as it
 * stands in the chapter, its ¶ and how it was found), the quotes withheld and
 * why, its own fields, and where it strains (D7).
 *
 * A presentation controller: derived state only, the pin itself is owned by
 * `useLightbox` and cleared through the injected callback.
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
import { lightboxWithheldQuoteText } from '@hooks/domain/lightbox/lightboxReadings';

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
  lens: LightboxLensId;
  evidence: LightboxInspectorEvidence[];
  withheld: Array<{ paragraph: number; text: string }>;
  details: LightboxInspectorDetail[];
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

function readingDetails(tile: LightboxReadingTile): LightboxInspectorDetail[] {
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
    case 'headline':
    case 'tension-arc':
    case 'reader-promise':
      return [];
  }
}

function readingView(tile: LightboxReadingTile): LightboxInspectorReading {
  return {
    lens: tile.lens,
    evidence: tile.evidence.map((quote) => ({
      paragraph: quote.paragraph,
      text: quote.text,
      matchLabel: quote.match === 'exact' ? 'found verbatim' : 'found with typography folded',
      ...(quote.note ? { note: quote.note } : {})
    })),
    withheld: tile.withheldQuotes.map((quote) => ({ paragraph: quote.paragraph, text: lightboxWithheldQuoteText(quote) })),
    details: readingDetails(tile),
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
    ...(item.reading ? { reading: readingView(item.reading) } : {})
  };
}

export interface UseLightboxInspectorArgs {
  board: LightboxBoard | null;
  selected: LightboxItemRef | null;
  onSelect: (ref: LightboxItemRef | null) => void;
}

export interface LightboxInspectorState {
  view: LightboxInspectorView | null;
}

export interface LightboxInspectorActions {
  clear: () => void;
  /** Pin one paragraph (the ¶ chips). */
  pinParagraph: (index: number) => void;
}

/** Derived state only; the pin is persisted by `useLightbox`. */
export type LightboxInspectorPersistence = Record<string, never>;

export type UseLightboxInspectorReturn = LightboxInspectorState & LightboxInspectorActions & {
  persistedState: LightboxInspectorPersistence;
};

const NO_PERSISTENCE: LightboxInspectorPersistence = {};

export function useLightboxInspector({
  board,
  selected,
  onSelect
}: UseLightboxInspectorArgs): UseLightboxInspectorReturn {
  const view = React.useMemo(() => buildLightboxInspectorView(board, selected), [board, selected]);
  const clear = React.useCallback(() => onSelect(null), [onSelect]);
  const pinParagraph = React.useCallback(
    (index: number) => onSelect({ kind: 'paragraphs', from: index, to: index }),
    [onSelect]
  );
  return { view, clear, pinParagraph, persistedState: NO_PERSISTENCE };
}
