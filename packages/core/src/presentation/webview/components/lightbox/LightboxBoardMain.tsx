/**
 * LightboxBoardMain — the board's main column (ADR 2026-10-19 D3–D7).
 *
 * Props-only. Lays out, in order: the changed-file notice of a saved board
 * whose file now holds another text, with "Read the current text" (Slice
 * 5A.1, epic decision 34: the rail's own notice, from the same shelf, so the
 * two come and go together), the board header (with the headline once it is
 * read), any refusal (naming the refused source and, over a retained board,
 * the source still shown), the toolbar (tile filter, register legend, and
 * the run line), each call that did not land, said once under it (Slice
 * 4J, epic decision 52), the sticky paragraph ribbon and the tension arc's line, the
 * counted tiles, then the readings, the Spark lane under them, and the
 * Opinion last, all through the exhaustive renderer map. A lens that is off
 * is not drawn.
 */
import * as React from 'react';
import type {
  LightboxBoard,
  LightboxLensId,
  LightboxReadingTileKind,
  LightboxRunScope,
  LightboxSourceRefusal
} from '@messages';
import { LIGHTBOX_TILE_LENS } from '@shared/constants/lightbox';
import type { LightboxFilter } from '@hooks/domain/useLightbox';
import type { UseLightboxFocusReturn } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import type { LightboxRunLineView } from '@hooks/domain/lightbox/lightboxRunLine';
import type { LightboxSnapshotView } from '@hooks/domain/lightbox/lightboxBoardsView';
import { lightboxTensionLane, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxEndingsLane } from '@hooks/domain/lightbox/lightboxCraft';
import { lightboxEngagementLane, lightboxMovementsLane, lightboxPressureLaneView } from '@hooks/domain/lightbox/lightboxPlot';
import { Icon } from '@components/shared/Icon';
import { LightboxRibbon } from '@components/lightbox/LightboxRibbon';
import { LightboxRunLine } from '@components/lightbox/LightboxRunLine';
import { LightboxCallNotes } from '@components/lightbox/LightboxCallNotes';
import { lightboxCallNotes } from '@hooks/domain/lightbox/lightboxCallNotes';
import { LIGHTBOX_PLAIN_HEADLINE } from '@components/lightbox/LightboxHeadline';
import {
  LIGHTBOX_MEASURED_LAYOUT,
  LIGHTBOX_READING_LAYOUT,
  LIGHTBOX_TILE_RENDERERS,
  type LightboxTileActions
} from '@components/lightbox/LightboxTiles';

