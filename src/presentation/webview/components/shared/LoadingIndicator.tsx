/**
 * LoadingIndicator - Unified loading component
 * Consolidates all loading states (spinner, status, progress, GIF, guide ticker)
 * Replaces LoadingWidget and scattered loading JSX across tabs
 */

import * as React from 'react';

declare global {
  interface Window {
    proseMinonAssets?: {
      vhsLoadingGif?: string;
      loadingGifs?: string[];
      loadingGifList?: string[];
      loadingGifCredits?: Record<string, { label: string; href: string } | string>;
    };
  }
}

interface LoadingIndicatorProps {
  /** Whether loading state is active */
  isLoading: boolean;
  /** Status message from backend (optional, uses defaultMessage if not provided) */
  statusMessage?: string;
  /** Default message when no status message provided */
  defaultMessage: string;
  /** Guide names for Analysis tab guide ticker (optional) */
  guideNames?: string;
  /** Progress tracking (optional, for operations with known progress) */
  progress?: {
    current: number;        // Items processed
    total: number;          // Total items to process
    label?: string;         // Optional custom label
  };
  /** Cancel callback (optional, for cancellable operations) */
  onCancel?: () => void;
  /** Additional CSS class */
  className?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  statusMessage,
  defaultMessage,
  guideNames,
  progress,
  onCancel,
  className = ''
}) => {
  // Don't render if not loading
  if (!isLoading) return null;

  // Pick random GIF (consolidated from LoadingWidget)
  const pickRandomGif = () => {
    const assets = window.proseMinonAssets;
    const arr = assets?.loadingGifs && assets.loadingGifs.length > 0
      ? assets.loadingGifs
      : (assets?.vhsLoadingGif ? [assets.vhsLoadingGif] : []);
    if (arr.length === 0) return { src: '', creditLabel: '', creditHref: '' };
    const idx = Math.floor(Math.random() * arr.length);
    const src = arr[idx];

    // Derive filename for credit lookup
    let creditLabel = '';
    let creditHref = '';
    try {
      const url = new URL(src, window.location.origin);
      const filename = url.pathname.split('/').pop() || '';
      const entry = assets?.loadingGifCredits?.[filename];
      if (entry) {
        if (typeof entry === 'string') {
          creditLabel = entry;
        } else {
          creditLabel = entry.label;
          creditHref = entry.href;
        }
      }
    } catch {
      // ignore parsing errors
    }
    return { src, creditLabel, creditHref };
  };

  const { src, creditLabel, creditHref } = pickRandomGif();

  return (
    <div className={`loading-indicator ${className}`}>
      <div className="loading-header">
        <div className="spinner"></div>
        <div className="loading-text">
          <div>{statusMessage || defaultMessage}</div>
          {guideNames && (
            <div className="guide-ticker-container">
              <div className="guide-ticker">{guideNames}</div>
            </div>
          )}
        </div>
        {onCancel && (
          <button onClick={onCancel} className="cancel-button" title="Cancel operation">
            ✕
          </button>
        )}
      </div>

      {/* Progress bar (optional) */}
      {progress && (
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{
              width: `${(progress.current / progress.total) * 100}%`
            }}
          />
          <div className="progress-label">
            {progress.label || `${progress.current} / ${progress.total}`}
          </div>
        </div>
      )}

      {/* Animated GIF (consolidated from LoadingWidget.tsx) */}
      <div className="loading-vhs-container">
        <img
          src={src}
          alt="Assistant processing"
          className="loading-vhs-animation"
        />
      </div>
      {(creditLabel || creditHref) && (
        <div className="loading-credit">
          {creditHref ? (
            <a href={creditHref} target="_blank" rel="noopener noreferrer">
              {creditLabel || creditHref}
            </a>
          ) : (
            <>{creditLabel}</>
          )}
        </div>
      )}
    </div>
  );
};
