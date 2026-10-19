/**
 * LightboxRibbon — the chapter, paragraph by paragraph (ADR 2026-10-19 D4).
 *
 * One column per paragraph up to the ribbon width, a contiguous range per
 * column above it (the host buckets; this only draws). Lanes: rhythm (words
 * per sentence) and dialogue are measured; tension is a reading, drawn
 * dashed from the tension arc's read score per column (0–9) once it lands,
 * and empty before; focus lights the columns whose paragraphs the hovered
 * or pinned item touches, in its register's color. Columns, the measured
 * lane labels and a read tension lane are hoverable and pinnable.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxRibbonColumn } from '@messages';
import type { LightboxItemRef, LightboxResolvedItem } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxRibbonProps {
  board: LightboxBoard;
  litColumns: readonly boolean[];
  focusedItem: LightboxResolvedItem | null;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  /** The tension lens is on. */
  tensionLensOn: boolean;
  /** The tension arc's read score per column, once it has landed. */
  tensionScores?: readonly number[];
  /** The tension arc tile, so its lane label pins it. */
  tensionTileId?: string;
}

const RHYTHM_LANE_HEIGHT = 34;
const TENSION_LANE_HEIGHT = 34;
const TENSION_TOP_SCORE = 9;
/** Scale floor, so a text of very short sentences does not fill the lane. */
const RHYTHM_SCALE_FLOOR = 12;
/** How many paragraph references the focus line spells out. */
const FOCUS_REFERENCES = 14;

function columnLabel(column: LightboxRibbonColumn): string {
  return column.from === column.to
    ? `Paragraph ${column.from}`
    : `Paragraphs ${column.from} to ${column.to}`;
}

function focusLine(item: LightboxResolvedItem | null): string {
  if (!item) {
    return 'Hover anything on the board to light the paragraphs it touches.';
  }
  if (item.paragraphs.length === 0) {
    return `${item.title} · in no single paragraph`;
  }
  const shown = item.paragraphs.slice(0, FOCUS_REFERENCES).map((index) => `¶${index}`).join(' ');
  const more = item.paragraphs.length - FOCUS_REFERENCES;
  return `${item.title}  ·  ${shown}${more > 0 ? ` +${more}` : ''}`;
}

/** Label the first column and every nth after it, so the index row never crowds. */
function labelStep(columns: number): number {
  return columns <= 24 ? 3 : columns <= 48 ? 6 : 12;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxRibbon: React.FC<LightboxRibbonProps> = ({
  board,
  litColumns,
  focusedItem,
  bind,
  tensionLensOn,
  tensionScores,
  tensionTileId
}) => {
  const { ribbon } = board;
  const hasFocus = focusedItem !== null;
  const focusTone = focusedItem?.register === 'measured' ? 'is-measured' : 'is-read';
  const scores = tensionLensOn && tensionScores?.length === ribbon.length ? tensionScores : undefined;
  const scale = Math.max(RHYTHM_SCALE_FLOOR, ...ribbon.map((column) => column.avgWordsPerSentence));
  const step = labelStep(ribbon.length);
  const bucketed = ribbon.some((column) => column.to > column.from);

  return (
    <div className="pm-lb-ribbon" role="group" aria-label="The text, paragraph by paragraph">
      <div className="pm-lb-ribbon-top">
        <span className="pm-lb-ribbon-eyebrow">
          The text · {board.paragraphs.length.toLocaleString('en-US')} ¶
          {bucketed ? ` · ${ribbon.length} columns` : ''}
        </span>
        {/* Not a live region: hover changes it constantly; the inspector announces pins. */}
        <span className={`pm-lb-ribbon-focus${hasFocus ? ` ${focusTone}` : ''}`}>
          {focusLine(focusedItem)}
        </span>
      </div>
      <div className="pm-lb-ribbon-wrap">
        <div className="pm-lb-ribbon-labels">
          <LightboxItemButton binding={bind({ kind: 'lane', lane: 'rhythm' })} className="pm-lb-lane-label pm-lb-h34">
            <i className="pm-lb-lane-key is-measured" />Rhythm
          </LightboxItemButton>
          <LightboxItemButton binding={bind({ kind: 'lane', lane: 'dialogue' })} className="pm-lb-lane-label pm-lb-h12">
            <i className="pm-lb-lane-key is-measured" />Dialogue
          </LightboxItemButton>
          {scores && tensionTileId ? (
            <LightboxItemButton binding={bind({ kind: 'reading', tileId: tensionTileId })} className="pm-lb-lane-label pm-lb-h34">
              <i className="pm-lb-lane-key is-read" />Tension
            </LightboxItemButton>
          ) : (
            <span
              className="pm-lb-lane-label pm-lb-h34 is-static"
              title={tensionLensOn ? 'Tension is a reading. Not read yet.' : 'The tension lens is off.'}
            >
              <i className="pm-lb-lane-key is-read" />Tension
            </span>
          )}
          <span className="pm-lb-lane-label pm-lb-h10 is-static">Focus</span>
          <span className="pm-lb-lane-label pm-lb-h12 is-static">¶</span>
        </div>
        <div
          className="pm-lb-ribbon-cols"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, ribbon.length)}, minmax(0, 1fr))` }}
        >
          {ribbon.map((column, columnIndex) => {
            const lit = litColumns[columnIndex] === true;
            const rhythm = column.avgWordsPerSentence > 0
              ? Math.max(2, Math.round((column.avgWordsPerSentence / scale) * RHYTHM_LANE_HEIGHT))
              : 0;
            const dialogue = column.dialogueShare > 0 ? 0.3 + column.dialogueShare * 0.7 : 0;
            const binding = bind({ kind: 'paragraphs', from: column.from, to: column.to });
            const tension = scores
              ? Math.max(2, Math.round((scores[columnIndex] / TENSION_TOP_SCORE) * TENSION_LANE_HEIGHT))
              : 0;
            return (
              <LightboxItemButton
                key={`${column.from}-${column.to}`}
                binding={binding}
                className={`pm-lb-col${hasFocus && !lit ? ' is-dim' : ''}`}
                label={columnLabel(column)}
                title={`${columnLabel(column)} · ${column.avgWordsPerSentence} words per sentence · ` +
                  `${Math.round(column.dialogueShare * 100)}% dialogue` +
                  (scores ? ` · tension, as read: ${scores[columnIndex]} of ${TENSION_TOP_SCORE}` : '')}
              >
                <span className="pm-lb-col-rhythm"><i style={{ height: `${rhythm}px` }} /></span>
                <span className="pm-lb-col-dialogue"><i style={{ opacity: dialogue }} /></span>
                <span className={`pm-lb-col-tension${scores ? ' is-read' : ''}`}>
                  {scores && <i style={{ height: `${tension}px` }} />}
                </span>
                <span className={`pm-lb-col-focus${lit ? ` is-lit ${focusTone}` : ''}`} />
                <span className="pm-lb-col-index">
                  {columnIndex === 0 || (columnIndex + 1) % step === 0 ? column.from : ''}
                </span>
              </LightboxItemButton>
            );
          })}
        </div>
      </div>
    </div>
  );
};
