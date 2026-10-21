/**
 * LightboxRibbonPlot — the ribbon's story lanes (ADR 2026-10-19 D4; Slice
 * 4C), drawn under its paragraph columns on the same column grid:
 * - **Sections** (measured, solid): the chapter's headings, scene breaks or
 *   chapter lines, found by code; with none, the lane says so and the
 *   ribbon stays in paragraphs.
 * - **Movements** (read, hatched): each movement over the columns whose
 *   first paragraph it holds, by its current range.
 * - **Pressure** (counted from read threads): how many threads stand open
 *   across each column.
 * - **Engagement** (read, hatched): each movement's level, kept apart from
 *   the tension lane above.
 * A band lights its section's or movement's paragraphs on hover and pins it
 * on click; the Sections and Pressure labels pin their lanes.
 *
 * It renders as three direct children of the ribbon's one grid (a rule
 * across both tracks, its label block, its lane track), never a row of its
 * own: the label block takes the grid's shared label track and the lanes its
 * column track, so a column index is one place in every lane. Plain CSS
 * grid, no subgrid, so it holds on Chromium 114 (VS Code 1.82; PR #156
 * F-03, F-04). Every
 * position comes from the host's ranges and quotes on the current text,
 * never an old column (PR #150 F-06). The two-level ribbon above 96
 * paragraphs is out of scope here (feature note).
 */
import * as React from 'react';
import type { LightboxBoard, LightboxMovementTile } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import {
  lightboxSectionBands,
  lightboxSectionsNote,
  type LightboxBand,
  type LightboxPressureLaneView,
  type LightboxReadLane
} from '@hooks/domain/lightbox/lightboxPlot';
import { LIGHTBOX_ENGAGEMENT_LABELS, lightboxMovementNumeral } from '@shared/constants/lightboxPlot';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxRibbonPlotLanes {
  movements: LightboxReadLane<LightboxMovementTile>;
  pressure: LightboxPressureLaneView;
  engagement: LightboxReadLane<{ movement: LightboxMovementTile; level: 'low' | 'medium' | 'high' | null }>;
}

