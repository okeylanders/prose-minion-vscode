/**
 * A bubble's "Add reaction" button and its palette (ADR 2026-11-07 D8).
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
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
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

  React.useEffect(() => {
    if (open) {
      optionRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

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
        aria-disabled={disabled || undefined}
        title={disabled ? 'Wait for the room to finish before reacting' : 'React to this reply'}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            close(false);
            return;
          }
          setFocusIndex(0);
          setOpen(true);
        }}
      >
        <span aria-hidden="true">☺</span> Add reaction
      </button>
      {open && (
        <div
          id={paletteId}
          className="pm-ws-reaction-palette"
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
