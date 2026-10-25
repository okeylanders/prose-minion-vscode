/**
 * LightboxGravityOrbit — borrowed fields placed by pull (ADR 2026-10-19 D7;
 * Slice 3).
 *
 * Built from positioned buttons, not one picture, so every field is a
 * keyboard stop that lights its paragraphs on focus and pins on Enter, like
 * every other board item. Three dashed rings mark strong, moderate and the
 * gravity line. A field sits nearer the center the more pull its reading
 * claims; one the host counted under the line sits on it, drawn hollow,
 * whatever its claimed pull. Each dot grows with the host's hits.
 */
import * as React from 'react';
import type { LightboxGravityFieldTile } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { lightboxOrbitPlacements } from '@hooks/domain/lightbox/lightboxGravity';
import { pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxGravityOrbitProps {
  fields: readonly LightboxGravityFieldTile[];
  /** A short name for the text at the center, e.g. the file's name. */
  core: string;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxGravityOrbit: React.FC<LightboxGravityOrbitProps> = ({ fields, core, bind }) => {
  const placements = lightboxOrbitPlacements(fields);
  return (
    <div className="pm-lb-orbit" role="group" aria-label="Borrowed fields by claimed pull">
      <span className="pm-lb-orbit-ring is-strong" aria-hidden="true" />
      <span className="pm-lb-orbit-ring is-moderate" aria-hidden="true" />
      <span className="pm-lb-orbit-ring is-line" aria-hidden="true" />
      <span className="pm-lb-orbit-label is-strong" aria-hidden="true">strong</span>
      <span className="pm-lb-orbit-label is-moderate" aria-hidden="true">moderate</span>
      <span className="pm-lb-orbit-label is-line" aria-hidden="true">gravity line</span>
      <span className="pm-lb-orbit-core" aria-hidden="true">{core}</span>
      {fields.map((field, index) => {
        const placement = placements[index];
        return (
          <LightboxItemButton
            key={field.id}
            binding={bind({ kind: 'reading', tileId: field.id })}
            className={`pm-lb-orbit-body${placement.belowLine ? ' is-below' : ''}`}
            label={`${field.title}, claimed pull ${field.pull.toFixed(2)}, ${pluralize(field.hits, 'hit')}` +
              (placement.belowLine ? ', below the gravity line' : '')}
            style={{ left: `${placement.left}px`, top: `${placement.top}px` }}
          >
            <span className="pm-lb-orbit-dot" style={{ width: `${placement.dot}px`, height: `${placement.dot}px` }} />
            <span className="pm-lb-orbit-name" aria-hidden="true">{field.title}</span>
          </LightboxItemButton>
        );
      })}
    </div>
  );
};
