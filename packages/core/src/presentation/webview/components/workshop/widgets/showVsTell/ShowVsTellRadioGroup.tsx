/**
 * A custom radio group with the full WAI-ARIA radio keyboard pattern.
 *
 * The continuum and the length budget are styled buttons, so they carry the
 * pattern themselves: one tab stop on the selected option (the first when
 * nothing is selected), Arrow keys move focus and selection together with
 * wraparound, and Home/End jump to the ends. A disabled group has no tab stop
 * and ignores keys. Controlled presentation only: it raises `onChange` and
 * owns no selection state.
 */

import * as React from 'react';

export interface ShowVsTellRadioOption<Id extends string> {
  id: Id;
  content: React.ReactNode;
  /** Plain-text name for assistive technology, when the visible content is richer. */
  label?: string;
}

export interface ShowVsTellRadioGroupProps<Id extends string> {
  options: readonly ShowVsTellRadioOption<Id>[];
  value: Id | null;
  onChange: (id: Id) => void;
  disabled?: boolean;
  /** Exactly one of these names the group. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  optionClassName: (selected: boolean) => string;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

export function ShowVsTellRadioGroup<Id extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  ariaLabelledBy,
  className,
  optionClassName
}: ShowVsTellRadioGroupProps<Id>): React.ReactElement {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.id === value);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const move = (index: number): void => {
    const target = options[(index + options.length) % options.length];
    refs.current[(index + options.length) % options.length]?.focus();
    onChange(target.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (NEXT_KEYS.has(event.key)) {
      move(index + 1);
    } else if (PREVIOUS_KEYS.has(event.key)) {
      move(index - 1);
    } else if (event.key === 'Home') {
      move(0);
    } else if (event.key === 'End') {
      move(options.length - 1);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      className={className}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.id}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            tabIndex={index === tabStopIndex ? 0 : -1}
            className={optionClassName(selected)}
            disabled={disabled}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(option.id)}
          >
            {option.content}
          </button>
        );
      })}
    </div>
  );
}
