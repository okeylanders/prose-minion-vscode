/**
 * A bubble's "Add reaction" button and its palette (ADR 2026-11-07 D8).
 *
 * The button is an icon (an outline smiley with a plus) in the bubble's
 * bottom-right corner, always shown, named "Add reaction" (Slice 3b). The
 * palette opens above it, and below it when there is no room above
 * (`workshopReactionPalettePlacement`, PR #245 L4).
 *
 * The palette is a popover of the 19 reactions in three labelled groups
 * (warm, curious, negative), each its own grid of five columns. Arrow keys
 * move through it: Left/Right by one in reading order, Up/Down by a row of
 * the grid on screen, into the next group's same column (clamped to its
 * row) past a group's edge (PR #245 L1); Home/End go to the ends. Enter or
 * Space picks. Escape closes it and returns focus to the button; a click
 * outside, or focus leaving it, closes it without moving focus (L3).
 *
 * While the room is locked the button stays focusable (`aria-disabled`, its
 * reason as its title) and does nothing; a lock taken while the palette is
 * open closes it and returns focus to the button (L2).
 *
 * It posts nothing itself: the caller sends the change and the next snapshot
 * says what the host kept.
 */

import * as React from 'react';
import {
  WORKSHOP_REACTIONS,
  WORKSHOP_REACTION_TONES,
  type WorkshopReactionId
} from '@shared/constants/workshopReactions';

/** Reactions per row of the grid; Up and Down move by this many. */
export const WORKSHOP_REACTION_PALETTE_COLUMNS = 5;

export interface WorkshopReactionPaletteProps {
  turnId: string;
  /** The writer's own reactions on this turn. */
  given: ReadonlySet<WorkshopReactionId>;
  /** True while the room's mutation lock is held, as for the bubble's other actions. */
  disabled?: boolean;
  onPick: (turnId: string, reaction: WorkshopReactionId, reacted: boolean) => void;
}

const GROUPS: readonly (readonly WorkshopReactionId[])[] = WORKSHOP_REACTION_TONES.map(({ tone }) =>
  WORKSHOP_REACTIONS.filter((reaction) => reaction.tone === tone).map((reaction) => reaction.id));
const ORDER: readonly WorkshopReactionId[] = GROUPS.flat();

/** Pixels between the button and the palette, as the stylesheet sets them. */
const PALETTE_GAP = 6;

/**
 * Which way the palette opens: up when it fits above the button, else down
 * when it fits below, else toward the side with more room.
 */
export function workshopReactionPalettePlacement(
  space: { above: number; below: number },
  paletteHeight: number,
  gap: number = PALETTE_GAP
): 'up' | 'down' {
  const needed = paletteHeight + gap;
  if (space.above >= needed) {
    return 'up';
  }
  if (space.below >= needed) {
    return 'down';
  }
  return space.above >= space.below ? 'up' : 'down';
}

/** The box the palette must stay inside: the nearest clipping ancestor's, or the viewport's. */
function clippingBounds(element: HTMLElement): { top: number; bottom: number } {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = window.getComputedStyle(parent).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
      const box = parent.getBoundingClientRect();
      return { top: Math.max(0, box.top), bottom: Math.min(window.innerHeight, box.bottom) };
    }
  }
  return { top: 0, bottom: window.innerHeight };
}

/** The outline smiley with a plus (inline, as the composer's comp glyphs are: no icon font). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const ReactionAddIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <circle cx="6.5" cy="9.5" r="5.25" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="4.8" cy="8.6" r="0.75" fill="currentColor" />
    <circle cx="8.2" cy="8.6" r="0.75" fill="currentColor" />
    <path d="M4.4 11.1c1.1 1.3 3.1 1.3 4.2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13 1.25v3.5M11.25 3h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/** The id of a bubble's "Add reaction" button, so its chips can return focus to it. */
export const workshopReactionAddButtonId = (turnId: string): string => `pm-ws-reaction-add-${turnId}`;

/**
 * Where a key moves focus from `index` in the flat order, over groups of
 * `sizes` laid out `columns` wide; undefined for a key the grid does not
 * handle. Up and Down keep the column, clamped to the target row's length.
 */
export function workshopReactionPaletteMove(
  key: string,
  index: number,
  sizes: readonly number[] = GROUPS.map((group) => group.length),
  columns: number = WORKSHOP_REACTION_PALETTE_COLUMNS
): number | undefined {
  const count = sizes.reduce((total, size) => total + size, 0);
  const starts = sizes.map((_, group) => sizes.slice(0, group).reduce((total, size) => total + size, 0));
  const group = starts.findIndex((start, at) => index >= start && index < start + sizes[at]);
  const offset = index - starts[group];
  const row = Math.floor(offset / columns);
  const column = offset % columns;
  /** The cell at `row`, `column` of `target`, the column clamped to that row's length. */
  const cell = (target: number, targetRow: number): number =>
    starts[target] + Math.min(targetRow * columns + column, sizes[target] - 1);
  switch (key) {
    case 'ArrowRight': return Math.min(count - 1, index + 1);
    case 'ArrowLeft': return Math.max(0, index - 1);
    case 'ArrowDown':
      if ((row + 1) * columns < sizes[group]) {
        return cell(group, row + 1);
      }
      return group + 1 < sizes.length ? cell(group + 1, 0) : index;
    case 'ArrowUp':
      if (row > 0) {
        return cell(group, row - 1);
      }
      return group > 0 ? cell(group - 1, Math.floor((sizes[group - 1] - 1) / columns)) : index;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return undefined;
  }
}

