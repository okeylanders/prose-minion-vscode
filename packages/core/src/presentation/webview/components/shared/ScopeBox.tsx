import React from 'react';
import { TextSourceMode, MessageType, MessageSource } from '../../../../shared/types';
import { VSCodeAPI } from '../../types/vscode';
import { TabBar, Tab } from './TabBar';

/**
 * Props for the ScopeBox component.
 *
 * ScopeBox is a reusable component for selecting text source scope
 * (Active File, Manuscripts, Chapters, Selection) with an associated
 * path/pattern input field.
 *
 * The component handles ALL message posting internally - simply provide the
 * vscode API and source identifier. The parent handles state updates via
 * onModeChange (and can set pathText based on mode if needed).
 */
export interface ScopeBoxProps {
  // Current state (controlled component)
  mode: TextSourceMode;
  pathText: string;

  // Event handlers
  onModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;

  // Message posting (component handles internally)
  vscode: VSCodeAPI;
  source: MessageSource; // e.g., 'webview.search.tab' or 'webview.metrics.tab'

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
 * Handles all message posting internally - no need for click handlers!
 *
 * Used across SearchTab (Word Search, Category Search) and MetricsTab.
 *
 * @example
 * ```tsx
 * <ScopeBox
 *   mode={metrics.sourceMode}
 *   pathText={metrics.pathText}
 *   onModeChange={(mode) => {
 *     metrics.setSourceMode(mode);
 *     if (mode === 'selection') {
 *       metrics.setPathText('[selected text]');
 *     }
 *   }}
 *   onPathTextChange={(text) => metrics.setPathText(text)}
 *   vscode={vscode}
 *   source="webview.search.tab"
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
  vscode,
  source,
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

  // Define scope tabs
  const scopeTabs: Tab<TextSourceMode>[] = [
    { id: 'activeFile', label: 'Active File', ariaLabel: activeFileAriaLabel },
    { id: 'manuscript', label: 'Manuscripts', ariaLabel: manuscriptsAriaLabel },
    { id: 'chapters', label: 'Chapters', ariaLabel: chaptersAriaLabel },
    { id: 'selection', label: 'Selection', ariaLabel: selectionAriaLabel }
  ];

  const handleModeClick = (newMode: TextSourceMode) => {
    onModeChange(newMode);

    // Post appropriate message based on mode
    switch (newMode) {
      case 'activeFile':
        vscode.postMessage({
          type: MessageType.REQUEST_ACTIVE_FILE,
          source,
          payload: {},
          timestamp: Date.now()
        });
        break;
      case 'manuscript':
        vscode.postMessage({
          type: MessageType.REQUEST_MANUSCRIPT_GLOBS,
          source,
          payload: {},
          timestamp: Date.now()
        });
        break;
      case 'chapters':
        vscode.postMessage({
          type: MessageType.REQUEST_CHAPTER_GLOBS,
          source,
          payload: {},
          timestamp: Date.now()
        });
        break;
      case 'selection':
        // Selection mode doesn't post a message
        // Parent handles setting pathText via onModeChange
        break;
    }
  };

  return (
    <div className="input-container">
      <label className="block text-sm font-medium mb-2">Scope:</label>
      <TabBar
        tabs={scopeTabs}
        activeTab={mode}
        onTabChange={handleModeClick}
        disabled={disabled}
        ariaLabel={scopeAriaLabel}
      />

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
