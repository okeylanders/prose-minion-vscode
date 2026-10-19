/**
 * LightboxReadingPlaceholder — where a reading will land (ADR 2026-10-19 D6).
 *
 * Skeleton lines in place of a lens's reading: still before the first press
 * ("Not read yet"), shimmering while the call that reads it is in flight.
 * It never shows an estimate; the run line owns the cost.
 */
import * as React from 'react';

export interface LightboxReadingPlaceholderProps {
  /** The lens is being read right now. */
  live: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxReadingPlaceholder: React.FC<LightboxReadingPlaceholderProps> = ({ live }) => (
  <div className={`pm-lb-skeleton${live ? ' is-live' : ''}`} role={live ? 'status' : undefined}>
    <span className="pm-lb-skeleton-line is-95" aria-hidden="true" />
    <span className="pm-lb-skeleton-line is-80" aria-hidden="true" />
    <span className="pm-lb-skeleton-line is-60" aria-hidden="true" />
    <p className="pm-lb-skeleton-note">{live ? 'Reading…' : 'Not read yet. Runs with the next press.'}</p>
  </div>
);
