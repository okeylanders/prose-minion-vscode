/** Writer-facing reading of one preview: positions → dynamic → open entailment. */

import * as React from 'react';
import {
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityPreview
} from '@messages';

interface WorkshopLexicalGravityPreviewReadingProps {
  lens: WorkshopLexicalGravityLens;
  preview: WorkshopLexicalGravityPreview;
}

export const WorkshopLexicalGravityPreviewReading: React.FC<
  WorkshopLexicalGravityPreviewReadingProps
> = ({ lens, preview }) => {
  const roleName = (roleId: string): string =>
    lens.logic.roles.find(({ id }) => id === roleId)?.name ?? roleId;
  const axisName = (axisId: string): string =>
    lens.logic.axes.find(({ id }) => id === axisId)?.name ?? axisId;
  const dynamic = preview.selectedDynamicId !== null
    ? lens.logic.dynamics.find(({ id }) => id === preview.selectedDynamicId)
    : undefined;
  const semanticNoOp = preview.semanticPositions.length === 0;

  return (
    <div className="pm-ws-lg-reading">
      <div className="pm-ws-lg-readcap">What the lens noticed</div>
      {semanticNoOp ? (
        <p className="pm-ws-lg-noop">
          No honest semantic mapping — the lens left the passage alone rather than
          inventing props, motives, or plot events. That is a valid result.
        </p>
      ) : (
        <div className="pm-ws-lg-posrows">
          {preview.semanticPositions.map((position, index) => (
            <div className="pm-ws-lg-posrow" key={`${position.element}-${index}`}>
              <b>{position.element}</b>
              <span className="pm-ws-lg-posarrow">→</span>
              <em>{roleName(position.roleId)}</em>
              {position.axisId !== null && position.axisPosition !== null && (
                <em className="pm-ws-lg-posaxis">
                  {axisName(position.axisId)} · {position.axisPosition}
                </em>
              )}
              <span className="pm-ws-lg-posnote">— {position.significance}</span>
            </div>
          ))}
        </div>
      )}
      {dynamic && (
        <div className="pm-ws-lg-readrow">
          <i>selected dynamic</i>
          <span className="pm-ws-lg-dynchip">{dynamic.operation}</span>
          <span className="pm-ws-lg-readmv">{dynamic.movement}</span>
        </div>
      )}
      {!dynamic && !semanticNoOp && (
        <div className="pm-ws-lg-readrow">
          <i>selected dynamic</i>
          <span className="pm-ws-lg-readmv">
            none — positioning only; no state change was honest for this beat
          </span>
        </div>
      )}
      {preview.openEntailment !== null && (
        <div className="pm-ws-lg-readrow">
          <i>open entailment</i>
          <p>{preview.openEntailment}</p>
        </div>
      )}
    </div>
  );
};
