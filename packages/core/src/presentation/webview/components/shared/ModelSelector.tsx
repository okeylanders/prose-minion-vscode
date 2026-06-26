/**
 * ModelSelector component - Presentation layer
 * Provides a compact browser trigger for choosing the AI model for a feature scope
 */

import * as React from 'react';
import { ModelScope, ModelOption } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { ModelBrowserModal } from '@components/shared/ModelBrowserModal';

interface ModelSelectorProps {
  scope: ModelScope;
  options: ModelOption[];
  value?: string;
  onChange: (scope: ModelScope, modelId: string) => void;
  onOpenBrowser?: () => void;
  label: string;
  helperText?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  scope,
  options,
  value,
  onChange,
  onOpenBrowser,
  label,
  helperText
}) => {
  const [browserOpen, setBrowserOpen] = React.useState(false);

  const selectedValue = value ?? (options.length > 0 ? options[0].id : '');
  const selectedOption = options.find(option => option.id === selectedValue);
  const selectedLabel = selectedOption?.label ?? selectedValue ?? 'Choose a model';

  const openBrowser = () => {
    onOpenBrowser?.();
    setBrowserOpen(true);
  };

  return (
    <div className="model-selector">
      <label className="model-selector-label">
        {label}
      </label>
      <button
        type="button"
        className="model-selector-trigger"
        onClick={openBrowser}
        disabled={options.length === 0}
        aria-label={`Browse ${label.toLowerCase()} options. Current model: ${selectedLabel}`}
        title={`Browse ${label.toLowerCase()} options`}
      >
        <span className="model-selector-current">{selectedLabel}</span>
        <Icon name="chevDown" size={15} />
      </button>
      {helperText && (
        <p className="model-selector-helper">{helperText}</p>
      )}
      <ModelBrowserModal
        open={browserOpen}
        scope={scope}
        options={options}
        value={selectedValue}
        label={label}
        onClose={() => setBrowserOpen(false)}
        onSelect={onChange}
      />
    </div>
  );
};
