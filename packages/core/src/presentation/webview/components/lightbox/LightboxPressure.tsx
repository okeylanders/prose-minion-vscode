/**
 * LightboxPressure — what is building, and whether it resolves (ADR
 * 2026-10-19 D7; Slice 4C). Each thread is read (its question, and the
 * quotes code found for its plant, escalations and resolution, in paragraph
 * order); its span across the ribbon and the counts under the threads are
 * the host's (counted · read). A dormant thread is planted once and checked
 * to have nothing after its plant. Hovering a thread lights its span.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind, pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxThreadMeta, lightboxThreadTrack } from '@hooks/domain/lightbox/lightboxPlot';
import { lightboxPressureCounts } from '@shared/constants/lightboxPlot';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';
import { LightboxCraftHeading } from '@components/lightbox/LightboxStock';

const CELL_TITLES = {
  plant: 'planted',
  esc: 'builds',
  res: 'resolved',
  run: 'open',
  open: 'still open at the end',
  none: ''
} as const;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxPressure: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const threads = lightboxTilesOfKind(board, 'pressure-thread');
  const counts = lightboxPressureCounts(threads);
  const columns = `repeat(${Math.max(1, board.ribbon.length)}, minmax(0, 1fr))`;
  return (
    <LightboxReadingFrame
      kind="pressure-thread"
      span={6}
      title="Pressure"
      view={lightboxLensView(board, 'pressure')}
      empty="The reading found no thread building."
      footnote={<>Every plant, escalation and resolution <b>quotes its paragraph</b>, checked by code; spans and the lane are <b>counted by code</b>.</>}
    >
      <div className="pm-lb-craft-part">
        <LightboxCraftHeading title="What's building, and whether it resolves" chip={<LightboxRegisterChip register="counted-read" label="threads read · spans counted" />} />
        {threads.map((thread) => (
          <LightboxItemButton key={thread.id} binding={bind({ kind: 'reading', tileId: thread.id })} className="pm-lb-thread">
            <span className="pm-lb-thread-head">
              <span className="pm-lb-thread-name">{thread.title}</span>
              <span className="pm-lb-thread-meta">{lightboxThreadMeta(thread)}</span>
            </span>
            <span className="pm-lb-thread-track" style={{ gridTemplateColumns: columns }} aria-hidden="true">
              {lightboxThreadTrack(thread, board.ribbon).map((cell, index) => (
                <i key={index} className={`is-${cell}`} title={CELL_TITLES[cell]} />
              ))}
            </span>
          </LightboxItemButton>
        ))}
        <span className="pm-lb-thread-key" aria-hidden="true">
          <span><i className="is-plant" />Planted</span>
          <span><i className="is-esc" />Builds</span>
          <span><i className="is-res" />Resolved</span>
          <span><i className="is-open" />Still open</span>
        </span>
      </div>
      <div className="pm-lb-pressure-counts">
        <span><b>{counts.threads}</b> {counts.threads === 1 ? 'thread' : 'threads'}</span>
        <span><b>{counts.resolved}</b> resolved here</span>
        <span><b>{counts.carriedOut}</b> carried out of the chapter</span>
        {counts.dormant > 0 && <span><b>{counts.dormant}</b> dormant</span>}
        <LightboxRegisterChip register="measured" label="counted" />
      </div>
      {counts.dormant > 0 && (
        <span className="pm-lb-craft-note">
          {pluralize(counts.dormant, 'thread')} planted once and never touched again: code checked {counts.dormant === 1 ? 'it has' : 'each has'} no quote after its plant.
        </span>
      )}
    </LightboxReadingFrame>
  );
};