export const WorkshopReactionPalette: React.FC<WorkshopReactionPaletteProps> = ({
  turnId,
  given,
  disabled = false,
  onPick
}) => {
  const [open, setOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(0);
  // Unmeasured (undefined) while it opens: drawn hidden, and nothing in it focused,
  // so the browser never scrolls to a palette on the side that has no room.
  const [placement, setPlacement] = React.useState<'up' | 'down' | undefined>(undefined);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const paletteRef = React.useRef<HTMLDivElement>(null);
  const paletteId = `pm-ws-reaction-palette-${turnId}`;

  const close = React.useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // A lock taken while the palette is open closes it, and focus goes back to
  // the button, which stays focusable while locked (PR #245 L2).
  React.useEffect(() => {
    if (disabled && open) {
      close(true);
    }
  }, [disabled, open, close]);

  // Measured before paint, so a palette with no room above never shows clipped.
  React.useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const palette = paletteRef.current;
    if (!open || placement !== undefined || !trigger || !palette) {
      return;
    }
    const bounds = clippingBounds(trigger);
    const box = trigger.getBoundingClientRect();
    setPlacement(workshopReactionPalettePlacement(
      { above: box.top - bounds.top, below: bounds.bottom - box.bottom },
      palette.getBoundingClientRect().height
    ));
  }, [open, placement]);

  React.useEffect(() => {
    if (open && placement !== undefined) {
      optionRefs.current[focusIndex]?.focus();
    }
  }, [open, placement, focusIndex]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const next = workshopReactionPaletteMove(event.key, focusIndex);
    if (next !== undefined) {
      event.preventDefault();
      setFocusIndex(next);
    }
  };

  // Tab out of the palette, or any focus leaving it, closes it without
  // taking focus back (PR #245 L3). Focus moving to the button is the
  // button's own toggle to make.
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !wrapRef.current?.contains(next)) {
      close(false);
    }
  };

  const pick = (reaction: WorkshopReactionId) => {
    onPick(turnId, reaction, !given.has(reaction));
    close(true);
  };

  return (
    <div className="pm-ws-reaction-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        id={workshopReactionAddButtonId(turnId)}
        className="pm-ws-reaction-add"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? paletteId : undefined}
        aria-label="Add reaction"
        aria-disabled={disabled || undefined}
        title={disabled ? 'Wait for the room to finish before reacting' : 'Add reaction'}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            close(false);
            return;
          }
          setFocusIndex(0);
          setPlacement(undefined);
          setOpen(true);
        }}
      >
        <ReactionAddIcon />
      </button>
      {open && (
        <div
          id={paletteId}
          ref={paletteRef}
          className={`pm-ws-reaction-palette pm-ws-reaction-palette-${placement ?? 'up'}`}
          data-placement={placement}
          style={placement === undefined ? { visibility: 'hidden' } : undefined}
          role="dialog"
          aria-label="Add a reaction"
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        >
          {WORKSHOP_REACTION_TONES.map(({ tone, label }) => {
            const headingId = `${paletteId}-${tone}`;
            return (
              <div key={tone} className="pm-ws-reaction-group" role="group" aria-labelledby={headingId}>
                <div id={headingId} className="pm-ws-reaction-group-label">{label}</div>
                <div className="pm-ws-reaction-grid">
                  {WORKSHOP_REACTIONS.filter((reaction) => reaction.tone === tone).map((reaction) => {
                    const index = ORDER.indexOf(reaction.id);
                    const pressed = given.has(reaction.id);
                    return (
                      <button
                        key={reaction.id}
                        type="button"
                        ref={(element) => { optionRefs.current[index] = element; }}
                        className={`pm-ws-reaction-option${pressed ? ' pm-ws-reaction-option-on' : ''}`}
                        tabIndex={index === focusIndex ? 0 : -1}
                        aria-pressed={pressed}
                        aria-label={reaction.label}
                        title={pressed ? `Remove ${reaction.label}` : `${reaction.label}: ${reaction.meaning}`}
                        onFocus={() => setFocusIndex(index)}
                        onClick={() => pick(reaction.id)}
                      >
                        <span aria-hidden="true">{reaction.glyph}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
