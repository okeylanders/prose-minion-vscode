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
    { id: TabId.ANALYSIS, label: 'Analysis', icon: '🤖' },
    { id: TabId.SUGGESTIONS, label: 'Suggestions', icon: '💡' },
    { id: TabId.METRICS, label: 'Metrics', icon: '📊' }
  ];

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
