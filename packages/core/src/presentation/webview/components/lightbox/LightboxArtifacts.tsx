/**
 * LightboxArtifacts — the objects in the scene, and what happens to them
 * (ADR 2026-10-19 D7; Slice 4C). The reading names each object and its
 * terms; code counts its mentions and finds its first paragraph (counted ·
 * read). Its arc is read, each step quoting its paragraph, in paragraph
 * order. "Planted, unused" shows only where code's counts bear it out.
 * Hovering an object lights the paragraphs it stands in.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxArtifactsSummary } from '@shared/constants/lightboxPlot';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxArtifacts: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const artifacts = lightboxTilesOfKind(board, 'artifact');
  const summary = lightboxArtifactsSummary(artifacts);
  return (
    <LightboxReadingFrame
      kind="artifact"
      span={6}
      title="Artifacts"
      view={lightboxLensView(board, 'artifacts')}
      empty="The reading named no object in the scene."
      footnote={<>Mentions and first paragraphs are <b>counted by code</b> from the names the reading gives. Arcs are read, and each step quotes its paragraph.</>}
    >
      <div className="pm-lb-artifacts">
        <span className="pm-lb-artifact-head" aria-hidden="true">
          <span>Object</span>
          <span>First</span>
          <span>Mentions</span>
          <span>Arc · read</span>
        </span>
        {artifacts.map((artifact) => (
          <LightboxItemButton
            key={artifact.id}
            binding={bind({ kind: 'reading', tileId: artifact.id })}
            className="pm-lb-artifact"
            label={`${artifact.title}: first in ¶${artifact.firstParagraph}, ${artifact.mentions} ${artifact.mentions === 1 ? 'mention' : 'mentions'}` +
              ` counted by code; arc, as read: ${artifact.claim}${artifact.plantedUnused ? '; planted, unused' : ''}`}
          >
            <span className="pm-lb-artifact-name">{artifact.title}</span>
            <span className="pm-lb-artifact-first">¶{artifact.firstParagraph}</span>
            <span className="pm-lb-artifact-count">×{artifact.mentions}</span>
            <span className="pm-lb-artifact-arc">
              {artifact.arc.map((step, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="pm-lb-artifact-arrow" aria-label="then">→</span>}
                  <span className="pm-lb-artifact-step" title={`¶${step.quote.paragraph}: ${step.quote.text}`}>{step.step}</span>
                </React.Fragment>
              ))}
              {artifact.plantedUnused && <span className="pm-lb-craft-tag is-unused">planted, unused</span>}
            </span>
          </LightboxItemButton>
        ))}
      </div>
      <span className="pm-lb-craft-note pm-lb-artifacts-summary">
        <LightboxRegisterChip register="measured" label="counted" />{' '}
        {summary.objects} {summary.objects === 1 ? 'object' : 'objects'} · {summary.changeState} change state
        {summary.unused > 0 ? ` · ${summary.unused} planted, unused` : ''}.
      </span>
    </LightboxReadingFrame>
  );
};
