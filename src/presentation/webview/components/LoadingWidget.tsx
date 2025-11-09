/**
 * LoadingWidget - Presentation layer
 * Displays a randomized assistant-working animation GIF.
 * The caller should render any specific status text above this widget.
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

export const LoadingWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  // Pick a random GIF on each render to ensure variety when component is shown/hidden
  const pickRandom = () => {
    const assets = window.proseMinonAssets;
    const arr = assets?.loadingGifs && assets.loadingGifs.length > 0
      ? assets.loadingGifs
      : (assets?.vhsLoadingGif ? [assets.vhsLoadingGif] : []);
    if (arr.length === 0) return { src: '', creditLabel: '', creditHref: '' };
    const idx = Math.floor(Math.random() * arr.length);
    const src = arr[idx];
    // Try to derive filename for credit lookup
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
      // ignore
    }
    return { src, creditLabel, creditHref };
  };

  const { src, creditLabel, creditHref } = pickRandom();

  return (
    <>
      <div className={`loading-vhs-container ${className}`}>
        <img
          src={src}
          alt="Assistant processing"
          className="loading-vhs-animation"
        />
      </div>
      {(creditLabel || creditHref) && (
        <div className="loading-credit">
          Animation by{' '}
          {creditHref ? (
            <a href={creditHref} target="_blank" rel="noopener noreferrer">{creditLabel || creditHref}</a>
          ) : (
            <>{creditLabel}</>
          )}
        </div>
      )}
    </>
  );
};
