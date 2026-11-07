/**
 * A bubble's "Add reaction" button and its palette (ADR 2026-11-07 D8).
 *
 * The palette is a popover of the 19 reactions in three labelled groups
 * (warm, curious, negative). Arrow keys move through it (Left/Right by one,
 * Up/Down by a row, Home/End to the ends), Enter or Space picks, and Escape
 * or a click outside closes it and returns focus to the button. A reaction
 * the writer already gave shows as pressed, and picking it removes it.
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

const ORDER: readonly WorkshopReactionId[] = WORKSHOP_REACTION_TONES.flatMap(({ tone }) =>
  WORKSHOP_REACTIONS.filter((reaction) => reaction.tone === tone).map((reaction) => reaction.id));

/** Where a key moves focus from `index`, or undefined for a key the grid does not handle. */
export function workshopReactionPaletteMove(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowRight': return Math.min(count - 1, index + 1);
    case 'ArrowLeft': return Math.max(0, index - 1);
    case 'ArrowDown': return Math.min(count - 1, index + WORKSHOP_REACTION_PALETTE_COLUMNS);
    case 'ArrowUp': return Math.max(0, index - WORKSHOP_REACTION_PALETTE_COLUMNS);
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

  // A lock taken while the palette is open closes it.
  React.useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

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
    const next = workshopReactionPaletteMove(event.key, focusIndex, ORDER.length);
    if (next !== undefined) {
      event.preventDefault();
      setFocusIndex(next);
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
        className="pm-ws-reaction-add"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? paletteId : undefined}
        disabled={disabled}
        title={disabled ? 'Wait for the room to finish before reacting' : 'React to this reply'}
        onClick={() => {
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