export interface LightboxRibbonPlotProps {
  board: LightboxBoard;
  lanes: LightboxRibbonPlotLanes;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

const PRESSURE_LANE_HEIGHT = 20;

function span(band: LightboxBand<unknown>, row: number): React.CSSProperties {
  return { gridColumn: `${band.start + 1} / ${band.end + 2}`, gridRow: row };
}

function rangeLabel(from: number, to: number): string {
  return from === to ? `¶${from}` : `¶${from}–¶${to}`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const StaleKey: React.FC<{ stale: boolean }> = ({ stale }) => (stale ? <span className="pm-lb-lane-stale">stale</span> : null);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxRibbonPlot: React.FC<LightboxRibbonPlotProps> = ({ board, lanes, bind }) => {
  const { ribbon } = board;
  const sections = board.measured.sections;
  const sectionBands = lightboxSectionBands(board);
  const sectionsNote = lightboxSectionsNote(sections);
  const all = { gridColumn: `1 / ${Math.max(1, ribbon.length) + 1}` };
  const top = Math.max(1, ...(lanes.pressure.counts ?? [0]));
  return (
    <>
      <div className="pm-lb-ribbon-rule" aria-hidden="true" />
      <div className="pm-lb-ribbon-labels pm-lb-ribbon-plot-labels">
        <LightboxItemButton binding={bind({ kind: 'lane', lane: 'sections' })} className="pm-lb-lane-label pm-lb-h14" title={sectionsNote}>
          <i className="pm-lb-lane-key is-measured" />Sections
        </LightboxItemButton>
        <span className="pm-lb-lane-label pm-lb-h14 is-static" title={lanes.movements.note}>
          <i className="pm-lb-lane-key is-read" />Movements<StaleKey stale={lanes.movements.stale} />
        </span>
        {lanes.pressure.counts ? (
          <LightboxItemButton binding={bind({ kind: 'pressure' })} className="pm-lb-lane-label pm-lb-h20" title={lanes.pressure.note}>
            <i className="pm-lb-lane-key is-counted-read" />Pressure<StaleKey stale={lanes.pressure.stale} />
          </LightboxItemButton>
        ) : (
          <span className="pm-lb-lane-label pm-lb-h20 is-static" title={lanes.pressure.note}>
            <i className="pm-lb-lane-key is-counted-read" />Pressure<StaleKey stale={lanes.pressure.stale} />
          </span>
        )}
        <span className="pm-lb-lane-label pm-lb-h16 is-static" title={lanes.engagement.note}>
          <i className="pm-lb-lane-key is-read" />Engagement<StaleKey stale={lanes.engagement.stale} />
        </span>
      </div>
      <div
        className="pm-lb-plot-lanes"
        role="group"
        aria-label="Sections, movements, pressure and engagement"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, ribbon.length)}, minmax(0, 1fr))` }}
      >
        {sectionBands.length === 0 ? (
          <span className="pm-lb-plot-empty" style={{ ...all, gridRow: 1 }}>{sectionsNote}</span>
        ) : sectionBands.map((band) => {
          const section = sections.sections[band.value - 1];
          return (
            <LightboxItemButton
              key={`section-${band.value}`}
              binding={bind({ kind: 'section', index: band.value })}
              className="pm-lb-band is-section"
              style={span(band, 1)}
              label={`Section ${band.value}: ${section.label}, ${rangeLabel(section.from, section.to)}`}
              title={`${section.label} · ${rangeLabel(section.from, section.to)} · found by code`}
            >
              {section.label}
            </LightboxItemButton>
          );
        })}
        {lanes.movements.bands.length === 0 ? (
          <span className="pm-lb-plot-empty" style={{ ...all, gridRow: 2 }}>{lanes.movements.note}</span>
        ) : lanes.movements.bands.map((band) => (
          <LightboxItemButton
            key={`movement-${band.value.id}`}
            binding={bind({ kind: 'reading', tileId: band.value.id })}
            className={`pm-lb-band is-movement${band.value.ordinal % 2 === 0 ? ' is-even' : ''}`}
            style={span(band, 2)}
            label={`Movement ${lightboxMovementNumeral(band.value.ordinal)}: ${band.value.title}, ${rangeLabel(band.value.from, band.value.to)}`}
            title={`${lightboxMovementNumeral(band.value.ordinal)} · ${band.value.title} · ${rangeLabel(band.value.from, band.value.to)}, as read`}
          >
            {lightboxMovementNumeral(band.value.ordinal)}
          </LightboxItemButton>
        ))}
        {lanes.pressure.counts ? lanes.pressure.counts.map((count, index) => (
          <span
            key={`pressure-${index}`}
            className="pm-lb-plot-pressure"
            style={{ gridColumn: index + 1, gridRow: 3 }}
            title={`${rangeLabel(ribbon[index].from, ribbon[index].to)} · ${count} open ${count === 1 ? 'thread' : 'threads'}, counted by code`}
          >
            {count > 0 && <i style={{ height: `${Math.max(3, Math.round((count / top) * PRESSURE_LANE_HEIGHT))}px` }} />}
          </span>
        )) : (
          <span className="pm-lb-plot-empty" style={{ ...all, gridRow: 3 }}>{lanes.pressure.note}</span>
        )}
        {lanes.engagement.bands.length === 0 ? (
          <span className="pm-lb-plot-empty" style={{ ...all, gridRow: 4 }}>{lanes.engagement.note}</span>
        ) : lanes.engagement.bands.map((band) => (
          <LightboxItemButton
            key={`engagement-${band.value.movement.id}`}
            binding={bind({ kind: 'reading', tileId: band.value.movement.id })}
            className={`pm-lb-band is-engagement is-${band.value.level ?? 'none'}`}
            style={span(band, 4)}
            label={`Engagement in movement ${lightboxMovementNumeral(band.value.movement.ordinal)}: ` +
              `${band.value.level ? LIGHTBOX_ENGAGEMENT_LABELS[band.value.level].toLowerCase() : 'none drawn'}`}
            title={`${lightboxMovementNumeral(band.value.movement.ordinal)} · engagement, as read: ` +
              `${band.value.level ? LIGHTBOX_ENGAGEMENT_LABELS[band.value.level] : 'none'} · not tension`}
          >
            <i />
          </LightboxItemButton>
        ))}
      </div>
    </>
  );
};
