/**
 * LightboxLineage — adjacent stories (ADR 2026-10-19 D7; Slice 4). A read
 * tile: each card is a story the chapter stands beside, marked with how it
 * stands (matches, departs, subverts) against quotes code found, and where in
 * the chapter it meets the story. Under the cards, the stories the reading
 * checked and set aside, with why; and finding no echo is drawn as the
 * honest answer it is, with its friction.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxParagraphStrip } from '@components/lightbox/LightboxReadingParts';
import { LIGHTBOX_LINEAGE_STANCE_LABELS } from '@shared/constants/lightbox';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxLineage: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const view = lightboxLensView(board, 'lineage');
  const setAside = view.setAside ?? [];
  return (
    <LightboxReadingFrame
      kind="lineage"
      span={6}
      title="Lineage · adjacent stories"
      view={view}
      empty="No strong echo: the reading found no older story these paragraphs stand beside."
      after={setAside.length > 0 && (
        <p className="pm-lb-lineage-set-aside">
          <b>Checked and set aside:</b>{' '}
          {setAside.map((entry, index) => (
            <span key={`${entry.title}:${index}`}>
              {index > 0 ? ' ' : ''}<i>{entry.title}</i>. {entry.reason}
            </span>
          ))}
        </p>
      )}
    >
      <div className="pm-lb-lineage">
        {lightboxTilesOfKind(board, 'lineage').map((story) => (
          <LightboxItemButton
            key={story.id}
            binding={bind({ kind: 'reading', tileId: story.id })}
            className="pm-lb-lineage-story"
          >
            <span className="pm-lb-lineage-top">
              <span className="pm-lb-lineage-title">{story.title}</span>
              <span className="pm-lb-lineage-source">{story.source}</span>
            </span>
            {story.stances.map((row) => (
              <span key={row.stance} className="pm-lb-stance">
                <span className={`pm-lb-stance-chip is-${row.stance}`}>{LIGHTBOX_LINEAGE_STANCE_LABELS[row.stance]}</span>
                <span>{row.note}</span>
              </span>
            ))}
            <LightboxParagraphStrip board={board} paragraphs={story.paragraphs} />
          </LightboxItemButton>
        ))}
      </div>
    </LightboxReadingFrame>
  );
};
