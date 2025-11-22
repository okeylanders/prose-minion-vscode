import React from 'react';
import { TextSourceMode } from '@shared/types/sources';

/**
 * Props for the ScopeBox component.
 *
 * ScopeBox is a reusable component for selecting text source scope
 * (Active File, Manuscripts, Chapters, Selection) with an associated
 * path/pattern input field.
 */
export interface ScopeBoxProps {
  // Current state (controlled component)
  mode: TextSourceMode;
  pathText: string;

  // Event handlers
  onModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;

  // Optional side effects (for message posting when mode changes)
  onActiveFileClick?: () => void;
  onManuscriptsClick?: () => void;
  onChaptersClick?: () => void;
  onSelectionClick?: () => void;

  // UI customization
  disabled?: boolean;
  pathInputId?: string;
  pathPlaceholder?: string; // If not provided, uses default based on mode

  // Accessibility (optional overrides)
  scopeAriaLabel?: string;
  activeFileAriaLabel?: string;
  manuscriptsAriaLabel?: string;
  chaptersAriaLabel?: string;
  selectionAriaLabel?: string;
}

/**
 * ScopeBox - Reusable scope selector component
 *
 * Displays a tab bar with 4 scope options and a path/pattern input field.
 * Used across SearchTab (Word Search, Category Search) and MetricsTab.
 *
 * @example
 * ```tsx
 * <ScopeBox
 *   mode={metrics.sourceMode}
 *   pathText={metrics.pathText}
 *   onModeChange={(mode) => metrics.setSourceMode(mode)}
 *   onPathTextChange={(text) => metrics.setPathText(text)}
 *   onActiveFileClick={() => vscode.postMessage({ type: MessageType.REQUEST_ACTIVE_FILE, ... })}
 *   disabled={loading}
 *   pathInputId="pm-search-path-input"
 * />
 * ```
 */
export const ScopeBox: React.FC<ScopeBoxProps> = ({
  mode,
  pathText,
  onModeChange,
  onPathTextChange,
  onActiveFileClick,
  onManuscriptsClick,
  onChaptersClick,
  onSelectionClick,
  disabled = false,
  pathInputId = 'pm-scope-path-input',
  pathPlaceholder,
  scopeAriaLabel,
  activeFileAriaLabel = 'Search active file',
  manuscriptsAriaLabel = 'Search manuscripts',
  chaptersAriaLabel = 'Search chapters',
  selectionAriaLabel = 'Search selection',
}) => {
  // Default placeholder based on mode
  const defaultPlaceholder = mode === 'selection'
    ? 'Selected text'
    : 'e.g. prose/**/*.md';

  const placeholder = pathPlaceholder ?? defaultPlaceholder;

  const handleModeClick = (newMode: TextSourceMode, sideEffect?: () => void) => {
    onModeChange(newMode);
    if (sideEffect) {
      sideEffect();
    }
  };

  return (
    <div className="input-container">
      <label className="block text-sm font-medium mb-2">Scope:</label>
      <div
        className="tab-bar"
        style={{ marginBottom: '8px' }}
        role="tablist"
        aria-label={scopeAriaLabel}
      >
        <button
          className={`tab-button ${mode === 'activeFile' ? 'active' : ''}`}
          onClick={() => handleModeClick('activeFile', onActiveFileClick)}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'activeFile'}
          aria-label={activeFileAriaLabel}
        >
          <span className="tab-label">Active File</span>
        </button>
        <button
          className={`tab-button ${mode === 'manuscript' ? 'active' : ''}`}
          onClick={() => handleModeClick('manuscript', onManuscriptsClick)}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'manuscript'}
          aria-label={manuscriptsAriaLabel}
        >
          <span className="tab-label">Manuscripts</span>
        </button>
        <button
          className={`tab-button ${mode === 'chapters' ? 'active' : ''}`}
          onClick={() => handleModeClick('chapters', onChaptersClick)}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'chapters'}
          aria-label={chaptersAriaLabel}
        >
          <span className="tab-label">Chapters</span>
        </button>
        <button
          className={`tab-button ${mode === 'selection' ? 'active' : ''}`}
          onClick={() => handleModeClick('selection', onSelectionClick)}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'selection'}
          aria-label={selectionAriaLabel}
        >
          <span className="tab-label">Selection</span>
        </button>
      </div>

      <label className="block text-sm font-medium mb-2" htmlFor={pathInputId}>
        Path / Pattern
      </label>
      <input
        id={pathInputId}
        type="text"
        className="w-full"
        value={pathText}
        onChange={(e) => onPathTextChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};
