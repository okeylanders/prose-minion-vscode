/**
 * LightboxGravity — the lexical gravity tile (ADR 2026-10-19 D7; Slice 3).
 *
 * Borrowed fields the prose leans on: the orbit places them by the pull their
 * reading claims, and each field row shows its governing metaphor, the pull
 * drawn hatched and labeled a claim, the host's counted terms and hits, the
 * hits split by degree (1° latent, 2° felt, 3° overt), where in the chapter it
 * recurs and the host's drift note. A field the host counted under the
 * gravity line is drawn faint, below the line, not dropped. Under the fields:
 * the collisions, where two fields share a sentence, and the fields set aside
 * because they are literal in the scene, each with its reason. Every item is
 * a board item: hover lights its paragraphs, a click pins it.
 */
import * as React from 'react';
import type { LightboxGravityFieldTile } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind, pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import {
  lightboxBelowLineNote,
  lightboxDegreeAria,
  lightboxDriftNote,
  lightboxFieldCountLabel,
  lightboxPullLabel
} from '@hooks/domain/lightbox/lightboxGravity';
import { LIGHTBOX_BUILD_LENS_HINT } from '@hooks/domain/lightbox/lightboxHandoff';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxParagraphStrip } from '@components/lightbox/LightboxReadingParts';
import { LightboxGravityOrbit } from '@components/lightbox/LightboxGravityOrbit';

function coreLabel(displayPath: string): string {
  const name = displayPath.split(/[\\/]/).pop() ?? displayPath;
  const stem = name.replace(/\.[^.]+$/, '') || name;
  return stem.length > 8 ? `${stem.slice(0, 7)}…` : stem;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxGravityFieldRow: React.FC<LightboxTileProps & { field: LightboxGravityFieldTile }> = ({ board, bind, field }) => {
  const [latent, felt, overt] = field.degreeHits;
  return (
    <LightboxItemButton
      binding={bind({ kind: 'reading', tileId: field.id })}
      className={`pm-lb-field${field.belowLine ? ' is-below' : ''}`}
    >
      <span className="pm-lb-field-top">
        <span className="pm-lb-field-name">{field.title}</span>
        <span className="pm-lb-field-pull">{lightboxPullLabel(field.pull)}</span>
      </span>
      <span className="pm-lb-field-metaphor">{field.metaphor}</span>
      <span className="pm-lb-neighbor-track" aria-hidden="true">
        <span className="pm-lb-neighbor-fill" style={{ width: `${Math.round(field.pull * 100)}%` }} />
      </span>
      <span className="pm-lb-field-row">
        <span className="pm-lb-field-hits">{lightboxFieldCountLabel(field)}</span>
        <span className="pm-lb-degree" role="img" aria-label={lightboxDegreeAria(field)}>
          <span className="is-latent" style={{ flexGrow: latent }} />
          <span className="is-felt" style={{ flexGrow: felt }} />
          <span className="is-overt" style={{ flexGrow: overt }} />
        </span>
      </span>
      <LightboxParagraphStrip board={board} paragraphs={field.paragraphs} />
      <span className="pm-lb-field-drift">{field.belowLine ? lightboxBelowLineNote(field) : lightboxDriftNote(field)}</span>
    </LightboxItemButton>
  );
};

/** Where two borrowed fields share a sentence. Drawn inside the gravity tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxGravityCollisions: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <>
    {lightboxTilesOfKind(board, 'gravity-collision').map((collision) => {
      const [quote] = collision.evidence;
      return (
        <LightboxItemButton key={collision.id} binding={bind({ kind: 'reading', tileId: collision.id })} className="pm-lb-collision">
          <span className="pm-lb-collision-label">Collision · ¶{quote?.paragraph}</span>
          {quote && <q className="pm-lb-collision-quote">{quote.text}</q>}
          <span className="pm-lb-collision-note">{collision.fields[0]} and {collision.fields[1]} share a sentence.</span>
        </LightboxItemButton>
      );
    })}
  </>
);

/** Fields set aside because they are literal in the scene. Drawn inside the gravity tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxGravityLiterals: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <>
    {lightboxTilesOfKind(board, 'gravity-literal').map((literal) => (
      <p key={literal.id} className="pm-lb-foot">
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: literal.id })} className="pm-lb-literal">
          Set aside as literal: <b>{literal.title}</b>, {pluralize(literal.hits, 'hit')}. {literal.claim}
        </LightboxItemButton>
      </p>
    ))}
  </>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxGravity: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const fields = lightboxTilesOfKind(board, 'gravity-field');
  return (
    <LightboxReadingFrame
      kind="gravity-field"
      span={6}
      title="Lexical gravity · borrowed fields the prose leans on"
      view={lightboxLensView(board, 'gravity')}
      empty="The reading found no field to name, borrowed or literal."
      aside={<p className="pm-lb-genre-note">Pull is a claim, drawn hatched. Hits are counted by code.</p>}
      footnote={LIGHTBOX_BUILD_LENS_HINT}
    >
      <div className="pm-lb-gravity">
        <LightboxGravityOrbit fields={fields} core={coreLabel(board.source.displayPath)} bind={bind} />
        <div className="pm-lb-gravity-list">
          {fields.length === 0 && (
            <p className="pm-lb-empty-note">The prose borrows no field here. What the reading found is literal, set aside below.</p>
          )}
          {fields.map((field) => <LightboxGravityFieldRow key={field.id} board={board} bind={bind} field={field} />)}
          {fields.length > 0 && (
            <span className="pm-lb-degree-key">
              By degree<i className="is-latent" />1° latent<i className="is-felt" />2° felt<i className="is-overt" />3° overt
            </span>
          )}
        </div>
      </div>
      <LightboxGravityCollisions board={board} bind={bind} />
      <LightboxGravityLiterals board={board} bind={bind} />
    </LightboxReadingFrame>
  );
};