export interface LightboxBoardMainProps {
  board: LightboxBoard | null | undefined;
  refusal: LightboxSourceRefusal | null;
  filter: LightboxFilter;
  lensesOff: readonly LightboxLensId[];
  focus: Pick<UseLightboxFocusReturn, 'bind' | 'focusedItem' | 'litColumns'>;
  runLine: LightboxRunLineView | null;
  onFilter: (filter: LightboxFilter) => void;
  onChooseFromProject: () => void;
  onDismissRefusal: () => void;
  onRun: (scope: LightboxRunScope) => void;
  onStop: (token: string) => void;
  /** The Spark lane's actions ("Not for me", Bring). */
  actions?: LightboxTileActions;
  /**
   * The note above a board opened from a file (`lightboxSnapshotNotice`):
   * its file changed since, offering the re-read (Slice 5A.1); from Slice
   * 5A.2, as the rail went, also one whose file could not be compared, one
   * with parts left out, and one opened from outside the boards folder.
   */
  changedFile?: {
    view: LightboxSnapshotView;
    rereading: boolean;
    onReadCurrentText: () => void;
  };
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
  runLine,
  onFilter,
  onChooseFromProject,
  onDismissRefusal,
  onRun,
  onStop,
  actions,
  changedFile
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
            Choose a chapter from your project, right-click one and pick <b>Open File in Lightbox</b>, or
            select a passage and run <b>Open Selection in Lightbox</b>. The counted board appears at once and
            costs nothing: no model is asked.
          </p>
          <button type="button" className="pm-lb-primary" onClick={onChooseFromProject}>Choose from project…</button>
        </div>
      </div>
    );
  }

  const showMeasured = filter !== 'read';
  const showRead = filter !== 'measured';
  const lensOn = (lens: LightboxLensId) => !lensesOff.includes(lens);
  const readingGrid = LIGHTBOX_READING_LAYOUT.grid.filter((kind) => lensOn(LIGHTBOX_TILE_LENS[kind]));
  const tensionOn = lensOn('tension');
  const [tensionArc] = lightboxTilesOfKind(board, 'tension-arc');
  const trim = board.measured.standards?.publishingFormat?.trimLabel;
  const drawReading = (kind: LightboxReadingTileKind) =>
    React.createElement(LIGHTBOX_TILE_RENDERERS[kind], { key: kind, board, bind: focus.bind, actions, lensesOff });
  const laneOn = lensOn(LIGHTBOX_TILE_LENS[LIGHTBOX_READING_LAYOUT.lane]);
  // The Opinion, the one evaluative tile, is the board's last (Slice 4D).
  const lastOn = lensOn(LIGHTBOX_TILE_LENS[LIGHTBOX_READING_LAYOUT.last]);

  return (
    <div className="pm-lb-scroll">
      {changedFile && (
        <div className={`pm-lb-snapshot is-${changedFile.view.tone} pm-lb-board-notice`} role="status" aria-label="The saved board and its file">
          <Icon name={changedFile.view.tone === 'warn' ? 'alert' : 'history'} size={14} />
          <div className="pm-lb-snapshot-body">
            <p>{changedFile.view.opened}</p>
            <p>{changedFile.view.file}</p>
            {changedFile.view.dropped && <p>{changedFile.view.dropped}</p>}
            {changedFile.view.readCurrentText && (
              <button type="button" className="pm-lb-button" onClick={changedFile.onReadCurrentText} disabled={changedFile.rereading}>
                <Icon name="refresh" size={13} />
                {changedFile.rereading ? 'Reading…' : 'Read the current text'}
              </button>
            )}
          </div>
        </div>
      )}
      <p className="pm-lb-main-eyebrow">
        <i />
        {fileName(board.source.displayPath)} · {board.source.paragraphCount.toLocaleString('en-US')} ¶
        {trim ? ` · ${trim} trim` : ''}
      </p>
      {showRead && lensOn('headline')
        ? drawReading(LIGHTBOX_READING_LAYOUT.heading)
        : <h2 className="pm-lb-headline">{LIGHTBOX_PLAIN_HEADLINE}</h2>}
      <p className="pm-lb-sub">
        <b>Solid tiles are counted</b> by code and cost nothing. <span className="pm-lb-read-text">Dashed
        tiles are read</span> by the model. Each reading cites a quote and a ¶ address, checked against the
        text, and names where it strains.
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
        {runLine && <LightboxRunLine view={runLine} onRun={onRun} onStop={onStop} />}
      </div>
      {/* Each call that did not land, said once (Slice 4J, decision 52); its widgets point here. */}
      <LightboxCallNotes notes={lightboxCallNotes(board)} />

      <LightboxRibbon
        board={board}
        litColumns={focus.litColumns}
        focusedItem={focus.focusedItem}
        bind={focus.bind}
        tensionLensOn={tensionOn}
        tension={lightboxTensionLane(board, tensionOn)}
        tensionTileId={tensionArc?.id}
        endings={lensOn('rhythm') ? lightboxEndingsLane(board, true) : undefined}
        plot={{
          movements: lightboxMovementsLane(board, lensOn('summary')),
          pressure: lightboxPressureLaneView(board, lensOn('pressure')),
          engagement: lightboxEngagementLane(board, lensesOff)
        }}
      />
      {tensionOn
        ? drawReading(LIGHTBOX_READING_LAYOUT.underRibbon)
        : <p className="pm-lb-ribbon-note">The tension lens is off.</p>}

      {showMeasured && LIGHTBOX_MEASURED_LAYOUT.rows.map((kind) =>
        React.createElement(LIGHTBOX_TILE_RENDERERS[kind], { key: kind, board, bind: focus.bind })
      )}

      <div className="pm-lb-grid">
        {showMeasured && LIGHTBOX_MEASURED_LAYOUT.grid.map((kind) =>
          React.createElement(LIGHTBOX_TILE_RENDERERS[kind], { key: kind, board, bind: focus.bind })
        )}
        {showRead && readingGrid.map(drawReading)}
      </div>
      {showRead && laneOn && drawReading(LIGHTBOX_READING_LAYOUT.lane)}
      {showRead && lastOn && drawReading(LIGHTBOX_READING_LAYOUT.last)}
      {showRead && readingGrid.length === 0 && !laneOn && !lastOn && (
        <p className="pm-lb-empty-note">Every reading lens is off. Turn one on in the rail to see where it will land.</p>
      )}
    </div>
  );
};
