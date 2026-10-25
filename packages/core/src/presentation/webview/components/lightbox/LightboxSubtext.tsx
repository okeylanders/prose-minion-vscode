/**
 * LightboxSubtext — said and meant (ADR 2026-10-19 D7; Slice 4). A read
 * tile: each card is a line of dialogue as the chapter has it (found by code,
 * inside quoted speech, in the paragraph named) and what the reading takes it
 * to mean, labeled "reads as": a reading, never what the character thinks.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSubtext: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxReadingFrame
    kind="subtext"
    span={6}
    title="Subtext · said and meant"
    view={lightboxLensView(board, 'subtext')}
    empty="The dialogue says what it means: the reading found no line that carries more."
    footnote={<>The most projective lens on the board: <b>reads as</b> is a reading of the line, not what the character thinks.</>}
  >
    <div className="pm-lb-subtext">
      {lightboxTilesOfKind(board, 'subtext').map((pair) => (
        <LightboxItemButton
          key={pair.id}
          binding={bind({ kind: 'reading', tileId: pair.id })}
          className="pm-lb-subtext-pair"
        >
          <span className="pm-lb-subtext-who">¶{pair.said.paragraph} · {pair.speaker}</span>
          <q className="pm-lb-subtext-said">{pair.said.text}</q>
          <span className="pm-lb-subtext-arrow">reads as</span>
          <span className="pm-lb-subtext-meant">{pair.claim}</span>
        </LightboxItemButton>
      ))}
    </div>
  </LightboxReadingFrame>
);
