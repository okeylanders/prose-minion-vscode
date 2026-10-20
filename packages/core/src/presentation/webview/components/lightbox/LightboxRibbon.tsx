/**
 * LightboxRibbon — the chapter, paragraph by paragraph (ADR 2026-10-19 D4).
 *
 * One column per paragraph up to the ribbon width, a contiguous range per
 * column above it (the host buckets; this only draws). Lanes: rhythm (words
 * per sentence) and dialogue are measured; tension is a reading, drawn
 * dashed from the tension arc's read score per column (0–9) once it lands,
 * and empty before. A stale arc (D4) draws only the scores whose paragraphs
 * are unchanged, says so on its label, and leaves a changed paragraph
 * unscored (PR #150 F-06). Endings (Slice 4B) is a read lane too: how each
 * column's paragraphs end, as the rhythm lens read them (Lands filled, Holds
 * half, Opens hollow), stale-labelled and blank on columns whose text
 * changed; a read mark is never drawn in the measured rhythm lane. Focus
 * lights the columns whose paragraphs the hovered or pinned item touches, in
 * its register's color. Columns, the measured lane labels and the read
 * lanes are hoverable and pinnable.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxRibbonColumn } from '@messages';
import type { LightboxItemRef, LightboxResolvedItem } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxTensionLane } from '@hooks/domain/lightbox/lightboxReadings';
import type { LightboxEndingsLane } from '@hooks/domain/lightbox/lightboxCraft';
import { LIGHTBOX_ENDING_LABELS } from '@shared/constants/lightbox';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxRibbonProps {
  board: LightboxBoard;
  litColumns: readonly boolean[];
  focusedItem: LightboxResolvedItem | null;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  /** The tension lens is on. */
  tensionLensOn: boolean;
  /** The tension lane: scores per column once the arc has landed (`null` unscored), stale or not, and its note. */
  tension: LightboxTensionLane;
  /** The tension arc tile, so its lane label pins it. */
  tensionTileId?: string;
  /** How each column's paragraphs end, once the rhythm lens has read them (Slice 4B). */
  endings?: LightboxEndingsLane;
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
  tension,
  tensionTileId,
  endings
}) => {
  const { ribbon } = board;
  const hasFocus = focusedItem !== null;
  const focusTone = focusedItem?.register === 'measured' ? 'is-measured' : 'is-read';
  const scores = tensionLensOn && tension.scores?.length === ribbon.length ? tension.scores : undefined;
  const staleKey = tension.stale ? <span className="pm-lb-lane-stale">stale</span> : null;
  const endingMarks = endings?.endings?.length === ribbon.length ? endings.endings : undefined;
  const endingsLabel = (
    <>
      <i className="pm-lb-lane-key is-read" />Endings{endings?.stale ? <span className="pm-lb-lane-stale">stale</span> : null}
    </>
  );
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
            <LightboxItemButton
              binding={bind({ kind: 'reading', tileId: tensionTileId })}
              className="pm-lb-lane-label pm-lb-h34"
              title={tension.note}
            >
              <i className="pm-lb-lane-key is-read" />Tension{staleKey}
            </LightboxItemButton>
          ) : (
            <span className="pm-lb-lane-label pm-lb-h34 is-static" title={tension.note}>
              <i className="pm-lb-lane-key is-read" />Tension{staleKey}
            </span>
          )}
          {endings && (endingMarks && endings.tileId ? (
            <LightboxItemButton
              binding={bind({ kind: 'reading', tileId: endings.tileId })}
              className="pm-lb-lane-label pm-lb-h12"
              title={endings.note}
            >
              {endingsLabel}
            </LightboxItemButton>
          ) : (
            <span className="pm-lb-lane-label pm-lb-h12 is-static" title={endings.note}>{endingsLabel}</span>
          ))}
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
            const score = scores?.[columnIndex] ?? null;
            const height = score !== null
              ? Math.max(2, Math.round((score / TENSION_TOP_SCORE) * TENSION_LANE_HEIGHT))
              : 0;
            const ending = endingMarks?.[columnIndex] ?? null;
            const endingTitle = !endingMarks
              ? ''
              : ending === null
                ? ' · ending not read: this paragraph changed since the reading'
                : ` · ends, as read: ${LIGHTBOX_ENDING_LABELS[ending].toLowerCase()}`;
            const tensionTitle = !scores
              ? ''
              : score === null
                ? ' · tension not scored: this paragraph changed since the reading'
                : ` · tension, as read${tension.stale ? ' on an earlier version' : ''}: ${score} of ${TENSION_TOP_SCORE}`;
            return (
              <LightboxItemButton
                key={`${column.from}-${column.to}`}
                binding={binding}
                className={`pm-lb-col${hasFocus && !lit ? ' is-dim' : ''}`}
                label={columnLabel(column)}
                title={`${columnLabel(column)} · ${column.avgWordsPerSentence} words per sentence · ` +
                  `${Math.round(column.dialogueShare * 100)}% dialogue${tensionTitle}${endingTitle}`}
              >
                <span className="pm-lb-col-rhythm"><i style={{ height: `${rhythm}px` }} /></span>
                <span className="pm-lb-col-dialogue"><i style={{ opacity: dialogue }} /></span>
                <span className={`pm-lb-col-tension${score !== null ? ' is-read' : scores ? ' is-unscored' : ''}`}>
                  {score !== null && <i style={{ height: `${height}px` }} />}
                </span>
                {endings && (
                  <span className="pm-lb-col-ending">{ending !== null && <i className={`is-${ending}`} />}</span>
                )}
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
