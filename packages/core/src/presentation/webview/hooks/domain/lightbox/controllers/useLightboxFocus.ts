/**
 * useLightboxFocus — the board's focus state machine (ADR 2026-10-19 D4).
 *
 * Hovering (or keyboard-focusing) any item lights the paragraphs it touches;
 * clicking pins it. The focused item is the hovered one while the pointer is
 * on something, otherwise the pinned one. The ribbon is bucket-aware: above
 * `ribbonColumns` paragraphs a column covers a range, and it lights when any
 * paragraph in its range is focused.
 *
 * A presentation controller: it owns transient hover state only. The pinned
 * item is a persisted preference owned by `useLightbox`, passed in with its
 * setter, so this hook never touches transport.
 */

import * as React from 'react';
import type { LightboxBoard, LightboxRibbonColumn } from '@messages';
import {
  LightboxItemRef,
  LightboxResolvedItem,
  resolveLightboxItem,
  sameLightboxItem
} from '@hooks/domain/lightbox/lightboxItems';

export interface UseLightboxFocusArgs {
  board: LightboxBoard | null;
  /** The pinned item (persisted by `useLightbox`). */
  selected: LightboxItemRef | null;
  onSelect: (ref: LightboxItemRef | null) => void;
}

/** Event props and state classes for one interactive board item. */
export interface LightboxItemBinding {
  isHot: boolean;
  isSelected: boolean;
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onClick: () => void;
  };
}

export interface LightboxFocusState {
  hovered: LightboxItemRef | null;
  /** The hovered item when it resolves, else the pinned one. */
  focusedItem: LightboxResolvedItem | null;
  focusedParagraphs: ReadonlySet<number>;
  /** One flag per ribbon column. */
  litColumns: readonly boolean[];
}

export interface LightboxFocusActions {
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

/** Hover is transient; the pinned item is persisted by its owner. */
export type LightboxFocusPersistence = Record<string, never>;

export type UseLightboxFocusReturn = LightboxFocusState & LightboxFocusActions & {
  persistedState: LightboxFocusPersistence;
};

const NO_PERSISTENCE: LightboxFocusPersistence = {};

/** Which ribbon columns a set of paragraphs lights. */
export function lightboxLitColumns(
  ribbon: readonly LightboxRibbonColumn[],
  paragraphs: ReadonlySet<number> | readonly number[]
): boolean[] {
  const lit = ribbon.map(() => false);
  const last = ribbon.length > 0 ? ribbon[ribbon.length - 1].to : 0;
  if (last === 0) {
    return lit;
  }
  // Paragraph index → column, so each focused paragraph costs one lookup.
  const columnOf = new Array<number>(last + 1);
  ribbon.forEach((column, columnIndex) => {
    for (let index = column.from; index <= column.to; index++) {
      columnOf[index] = columnIndex;
    }
  });
  for (const index of paragraphs) {
    const column = columnOf[index];
    if (column !== undefined) {
      lit[column] = true;
    }
  }
  return lit;
}

export function useLightboxFocus({ board, selected, onSelect }: UseLightboxFocusArgs): UseLightboxFocusReturn {
  const [hovered, setHovered] = React.useState<LightboxItemRef | null>(null);

  const focusedItem = React.useMemo((): LightboxResolvedItem | null => {
    if (!board) {
      return null;
    }
    const hoveredItem = hovered ? resolveLightboxItem(board, hovered) : undefined;
    if (hoveredItem) {
      return hoveredItem;
    }
    return (selected ? resolveLightboxItem(board, selected) : undefined) ?? null;
  }, [board, hovered, selected]);

  const focusedParagraphs = React.useMemo(
    () => new Set<number>(focusedItem?.paragraphs ?? []),
    [focusedItem]
  );

  const litColumns = React.useMemo(
    () => lightboxLitColumns(board?.ribbon ?? [], focusedParagraphs),
    [board, focusedParagraphs]
  );

  // Leaving an item clears hover only if it is still the hovered one, so a
  // fast move from one item to the next never blanks the ribbon in between.
  const leave = React.useCallback((ref: LightboxItemRef) => {
    setHovered((current) => (sameLightboxItem(current, ref) ? null : current));
  }, []);

  const bind = React.useCallback(
    (ref: LightboxItemRef): LightboxItemBinding => ({
      isHot: sameLightboxItem(hovered, ref),
      isSelected: sameLightboxItem(selected, ref),
      handlers: {
        onMouseEnter: () => setHovered(ref),
        onMouseLeave: () => leave(ref),
        onFocus: () => setHovered(ref),
        onBlur: () => leave(ref),
        onClick: () => {
          setHovered(null);
          onSelect(sameLightboxItem(selected, ref) ? null : ref);
        }
      }
    }),
    [hovered, leave, onSelect, selected]
  );

  return {
    hovered,
    focusedItem,
    focusedParagraphs,
    litColumns,
    bind,
    persistedState: NO_PERSISTENCE
  };
}
