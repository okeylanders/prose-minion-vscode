/**
 * "What commits" — the live preview of the counted artifact body (Sprint 05).
 *
 * It prints the projection's exact lines and counts them with the same
 * `.length` the projection reports, so the number the writer watches is the
 * number the host will enforce. Past the 600-character ceiling the counter
 * and meter turn red and an accessible blocker explains the fix; the colour is
 * never the only signal.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { ShowVsTellArtifactUsage } from './showVsTellAuthoringTypes';

export interface ShowVsTellPayloadStripProps {
  usage: ShowVsTellArtifactUsage | null;
}

export const ShowVsTellPayloadStrip: React.FC<ShowVsTellPayloadStripProps> = ({ usage }) => {
  const over = usage !== null && usage.characters > usage.budget;
  const blockerId = 'pm-ws-svt-payload-blocker';
  return (
    <div className="pm-ws-svt-payload">
      <div className="pm-ws-svt-payload-cap">
        <span>What commits</span>
        {usage && (
          <span className={`pm-ws-svt-payload-ceil${over ? ' pm-ws-svt-payload-over' : ''}`}>
            {usage.characters.toLocaleString()} / {usage.budget.toLocaleString()} chars
          </span>
        )}
      </div>
      {usage === null ? (
        <p className="pm-ws-svt-payload-none">nothing kept yet — commit stays off</p>
      ) : (
        <>
          <pre className="pm-ws-svt-payload-lines" aria-label="Artifact lines that would commit">
            {usage.text}
          </pre>
          <div
            className={`pm-ws-svt-meter${over ? ' pm-ws-svt-meter-over' : ''}`}
            role="progressbar"
            aria-label="Commit payload budget"
            aria-valuemin={0}
            aria-valuemax={usage.budget}
            aria-valuenow={Math.min(usage.characters, usage.budget)}
            aria-describedby={over ? blockerId : undefined}
          >
            <span
              /* Dynamic data-driven fill; the stylesheet owns the look. */
              style={{
                '--pm-ws-svt-meter-fill': `${Math.min(
                  100,
                  (usage.characters / usage.budget) * 100
                )}%`
              } as React.CSSProperties}
            />
          </div>
          {over && (
            <p className="pm-ws-svt-blocker" id={blockerId} role="alert">
              <Icon name="alert" size={12} />
              <span>
                Over the {usage.budget.toLocaleString()}-character ceiling by{' '}
                {(usage.characters - usage.budget).toLocaleString()}. Switch kept variants to
                direction only, keep fewer, or shorten the note.
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
};
