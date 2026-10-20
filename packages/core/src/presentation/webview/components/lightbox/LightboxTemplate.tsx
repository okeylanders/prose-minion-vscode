/**
 * LightboxTemplate — template and freshness (ADR 2026-10-19 D7 and its
 * 2026-10-20 addendum; Slice 4C):
 * - the template the chapter rides, its description and quotes (read);
 * - the beats where it aligns, subverts or departs, each quoted (read);
 * - engagement by movement (read), a reading of pull kept apart from the
 *   tension lane; it needs the movements, and says so when they are off;
 * - the freshness reading on the three-step scale, labelled "a reading, not
 *   a grade", over the basis line the host joins from group D's tier counts
 *   and these beats, shown only when both halves are current.
 * The tier mix itself is not repeated: the tile points to it in Stock &
 * signature, where it was counted.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxBasisOf, lightboxEngagementAbsence, lightboxEngagementRows } from '@hooks/domain/lightbox/lightboxPlot';
import {
  LIGHTBOX_ENGAGEMENT_LABELS,
  LIGHTBOX_FRESHNESS_LABEL,
  LIGHTBOX_FRESHNESS_LABELS,
  LIGHTBOX_FRESHNESS_LEVELS,
  LIGHTBOX_TEMPLATE_STANCE_LABELS
} from '@shared/constants/lightboxPlot';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';
import { LightboxCraftHeading } from '@components/lightbox/LightboxStock';
import { LightboxPlotQuote } from '@components/lightbox/LightboxSummary';

/** The beats where the chapter meets its template: drawn inside the template tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTemplateBeats: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const beats = lightboxTilesOfKind(board, 'template-beat');
  return beats.length === 0 ? null : (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Where it keeps and turns the shape" chip={<LightboxRegisterChip register="read" />} />
      {beats.map((beat) => (
        <LightboxItemButton key={beat.id} binding={bind({ kind: 'reading', tileId: beat.id })} className="pm-lb-craft-row">
          <span className={`pm-lb-craft-tag pm-lb-stance is-${beat.stance}`}>{LIGHTBOX_TEMPLATE_STANCE_LABELS[beat.stance]}</span>
          <span className="pm-lb-craft-body">
            <span className="pm-lb-craft-note">{beat.claim}</span>
            <LightboxPlotQuote tile={beat} />
          </span>
        </LightboxItemButton>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTemplate: React.FC<LightboxTileProps> = ({ board, bind, lensesOff = [] }) => {
  const [template] = lightboxTilesOfKind(board, 'template');
  const [tiers] = lightboxTilesOfKind(board, 'stock-tiers');
  const basis = lightboxBasisOf(board);
  const engagement = template ? lightboxEngagementRows(board, template) : [];
  return (
    <LightboxReadingFrame
      kind="template"
      span={6}
      title="Template & freshness"
      view={lightboxLensView(board, 'template')}
      empty="The reading named no template."
      footnote={<>Freshness is <b>a reading, not a grade</b>; its basis is <b>counted by code</b> from Stock &amp; signature's tiers and these beats, never by the model.</>}
    >
      {template && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: template.id })} className="pm-lb-craft-part pm-lb-template">
          <LightboxCraftHeading title="Template" chip={<LightboxRegisterChip register="read" />} />
          <span className="pm-lb-template-name">{template.title}</span>
          <span className="pm-lb-craft-note">{template.claim}</span>
          <LightboxPlotQuote tile={template} />
        </LightboxItemButton>
      )}
      <LightboxTemplateBeats board={board} bind={bind} />
      {template && (
        <div className="pm-lb-craft-part">
          <LightboxCraftHeading title="Engagement by movement" chip={<LightboxRegisterChip register="read" />} />
          {engagement.length === 0 ? (
            <span className="pm-lb-craft-note">{lightboxEngagementAbsence(board, lensesOff)}</span>
          ) : (
            <div className="pm-lb-engagement-rows">
              {engagement.map((row) => (
                <LightboxItemButton
                  key={row.movement.id}
                  binding={bind({ kind: 'reading', tileId: row.movement.id })}
                  className="pm-lb-engagement-row"
                  label={`Movement ${row.numeral}, ${row.movement.title}: engagement ${LIGHTBOX_ENGAGEMENT_LABELS[row.level].toLowerCase()}`}
                >
                  <span className="pm-lb-engagement-name">{row.numeral} · {row.movement.title}</span>
                  <span className={`pm-lb-engagement-bar is-${row.level}`}><i /></span>
                  <span className="pm-lb-engagement-level">{LIGHTBOX_ENGAGEMENT_LABELS[row.level]}</span>
                </LightboxItemButton>
              ))}
            </div>
          )}
          <span className="pm-lb-craft-note">A reading of pull, not the tension score: the two can disagree.</span>
        </div>
      )}
      {template && (
        <div className="pm-lb-craft-part pm-lb-craft-inset pm-lb-freshness">
          <LightboxCraftHeading title="Freshness" chip={<span className="pm-lb-craft-chip">{LIGHTBOX_FRESHNESS_LABEL}</span>} />
          <span className="pm-lb-fresh-scale" role="img" aria-label={`Freshness, as read: ${LIGHTBOX_FRESHNESS_LABELS[template.freshness.level]}`}>
            {LIGHTBOX_FRESHNESS_LEVELS.map((level) => (
              <span key={level} className={`pm-lb-fresh-step${level === template.freshness.level ? ' is-on' : ''}`}>
                {LIGHTBOX_FRESHNESS_LABELS[level]}
              </span>
            ))}
          </span>
          <span className="pm-lb-craft-note">{template.freshness.note}</span>
          <span className={`pm-lb-basis is-${basis.status}`}>
            <LightboxRegisterChip register="measured" label={basis.status === 'current' ? 'basis · counted' : 'basis'} />
            {basis.status === 'current' ? <>Basis, counted: {basis.line}.</> : basis.line}
          </span>
          {tiers && (
            <LightboxItemButton binding={bind({ kind: 'reading', tileId: tiers.id })} className="pm-lb-plot-link">
              The tier mix is counted in Stock &amp; signature →
            </LightboxItemButton>
          )}
        </div>
      )}
    </LightboxReadingFrame>
  );
};
