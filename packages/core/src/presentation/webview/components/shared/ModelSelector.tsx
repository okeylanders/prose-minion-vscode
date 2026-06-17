/**
 * ModelSelector component - Presentation layer
 * Provides a dropdown for choosing the AI model for a feature scope
 */

import * as React from 'react';
import { ModelScope, ModelOption } from '@shared/types';

interface ModelSelectorProps {
  scope: ModelScope;
  options: ModelOption[];
  value?: string;
  onChange: (scope: ModelScope, modelId: string) => void;
  label: string;
  helperText?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  scope,
  options,
  value,
  onChange,
  label,
  helperText
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    if (!newValue || newValue === value) {
      return;
    }
    onChange(scope, newValue);
  };

  const selectedValue = value ?? (options.length > 0 ? options[0].id : '');

  return (
    <div className="model-selector">
      <label className="model-selector-label">
        {label}
      </label>
      <select
        title="{label} dropdown"
        className="model-selector-dropdown"
        value={selectedValue}
        onChange={handleChange}
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className="model-selector-helper">{helperText}</p>
      )}
    </div>
  );
};
