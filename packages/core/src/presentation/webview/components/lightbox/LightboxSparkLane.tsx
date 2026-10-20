/**
 * LightboxSparkLane — open doors (ADR 2026-10-19 D7; Slice 4). Not a tile
 * among tiles: a lane of its own under the grid, of offers phrased as
 * questions. Each spark shows the words it stands on, counted by code, and
 * the paragraphs it lives in; hovering lights them, Enter or a click pins it.
 *
 * "Not for me" sets a spark aside and Undo brings back the latest. Both ask
 * the host, which marks the board's own spark (`LightboxSparkLane`): the lane
 * draws what the board says and keeps no dismissal of its own. The lane
 * shows the honesty states every reading frame does: not read, reading,
 * failed, stale, withheld, and an empty answer with its friction.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxSparkTile } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { supportLabel } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { lightboxLensView, pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxSparkLane } from '@hooks/domain/lightbox/lightboxSparks';
import { LightboxItemButton, lightboxItemClassName } from '@components/lightbox/LightboxItemButton';
import {
  LightboxStaleNote,
  LightboxWithheldBlocks,
  LightboxWithheldClaims
} from '@components/lightbox/LightboxReadingFrame';
import { LightboxReadingPlaceholder } from '@components/lightbox/LightboxReadingPlaceholder';

/** What a spark's Bring button shows; absent when the board offers no Bring. */
export interface LightboxSparkBring {
  label: string;
  disabled: boolean;
  /** Why it cannot be brought, or what happened; shown under the card. */
  note?: string;
  pressed: boolean;
}

export interface LightboxSparkLaneProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  /** Absent: the lane offers no "Not for me". */
  onDismiss?: (tileId: string, dismissed: boolean) => void;
  bring?: { view: (spark: LightboxSparkTile) => LightboxSparkBring; onBring: (tileId: string) => void };
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSparkLane: React.FC<LightboxSparkLaneProps> = ({ board, bind, onDismiss, bring }) => {
  const view = lightboxLensView(board, 'spark');
  const lane = lightboxSparkLane(board);
  const read = view.phase === 'ok';
  const nothing = read && view.tiles.length === 0 && view.withheldBlocks.length === 0 && view.withheldClaims.length === 0;
  return (
    <section className="pm-lb-spark-lane" aria-label="Spark lane">
      <div className="pm-lb-spark-head">
        <p className="pm-lb-tile-eyebrow">Spark · open doors</p>
        <span className="pm-lb-spark-note">Offers, not fixes. Nothing here grades the chapter.</span>
      </div>
      {view.stale && <LightboxStaleNote />}
      {(view.phase === 'not-run' || view.phase === 'reading') && <LightboxReadingPlaceholder live={view.phase === 'reading'} />}
      {view.notice && (
        <p className={`pm-lb-reading-notice${read ? '' : ' is-failed'}`} role={read ? undefined : 'alert'}>{view.notice}</p>
      )}
      <LightboxWithheldBlocks blocks={view.withheldBlocks} />
      {nothing && (
        <div className="pm-lb-empty-reading">
          <p>No open door: the reading found no question these paragraphs leave open.</p>
          {view.friction && <p className="pm-lb-empty-friction"><b>Where this reading strains:</b> {view.friction}</p>}
        </div>
      )}
      {read && lane.shown.length > 0 && (
        <div className="pm-lb-spark-grid">
          {lane.shown.map((spark) => {
            const binding = bind({ kind: 'reading', tileId: spark.id });
            const action = bring?.view(spark);
            return (
              <div key={spark.id} className={lightboxItemClassName('pm-lb-spark', binding)}>
                <LightboxItemButton binding={binding} className="pm-lb-spark-body">
                  <span className="pm-lb-spark-title">{spark.title}</span>
                  <span className="pm-lb-spark-question">{spark.claim}</span>
                  <span className="pm-lb-spark-support">
                    {spark.support.filter((term) => term.count > 0).map(supportLabel).join(' · ')}
                  </span>
                  <span className="pm-lb-spark-where">{spark.paragraphs.map((index) => `¶${index}`).join(' ')}</span>
                </LightboxItemButton>
                <div className="pm-lb-spark-actions">
                  {bring && action && (
                    <button
                      type="button"
                      className={`pm-lb-button${action.pressed ? ' is-on' : ''}`}
                      disabled={action.disabled}
                      aria-pressed={action.pressed}
                      onClick={() => bring.onBring(spark.id)}
                    >
                      {action.label}
                    </button>
                  )}
                  {onDismiss && (
                    <button type="button" className="pm-lb-button is-ghost" onClick={() => onDismiss(spark.id, true)}>
                      Not for me
                    </button>
                  )}
                </div>
                {action?.note && <p className="pm-lb-spark-bring-note" role="status">{action.note}</p>}
              </div>
            );
          })}
        </div>
      )}
      {read && lane.setAside.length > 0 && (
        <p className="pm-lb-spark-set-aside">
          {pluralize(lane.setAside.length, 'spark')} set aside.{' '}
          {onDismiss && (
            <button type="button" className="pm-lb-link" onClick={() => onDismiss(lane.setAside[0].id, false)}>
              Undo
            </button>
          )}
          <span className="pm-lb-spark-undo-note"> Brings back “{lane.setAside[0].title}”.</span>
        </p>
      )}
      <LightboxWithheldClaims claims={view.withheldClaims} />
    </section>
  );
};
