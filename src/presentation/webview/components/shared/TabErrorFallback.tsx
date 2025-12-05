import * as React from 'react';

interface TabErrorFallbackProps {
  tabName: string;
  error?: Error;
  onRetry?: () => void;
}

export const TabErrorFallback: React.FC<TabErrorFallbackProps> = ({
  tabName,
  error,
  onRetry
}) => (
  <div className="tab-error-fallback" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
    minHeight: '200px'
  }}>
    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
    <h3 style={{ margin: '0 0 0.5rem 0' }}>Error in {tabName}</h3>
    <p style={{
      color: 'var(--vscode-descriptionForeground)',
      margin: '0 0 1rem 0',
      maxWidth: '300px'
    }}>
      {error?.message || 'Something went wrong rendering this tab.'}
    </p>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px'
          }}
        >
          Retry
        </button>
      )}
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          border: 'none',
          borderRadius: '2px'
        }}
      >
        Reload Extension
      </button>
    </div>
  </div>
);
