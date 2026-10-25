/**
 * LightboxMotifs — what recurs (ADR 2026-10-19 D7). A read tile: each motif
 * card shows its name and how it moves, where it lives in the chapter, the
 * word code counted for it, and how many of its quotes were checked. Hover
 * lights its paragraphs; a click pins it with its evidence.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import {
  LightboxParagraphStrip,
  lightboxEvidenceNote,
  lightboxTopSupport
} from '@components/lightbox/LightboxReadingParts';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxMotifs: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxReadingFrame
    kind="motif"
    span={6}
    title="Motifs · where they recur"
    view={lightboxLensView(board, 'motif')}
    empty="Nothing recurs strongly enough to name as a motif."
  >
    <div className="pm-lb-motifs">
      {lightboxTilesOfKind(board, 'motif').map((motif) => (
        <LightboxItemButton key={motif.id} binding={bind({ kind: 'reading', tileId: motif.id })} className="pm-lb-motif">
          <span className="pm-lb-motif-title">{motif.title}</span>
          <span className="pm-lb-motif-gist">{motif.gist}</span>
          <LightboxParagraphStrip board={board} paragraphs={motif.paragraphs} />
          {lightboxTopSupport(motif) && <span className="pm-lb-motif-support">{lightboxTopSupport(motif)}</span>}
          <span className="pm-lb-motif-evidence">{lightboxEvidenceNote(motif)}</span>
        </LightboxItemButton>
      ))}
    </div>
  </LightboxReadingFrame>
);
