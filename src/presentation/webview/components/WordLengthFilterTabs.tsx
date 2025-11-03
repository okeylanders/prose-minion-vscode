/**
 * WordLengthFilterTabs component
 * Provides a tab bar for filtering word frequency results by minimum character length
 */

import * as React from 'react';

interface WordLengthFilterTabsProps {
  activeFilter: number;
  onFilterChange: (minLength: number) => void;
  disabled?: boolean;
}

export const WordLengthFilterTabs: React.FC<WordLengthFilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  disabled = false
}) => {
  const filterOptions = [
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
    { value: 5, label: '5+' },
    { value: 6, label: '6+' }
  ];

  return (
    <div className="word-length-filter-tabs">
      <label className="filter-label">Minimum Word Length:</label>
      <div className="filter-buttons">
        {filterOptions.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-tab ${activeFilter === value ? 'active' : ''}`}
            onClick={() => onFilterChange(value)}
            disabled={disabled}
            aria-pressed={activeFilter === value}
            title={`Show words with ${value}+ characters`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
