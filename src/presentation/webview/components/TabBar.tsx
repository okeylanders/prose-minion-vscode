/**
 * TabBar component - Presentation layer
 * Handles tab navigation UI
 */

import * as React from 'react';
import { TabId } from '../../../shared/types';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: TabId.ANALYSIS, label: 'Analysis' },
    { id: TabId.SUGGESTIONS, label: 'Suggestions' },
    { id: TabId.METRICS, label: 'Metrics' }
  ];

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
