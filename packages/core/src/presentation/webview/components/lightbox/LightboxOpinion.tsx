/**
 * LightboxOpinion — the one evaluative tile, full width and last on the
 * board (ADR 2026-10-19 D7 addendum; epic decisions 15 and 16; Slice 4D).
 *
 * Props-only, through the renderer map. It shows what the host decided:
 * - its own chip, "The one evaluative tile", beside its register;
 * - three view buttons (real buttons, `aria-pressed`), Neutral pressed
 *   until the writer picks another; a withheld view's tab says so, and
 *   pressing it shows the host's reason, never the view's words;
 * - the view's headline, paragraph and Why list, each point with its
 *   weight chip and the observation ids it weighs;
 * - the observations all three views share, under them, each with what it
 *   cites (a tile's label and the quote it holds, or a measured figure);
 *   hovering one lights its cited items' paragraphs, a click pins it;
 * - its standing: stale when anything it cites changed since it was read
 *   (`lightboxOpinionStanding`), with a re-read control priced by the
 *   host's estimate, "up to" the digest's bound;
 * - "Bring this view to Workshop", when the host would carry it.
 * Ignoring it changes nothing: no other tile reads it.
 */
import * as React from 'react';
import type { LightboxOpinionTile, LightboxOpinionViewId } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import type { LightboxBringView } from '@hooks/domain/lightbox/lightboxBring';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxOpinionTileView, type LightboxOpinionTileView } from '@hooks/domain/lightbox/lightboxOpinion';
import { LIGHTBOX_BOARD_GROUP } from '@shared/constants/lightbox';
import { LIGHTBOX_OPINION_CHIP, LIGHTBOX_OPINION_RULE } from '@shared/constants/lightboxOpinion';
import { Icon } from '@components/shared/Icon';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';

/** What the board lets the Opinion do: choose a view, re-read it, bring the view on show. */
export interface LightboxOpinionActions {
  /** The view the writer chose on this board, if any. */
  chosen?: LightboxOpinionViewId;
  onChoose: (view: LightboxOpinionViewId) => void;
  /** "Re-read the Opinion": its cost or why it cannot run now. */
  reread: { note?: string; reason?: string; onReread: () => void };
  bring?: {
    view: (tile: LightboxOpinionTile, view: LightboxOpinionViewId) => LightboxBringView;
    onBring: (tileId: string, view: LightboxOpinionViewId) => void;
    onOpenWorkshop: () => void;
  };
}

