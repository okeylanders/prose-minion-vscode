/**
 * DictionaryOptionSwitch - Presentation layer
 *
 * One optional dictionary section (Topic & Related Lexicon, Chromatic
 * Palettes) as an accessible switch. The accessible name is the label plus
 * its kind, and the description explains what the section adds.
 */

import * as React from 'react';

export interface DictionaryOptionSwitchProps {
  /** Prefix for the label, kind, and description element ids. */
  id: string;
  label: string;
  kind: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

export const DictionaryOptionSwitch: React.FC<DictionaryOptionSwitchProps> = ({
  id,
  label,
  kind,
  description,
  checked,
  disabled,
  onChange
}) => (
  <button
    type="button"
    role="switch"
    className="pm-dictionary-option"
    aria-checked={checked}
    aria-labelledby={`${id}-label ${id}-kind`}
    aria-describedby={`${id}-description`}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <span className="pm-dictionary-option-copy">
      <span className="pm-dictionary-option-heading">
        <span id={`${id}-label`}>{label}</span>
        <span id={`${id}-kind`} className="pm-dictionary-option-kind">{kind}</span>
      </span>
      <span id={`${id}-description`} className="pm-dictionary-option-description">
        {description}
      </span>
    </span>
    <span className="pm-dictionary-option-control" aria-hidden="true">
      <span>{checked ? 'On' : 'Off'}</span>
      <span className="pm-dictionary-option-track">
        <span className="pm-dictionary-option-thumb" />
      </span>
    </span>
  </button>
);
