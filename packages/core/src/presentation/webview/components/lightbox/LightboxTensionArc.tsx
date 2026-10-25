/**
 * LightboxTensionArc — the tension lane's reading, under the ribbon (ADR
 * 2026-10-19 D4, D7; open question 3). The ribbon draws the read score per
 * column, dashed, in the read register; this line says what the arc claims
 * and pins it. Before a reading it says the lane is a reading still to come;
 * a withheld or failed arc says so, and the lane stays empty. An arc read
 * against an earlier version of the text says so, and that its scores stand
 * only on paragraphs unchanged since (D4; PR #150 F-06).
 *
 * Beside the line sits call A's Analyze (Slice 4I, epic decision 43), in
 * place of the "read" badge the line carried; it is a button of its own,
 * outside the line's pin.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxAnalyzeButton, useLightboxHasCallControls } from '@components/lightbox/LightboxCallButton';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTensionArc: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const view = lightboxLensView(board, 'tension');
  const [arc] = lightboxTilesOfKind(board, 'tension-arc');
  const analyze = useLightboxHasCallControls();
  if (arc && view.phase === 'ok') {
    return (
      <div className="pm-lb-tension-row">
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: arc.id })} className="pm-lb-ribbon-note pm-lb-tension-note">
          {!analyze && <span className="pm-lb-badge pm-lb-reg-read">read</span>}
          {view.stale && <span className="pm-lb-badge pm-lb-stale-badge">stale</span>}
          <span>
            {view.stale ? 'Tension, as read on an earlier version (scores stand only on unchanged paragraphs): ' : 'Tension, as read: '}
            {arc.claim}
          </span>
        </LightboxItemButton>
        {analyze && <LightboxAnalyzeButton lens="tension" />}
      </div>
    );
  }
  const withheld = view.withheldBlocks[0]?.reason ?? view.withheldClaims[0]?.reason;
  const text = view.phase === 'reading'
    ? 'Analyzing the tension arc…'
    : view.phase === 'failed' || view.phase === 'cancelled'
      ? view.notice ?? 'The tension arc did not come back.'
      : view.phase === 'ok'
        ? `The tension arc was withheld. ${withheld ?? ''}`.trim()
        : 'Tension is a reading; its lane fills once call A is analyzed.';
  return (
    <div className="pm-lb-tension-row">
      <p className="pm-lb-ribbon-note">{text}</p>
      {analyze && <LightboxAnalyzeButton lens="tension" />}
    </div>
  );
};
