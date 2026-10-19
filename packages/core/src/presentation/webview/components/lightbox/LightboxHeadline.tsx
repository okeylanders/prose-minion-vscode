/**
 * LightboxHeadline — the chapter in one sentence, as read (ADR 2026-10-19
 * D7). It takes the board's heading once the headline lens has a reading,
 * labeled "a reading" so it never passes for the board's own title; until
 * then the heading is the board's plain one. Hover lights the paragraphs its
 * quotes and counted words stand in; a click pins it.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export const LIGHTBOX_PLAIN_HEADLINE = 'One chapter, held up to the light.';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxHeadline: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [headline] = lightboxTilesOfKind(board, 'headline');
  if (!headline) {
    return <h2 className="pm-lb-headline">{LIGHTBOX_PLAIN_HEADLINE}</h2>;
  }
  return (
    <div className="pm-lb-headline-row">
      <h2 className="pm-lb-headline">
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: headline.id })} className="pm-lb-headline-reading">
          {headline.title}
        </LightboxItemButton>
      </h2>
      <span className="pm-lb-badge pm-lb-reg-read">a reading</span>
    </div>
  );
};
