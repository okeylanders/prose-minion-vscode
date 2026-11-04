/** The controls every Conversation settings panel draws: rules, option cards and switches. */

import * as React from 'react';

export const SettingsRule: React.FC<{ label: string }> = ({ label }) => (
  <div className="pm-ws-tools-modal-rule">
    <span className="pm-ws-eyebrow">{label}</span>
    <hr />
  </div>
);

interface OptionCardProps {
  selected: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  name: string;
  description: string;
  onClick: () => void;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  selected,
  disabled,
  icon,
  name,
  description,
  onClick
}) => (
  <button
    className={`pm-ws-behavior-card ${selected ? 'pm-ws-behavior-card-selected' : ''}`}
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onClick}
  >
    <span className="pm-ws-behavior-card-top">
      {icon}
      <span className="pm-ws-behavior-card-name">{name}</span>
    </span>
    <span className="pm-ws-behavior-card-desc">{description}</span>
  </button>
);

interface SwitchProps {
  checked: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}

export const Switch: React.FC<SwitchProps> = ({ checked, disabled, label, onClick }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`pm-ws-behavior-toggle ${checked ? 'pm-ws-behavior-toggle-on' : ''}`}
    onClick={onClick}
  >
    <span className="pm-ws-behavior-toggle-thumb" />
  </button>
);
