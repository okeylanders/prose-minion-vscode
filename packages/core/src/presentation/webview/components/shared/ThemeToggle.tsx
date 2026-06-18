import * as React from 'react';

interface ThemeToggleProps {
  /** true = follow the active VS Code theme; false = pinned warm-dark */
  following: boolean;
  onChange: (following: boolean) => void;
}

/**
 * Sidebar palette toggle that sits just below the balance pill in the header.
 * Off (default) keeps Prose Minion's pinned warm-dark brand palette; on follows
 * the user's active VS Code color theme via [data-pm-theme="follow"] on
 * .app-container. A compact thumb switch that goes coral when following.
 */
export const ThemeToggle = React.memo<ThemeToggleProps>(({ following, onChange }) => {
  return (
    <div className="pm-theme-toggle">
      <span className="pm-theme-toggle-label">
        {following ? 'Editor theme' : 'Warm dark'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={following}
        aria-label="Follow VS Code theme"
        title={
          following
            ? 'Following your VS Code theme — click to pin the warm-dark palette'
            : 'Pinned warm-dark palette — click to follow your VS Code theme'
        }
        className="pm-theme-switch"
        onClick={() => onChange(!following)}
      >
        <span className="pm-theme-thumb" />
      </button>
    </div>
  );
});

ThemeToggle.displayName = 'ThemeToggle';
