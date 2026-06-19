/**
 * TabBar - Universal tab navigation component
 *
 * Generic, reusable tab bar that works for main tabs, subtabs, tool selectors,
 * and scope selectors. Supports optional icons, disabled states, and comprehensive
 * accessibility features.
 *
 * @example Main tabs with icons (App.tsx)
 * ```tsx
 * <TabBar
 *   tabs={[
 *     { id: TabId.ANALYSIS, label: 'Assistant', icon: '🤖' },
 *     { id: TabId.SEARCH, label: 'Search', icon: '🔎' },
 *     { id: TabId.METRICS, label: 'Metrics', icon: '📊' },
 *     { id: TabId.UTILITIES, label: 'Dictionary', icon: '📕' }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   ariaLabel="Main navigation"
 * />
 * ```
 *
 * @example Subtabs without icons (SearchTab, MetricsTab)
 * ```tsx
 * <TabBar
 *   tabs={[
 *     { id: 'word', label: 'Word Search' },
 *     { id: 'category', label: 'Category Search' }
 *   ]}
 *   activeTab={activeSubtool}
 *   onTabChange={setActiveSubtool}
 *   ariaLabel="Search tools"
 * />
 * ```
 *
 * @example Tool selector (MetricsTab)
 * ```tsx
 * <TabBar
 *   tabs={[
 *     { id: 'stats', label: 'Prose Stats', icon: '📝' },
 *     { id: 'flags', label: 'Style Flags', icon: '🚩' },
 *     { id: 'freq', label: 'Word Frequency', icon: '🔢' }
 *   ]}
 *   activeTab={activeTool}
 *   onTabChange={setActiveTool}
 *   ariaLabel="Metrics tools"
 * />
 * ```
 *
 * @example Scope selector with disabled state (ScopeBox)
 * ```tsx
 * <TabBar
 *   tabs={[
 *     { id: 'activeFile', label: 'Active File', ariaLabel: 'Search active file only' },
 *     { id: 'manuscript', label: 'Manuscripts', ariaLabel: 'Search manuscripts folder' }
 *   ]}
 *   activeTab={mode}
 *   onTabChange={handleModeClick}
 *   disabled={isLoading}
 *   ariaLabel="Source scope"
 * />
 * ```
 */

import React from 'react';

/**
 * Generic tab definition
 * Works for main tabs, subtabs, tool selectors, and scope selectors
 */
export interface Tab<T = string> {
  /** Unique identifier for the tab (can be enum, string, number, etc.) */
  id: T;
  /** Display text shown on the tab */
  label: string;
  /** Optional icon — an emoji string OR a React node (e.g. <Icon name="bot" />). */
  icon?: React.ReactNode;
  /** Optional specific aria-label for accessibility (falls back to label if not provided) */
  ariaLabel?: string;
}

/**
 * Visual variant (Pass-2 Wave-3 FM design):
 * - `cards`   — icon-above-label rounded cards in a grid (main navigation).
 * - `segment` — horizontal segmented control (sub-tabs, scope, tools). Default.
 */
export type TabBarVariant = 'cards' | 'segment';

/**
 * TabBar component props
 * Generic type parameter allows any ID type (TabId enum, string, number, etc.)
 */
export interface TabBarProps<T = string> {
  /** Array of tab definitions to render */
  tabs: Tab<T>[];
  /** Currently active tab ID */
  activeTab: T;
  /** Callback fired when user clicks a tab */
  onTabChange: (tabId: T) => void;
  /** Optional - disables all tab buttons (useful for loading states) */
  disabled?: boolean;
  /** Optional - aria-label for the tab list container (for screen readers) */
  ariaLabel?: string;
  /** Optional - additional CSS class name for custom styling */
  className?: string;
  /** Visual variant — `cards` (main nav) or `segment` (default). */
  variant?: TabBarVariant;
}

export const TabBar = <T,>({
  tabs,
  activeTab,
  onTabChange,
  disabled = false,
  ariaLabel,
  className = '',
  variant = 'segment'
}: TabBarProps<T>) => {
  const isCards = variant === 'cards';
  const containerClass = isCards ? 'pm-tabs' : 'pm-seg';
  const itemClass = isCards ? 'pm-tab' : 'pm-seg-btn';

  return (
    <div
      className={`${containerClass} ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(tab => (
        <button
          key={String(tab.id)}
          className={`${itemClass} ${activeTab === tab.id ? 'active' : ''}`.trim()}
          onClick={() => onTabChange(tab.id)}
          disabled={disabled}
          role="tab"
          aria-selected={activeTab === tab.id ? 'true' : 'false'}
          aria-label={tab.ariaLabel || tab.label}
        >
          {tab.icon && <span className="pm-tab-icon">{tab.icon}</span>}
          <span className="pm-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
