/**
 * SearchTab component - Orchestrator for search subtabs
 * Routes between Word Search and Category Search panels
 */

import * as React from 'react';
import { WordSearchPanel } from '@components/search/WordSearchPanel';
import { CategorySearchPanel } from '@components/search/CategorySearchPanel';
import { TabBar, Tab } from '../shared/TabBar';
import { VSCodeAPI } from '../../types/vscode';
import { UseSearchReturn } from '@hooks/domain/useSearch';
import { UseMetricsReturn } from '@hooks/domain/useMetrics';
import { UseWordSearchSettingsReturn } from '@hooks/domain/useWordSearchSettings';
import { UseModelsSettingsReturn } from '@hooks/domain/useModelsSettings';

type SearchSubtool = 'word' | 'category';

interface SearchTabProps {
  vscode: VSCodeAPI;
  search: UseSearchReturn;
  metrics: UseMetricsReturn;
  wordSearchSettings: UseWordSearchSettingsReturn;
  modelsSettings: UseModelsSettingsReturn;
}

export const SearchTab = React.memo<SearchTabProps>(({
  vscode,
  search,
  metrics,
  wordSearchSettings,
  modelsSettings
}) => {
  const [activeSubtool, setActiveSubtool] = React.useState<SearchSubtool>('word');

  const subtabs: Tab<SearchSubtool>[] = [
    { id: 'word', label: 'Word Search' },
    { id: 'category', label: 'Category Search' }
  ];

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Search</h2>

      {/* Subtool tabs */}
      <TabBar
        tabs={subtabs}
        activeTab={activeSubtool}
        onTabChange={setActiveSubtool}
        ariaLabel="Search tools"
        className="mb-4"
      />

      {/* Route to appropriate panel */}
      {activeSubtool === 'word' && (
        <WordSearchPanel
          vscode={vscode}
          search={search}
          metrics={metrics}
          wordSearchSettings={wordSearchSettings}
        />
      )}

      {activeSubtool === 'category' && (
        <CategorySearchPanel
          vscode={vscode}
          search={search}
          metrics={metrics}
          wordSearchSettings={wordSearchSettings}
          modelsSettings={modelsSettings}
        />
      )}
    </div>
  );
});

SearchTab.displayName = 'SearchTab';
