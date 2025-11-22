/**
 * SearchTab component - Orchestrator for search subtabs
 * Routes between Word Search and Category Search panels
 */

import * as React from 'react';
import { WordSearchPanel } from '@components/search/WordSearchPanel';
import { CategorySearchPanel } from '@components/search/CategorySearchPanel';
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

export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  search,
  metrics,
  wordSearchSettings,
  modelsSettings
}) => {
  const [activeSubtool, setActiveSubtool] = React.useState<SearchSubtool>('word');

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Search</h2>

      {/* Subtool tabs */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        <button
          className={`tab-button ${activeSubtool === 'word' ? 'active' : ''}`}
          onClick={() => setActiveSubtool('word')}
        >
          <span className="tab-label">Word Search</span>
        </button>
        <button
          className={`tab-button ${activeSubtool === 'category' ? 'active' : ''}`}
          onClick={() => setActiveSubtool('category')}
        >
          <span className="tab-label">Category Search</span>
        </button>
      </div>

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
};