const WAITING = 'Runs last: it waits for the other readings of this press to land, then weighs the checked board.';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxOpinion: React.FC<LightboxTileProps> = ({ board, bind, actions }) => {
  const lens = lightboxLensView(board, 'opinion');
  const [tile] = lightboxTilesOfKind(board, 'opinion');
  const opinion = actions?.opinion;
  const model = tile ? lightboxOpinionTileView(board, tile, opinion?.chosen) : undefined;
  const waiting = lens.phase === 'reading' &&
    board.readings.some((group) => group.group !== LIGHTBOX_BOARD_GROUP && group.status === 'running');
  return (
    <LightboxReadingFrame
      kind="opinion"
      span={6}
      title="Opinion"
      frameClass="pm-lb-opinion"
      chip={<span className="pm-lb-op-chip">{LIGHTBOX_OPINION_CHIP}</span>}
      // Its staleness is its standing (below): a cited item changing makes it stale too, not only the text.
      view={{ ...lens, stale: false }}
      empty="The Opinion came back with nothing to show."
      aside={<p className="pm-lb-op-rule">{waiting ? WAITING : LIGHTBOX_OPINION_RULE}</p>}
      footnote={
        <>
          <b>One call returns all three.</b> It runs last, on the checked board, and goes stale when anything it
          cites changes. Ignore it and nothing else on the board changes.
          {lens.friction && <> <b>Where it strains:</b> {lens.friction}</>}
        </>
      }
      after={opinion && <LightboxOpinionControls model={model} opinion={opinion} />}
    >
      {model && <LightboxOpinionBody model={model} bind={bind} onChoose={opinion?.onChoose} />}
    </LightboxReadingFrame>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxOpinionBody: React.FC<{
  model: LightboxOpinionTileView;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  onChoose?: (view: LightboxOpinionViewId) => void;
}> = ({ model, bind, onChoose }) => (
  <>
    {model.standing.stale && <p className="pm-lb-stale-note"><b>Stale</b> {model.standing.note}</p>}
    <div className="pm-lb-op-tabs" role="group" aria-label="Choose a view">
      {model.tabs.map((tab) => (
        <button
          key={tab.view}
          type="button"
          className={`pm-lb-op-tab${tab.pressed ? ' is-on' : ''}${tab.withheld ? ' is-withheld' : ''}`}
          aria-pressed={tab.pressed}
          onClick={() => onChoose?.(tab.view)}
        >
          <span className="pm-lb-op-tab-label">{tab.label}</span>
          <span className="pm-lb-op-tab-sub">{tab.withheld ? 'withheld' : tab.sub}</span>
        </button>
      ))}
    </div>
    <div className="pm-lb-op-body" aria-live="polite">
      {model.view ? (
        <>
          <p className="pm-lb-op-head">{model.view.headline}</p>
          <p className="pm-lb-op-text">{model.view.body}</p>
          <p className="pm-lb-op-sub">Why</p>
          <ul className="pm-lb-op-why" aria-label="Why">
            {model.why.map((row, index) => (
              <li key={index} className="pm-lb-op-w">
                <span className={`pm-lb-op-weight is-${row.weight}`}>{row.weightLabel}</span>
                <span className="pm-lb-op-w-text">
                  {row.text}
                  <span className="pm-lb-op-ev">{row.observations}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="pm-lb-withheld-block"><b>Withheld</b> {model.withheldReason}</p>
      )}
    </div>
    <div className="pm-lb-op-part">
      <p className="pm-lb-op-sub">
        Observations all three views share <span className="pm-lb-reg-chip is-read">From this board</span>
      </p>
      <div className="pm-lb-op-obs">
        {model.observations.map((row) => (
          <LightboxItemButton
            key={row.id}
            binding={bind({ kind: 'observation', tileId: model.tile.id, observation: row.id })}
            className={`pm-lb-op-o${row.weighed ? ' is-weighed' : ''}${row.changed ? ' is-changed' : ''}`}
          >
            <span className="pm-lb-op-oid">{row.id}{row.changed ? ' · changed since' : ''}</span>
            <span className="pm-lb-op-otext">{row.text}</span>
            {row.cites.map((cite, index) => (
              <span key={index} className="pm-lb-op-cite">
                <span className="pm-lb-op-ev">{cite.label}{cite.changed ? ' · changed since' : ''}</span>
                {cite.quote && (
                  <span className="pm-lb-craft-quote">
                    <span className="pm-lb-craft-para">¶{cite.quote.paragraph}</span><q>{cite.quote.text}</q>
                  </span>
                )}
              </span>
            ))}
          </LightboxItemButton>
        ))}
      </div>
      {model.withheldObservations.length > 0 && (
        <ul className="pm-lb-withheld-claims" aria-label="Withheld observations">
          {model.withheldObservations.map((entry) => (
            <li key={entry.id}>
              <b>Withheld · {entry.id}</b>
              <span>{entry.reason}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="pm-lb-op-digest">{model.digestNote}</p>
    </div>
  </>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxOpinionControls: React.FC<{ model?: LightboxOpinionTileView; opinion: LightboxOpinionActions }> = ({ model, opinion }) => {
  const bring = model && opinion.bring ? opinion.bring.view(model.tile, model.shown) : undefined;
  return (
    <div className="pm-lb-op-actions">
      {model && bring && opinion.bring && (
        <span className={`pm-lb-op-action pm-lb-bring is-${bring.state}`}>
          <button
            type="button"
            className="pm-lb-button"
            disabled={bring.disabled}
            title={bring.reason}
            onClick={() => opinion.bring?.onBring(model.tile.id, model.shown)}
          >
            {bring.state === 'bound' && <Icon name="pin" size={12} />}
            {bring.state === 'bound' ? bring.label : `${bring.label} →`}
          </button>
          <span className={`pm-lb-run-note${bring.state === 'refused' ? ' is-refused' : ''}`}>{bring.note}</span>
          {bring.state === 'bound' && (
            <button type="button" className="pm-lb-link" onClick={opinion.bring.onOpenWorkshop}>Open Workshop →</button>
          )}
        </span>
      )}
      <span className="pm-lb-op-action">
        <button
          type="button"
          className="pm-lb-button is-ghost"
          disabled={opinion.reread.reason !== undefined}
          title={opinion.reread.reason ?? opinion.reread.note}
          onClick={opinion.reread.onReread}
        >
          Re-read the Opinion
        </button>
        <span className="pm-lb-run-note">{opinion.reread.reason ?? opinion.reread.note ?? '1 call'}</span>
      </span>
    </div>
  );
};
