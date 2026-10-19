/**
 * useLightboxInspector — the pinned item's view model (ADR 2026-10-19 D3, D4).
 *
 * The inspector shows the pinned item with its register, its claim, the exact
 * paragraphs it lives in (even when the ribbon buckets them), and what code
 * counted. Slice 2A pins only measured items, so the register is always
 * "Measured"; the copy for the other registers is here so 2B's read tiles
 * land in an inspector that already explains them.
 *
 * A presentation controller: derived state only, the pin itself is owned by
 * `useLightbox` and cleared through the injected callback.
 */

/* eslint-disable @typescript-eslint/naming-convention -- register ids are kebab-case protocol literals (ADR 2026-10-19 D3). */

import * as React from 'react';
import type { LightboxBoard, LightboxRegister } from '@messages';
import {
  LightboxItemRef,
  lightboxItemsTouching,
  paragraphCountLabel,
  resolveLightboxItem
} from '@hooks/domain/lightbox/lightboxItems';

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
  /** For a single paragraph: the measured items that touch it. */
  touching: LightboxInspectorTouch[];
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
    claim: item.claim,
    paragraphs: item.paragraphs,
    paragraphLabel: paragraphCountLabel(item.paragraphs.length),
    support: item.support,
    touching: single
      ? lightboxItemsTouching(board, ref.from)
          .slice(0, TOUCHING_SHOWN)
          .map((touch) => ({ ref: touch.ref, label: touch.title }))
      : []
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
