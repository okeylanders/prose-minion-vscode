/**
 * LightboxBoardMain — the board's main column (ADR 2026-10-19 D3–D6).
 *
 * Props-only. Lays out, in order: the board header, any refusal (naming the
 * refused source and, over a retained board, the source still shown), the
 * toolbar (tile filter, register legend, and the Read button, disabled until
 * the readings land in Slice 2B), the sticky paragraph ribbon, the counted
 * tiles through the exhaustive renderer map, and a "not read yet" placeholder
 * for each reading lens that is on.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxLensId, LightboxSourceRefusal } from '@messages';
import type { LightboxFilter } from '@hooks/domain/useLightbox';
import type { UseLightboxFocusReturn } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { Icon } from '@components/shared/Icon';
import { LightboxRibbon } from '@components/lightbox/LightboxRibbon';
import { LIGHTBOX_MEASURED_LAYOUT, LIGHTBOX_TILE_RENDERERS } from '@components/lightbox/LightboxTiles';
import {
  LIGHTBOX_READING_TILE_TITLES,
  LightboxReadingPlaceholder,
  LightboxTileLensId
} from '@components/lightbox/LightboxReadingPlaceholder';

export interface LightboxBoardMainProps {
  board: LightboxBoard | null | undefined;
  refusal: LightboxSourceRefusal | null;
  filter: LightboxFilter;
  lensesOff: readonly LightboxLensId[];
  focus: Pick<UseLightboxFocusReturn, 'bind' | 'focusedItem' | 'litColumns'>;
  onFilter: (filter: LightboxFilter) => void;
  onPickFile: () => void;
  onDismissRefusal: () => void;
}

const FILTERS: ReadonlyArray<{ id: LightboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'measured', label: 'Measured' },
  { id: 'read', label: 'Read' }
];

/* eslint-disable @typescript-eslint/naming-convention -- refusal reasons are kebab-case protocol literals. */
const REFUSAL_TITLES: Record<LightboxSourceRefusal['reason'], string> = {
  'over-ceiling': 'Too long for one board',
  empty: 'Nothing to board',
  unreadable: 'Could not board that source',
  'not-refreshable': 'Nothing to re-read'
};
/* eslint-enable @typescript-eslint/naming-convention */

const READING_TILE_LENSES = Object.keys(LIGHTBOX_READING_TILE_TITLES) as LightboxTileLensId[];

function fileName(displayPath: string): string {
  const parts = displayPath.split(/[\\/]/);
  return parts[parts.length - 1] || displayPath;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardMain: React.FC<LightboxBoardMainProps> = ({
  board,
  refusal,
  filter,
  lensesOff,
  focus,
  onFilter,
  onPickFile,
  onDismissRefusal
}) => {
  const refusalNotice = refusal && (
    <div className="pm-lb-refusal" role="alert">
      <Icon name="alert" size={16} />
      <div className="pm-lb-refusal-body">
        <p className="pm-lb-refusal-title">{REFUSAL_TITLES[refusal.reason]}</p>
        <p>{refusal.message}</p>
        {refusal.displayPath && <p className="pm-lb-refusal-path">{refusal.displayPath}</p>}
        {refusal.suggestion && <p className="pm-lb-refusal-suggestion">{refusal.suggestion}</p>}
        {board && <p className="pm-lb-refusal-kept">The board below still shows {board.source.displayPath}.</p>}
      </div>
      <button type="button" className="pm-lb-button" onClick={onDismissRefusal}>Dismiss</button>
    </div>
  );

  if (board === undefined) {
    return <div className="pm-lb-scroll"><p className="pm-lb-loading" role="status">Loading the board…</p></div>;
  }

  if (board === null) {
    return (
      <div className="pm-lb-scroll">
        {refusalNotice}
        <div className="pm-lb-welcome">
          <p className="pm-lb-main-eyebrow"><i />Nothing on the board yet</p>
          <h2 className="pm-lb-headline">Hold a chapter up to the light.</h2>
          <p className="pm-lb-sub">
            Choose a file, or select a passage in the editor and run <b>Open Selection in Lightbox</b>. The
            counted board appears at once and costs nothing: no model is asked.
          </p>
          <button type="button" className="pm-lb-primary" onClick={onPickFile}>Choose file</button>
        </div>
      </div>
    );
  }

  const showMeasured = filter !== 'read';
  const showRead = filter !== 'measured';
  const readingLenses = READING_TILE_LENSES.filter((lens) => !lensesOff.includes(lens));
  const trim = board.measured.standards?.publishingFormat?.trimLabel;

  return (
    <div className="pm-lb-scroll">
      <p className="pm-lb-main-eyebrow">
        <i />
        {fileName(board.source.displayPath)} · {board.source.paragraphCount.toLocaleString('en-US')} ¶
        {trim ? ` · ${trim} trim` : ''}
      </p>
      <h2 className="pm-lb-headline">One chapter, held up to the light.</h2>
      <p className="pm-lb-sub">
        <b>Solid tiles are counted</b> by code and cost nothing. <span className="pm-lb-read-text">Dashed
        tiles hold readings</span>: each will cite a quote and a ¶ address, checked against the text, and
        name where it strains.
      </p>

      {refusalNotice}

      <div className="pm-lb-toolbar">
        <div className="pm-lb-segmented" role="group" aria-label="Show tiles">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`pm-lb-segment${filter === id ? ' is-on' : ''}`}
              aria-pressed={filter === id}
              onClick={() => onFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pm-lb-legend">
          <span className="pm-lb-legend-item"><i className="pm-lb-key is-measured" />Measured · counted by code</span>
          <span className="pm-lb-legend-item"><i className="pm-lb-key is-read" />Read · a reading, not a measurement</span>
        </div>
        <div className="pm-lb-run">
          <span className="pm-lb-run-note" id="pm-lb-read-note">Readings arrive in the next update</span>
          <button type="button" className="pm-lb-primary" disabled aria-describedby="pm-lb-read-note">
            <Icon name="sparkle" size={13} />Read the chapter
          </button>
        </div>
      </div>

      <LightboxRibbon
        board={board}
        litColumns={focus.litColumns}
        focusedItem={focus.focusedItem}
        bind={focus.bind}
        tensionLensOn={!lensesOff.includes('tension')}
      />

      {showMeasured && LIGHTBOX_MEASURED_LAYOUT.rows.map((kind) =>
        React.createElement(LIGHTBOX_TILE_RENDERERS[kind], { key: kind, board, bind: focus.bind })
      )}

      <div className="pm-lb-grid">
        {showMeasured && LIGHTBOX_MEASURED_LAYOUT.grid.map((kind) =>
          React.createElement(LIGHTBOX_TILE_RENDERERS[kind], { key: kind, board, bind: focus.bind })
        )}
        {showRead && readingLenses.map((lens) => <LightboxReadingPlaceholder key={lens} lens={lens} />)}
      </div>
      {showRead && readingLenses.length === 0 && (
        <p className="pm-lb-empty-note">Every reading lens is off. Turn one on in the rail to see where it will land.</p>
      )}
    </div>
  );
};
