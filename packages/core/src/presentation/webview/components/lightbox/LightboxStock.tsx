/**
 * LightboxStock — stock and signature (ADR 2026-10-19 D7 and its addendum;
 * Slice 4B). Where the chapter spends attention:
 * - the cognitive-economy tier bar, counted by code from the beats the
 *   reading classified and code found (counted · read): a share of those
 *   beats, never of the chapter;
 * - signature phrases (read);
 * - familiar phrasing, each phrase counted by code (counted · read), and
 *   "familiar" is not a fault;
 * - air-lock passages: a craft signal, not a risk;
 * - echoes, always with the accuracy callout: the quote is checked, the
 *   resemblance is not.
 * Every item is a board item: hover lights its paragraphs, a click pins it.
 */
import * as React from 'react';
import type { LightboxReadingTile } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxTierShares, lightboxTierSummary } from '@hooks/domain/lightbox/lightboxCraft';
import { LIGHTBOX_ECHO_ACCURACY, LIGHTBOX_FAMILIAR_KIND_LABELS } from '@shared/constants/lightbox';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';

/** A part's heading with its register chip. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCraftHeading: React.FC<{ title: string; chip?: React.ReactNode }> = ({ title, chip }) => (
  <span className="pm-lb-craft-sub">{title}{chip}</span>
);

/** A quote as the chapter has it, with its ¶ address. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const FirstQuote: React.FC<{ tile: LightboxReadingTile }> = ({ tile }) => {
  const quote = tile.evidence[0];
  return quote ? (
    <span className="pm-lb-craft-quote"><span className="pm-lb-craft-para">¶{quote.paragraph}</span><q>{quote.text}</q></span>
  ) : null;
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSignaturePhrases: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const phrases = lightboxTilesOfKind(board, 'signature');
  return phrases.length === 0 ? null : (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Signature phrases" chip={<LightboxRegisterChip register="read" />} />
      {phrases.map((phrase) => (
        <LightboxItemButton key={phrase.id} binding={bind({ kind: 'reading', tileId: phrase.id })} className="pm-lb-craft-row">
          <span className="pm-lb-craft-tag is-signature">Signature</span>
          <span className="pm-lb-craft-body">
            <span className="pm-lb-craft-title">{phrase.title}</span>
            <FirstQuote tile={phrase} />
            <span className="pm-lb-craft-note">{phrase.claim}</span>
          </span>
        </LightboxItemButton>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxFamiliarPhrasing: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const phrases = lightboxTilesOfKind(board, 'familiar-phrase');
  return phrases.length === 0 ? null : (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Familiar phrasing" chip={<LightboxRegisterChip register="counted-read" />} />
      {phrases.map((phrase) => {
        const counted = phrase.support[0];
        return (
          <LightboxItemButton key={phrase.id} binding={bind({ kind: 'reading', tileId: phrase.id })} className="pm-lb-craft-row">
            <span className={`pm-lb-craft-tag is-${phrase.familiar}`}>{LIGHTBOX_FAMILIAR_KIND_LABELS[phrase.familiar]}</span>
            <span className="pm-lb-craft-body">
              <span className="pm-lb-craft-phrase">
                <q>{phrase.phrase}</q>
                {counted && (
                  <b className="pm-lb-craft-count">
                    ×{counted.count} · {counted.paragraphs.slice(0, 6).map((index) => `¶${index}`).join(' ')}
                    {counted.paragraphs.length > 6 ? ` +${counted.paragraphs.length - 6}` : ''}
                  </b>
                )}
              </span>
              <span className="pm-lb-craft-note">{phrase.claim}</span>
            </span>
          </LightboxItemButton>
        );
      })}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxAirLocks: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const passages = lightboxTilesOfKind(board, 'air-lock');
  return passages.length === 0 ? null : (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Air-lock passages" chip={<span className="pm-lb-craft-chip">Craft signal, not risk</span>} />
      {passages.map((passage) => (
        <LightboxItemButton key={passage.id} binding={bind({ kind: 'reading', tileId: passage.id })} className="pm-lb-craft-row">
          <span className="pm-lb-craft-tag is-air-lock">Air-lock</span>
          <span className="pm-lb-craft-body">
            <FirstQuote tile={passage} />
            <span className="pm-lb-craft-note">{passage.claim}</span>
          </span>
        </LightboxItemButton>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxEchoes: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const echoes = lightboxTilesOfKind(board, 'echo');
  return echoes.length === 0 ? null : (
    <div className="pm-lb-craft-part pm-lb-craft-inset">
      <LightboxCraftHeading title="Echoes" chip={<span className="pm-lb-craft-chip">Sounds reminiscent of · unverified</span>} />
      {echoes.map((echo) => (
        <LightboxItemButton key={echo.id} binding={bind({ kind: 'reading', tileId: echo.id })} className="pm-lb-craft-row">
          <span className="pm-lb-craft-tag is-echo">Echo</span>
          <span className="pm-lb-craft-body">
            <FirstQuote tile={echo} />
            <span className="pm-lb-craft-note">Sounds reminiscent of {echo.reminiscentOf}. {echo.claim}</span>
          </span>
        </LightboxItemButton>
      ))}
      <p className="pm-lb-craft-accuracy"><b>Accuracy:</b> {LIGHTBOX_ECHO_ACCURACY}</p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxStock: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [tiers] = lightboxTilesOfKind(board, 'stock-tiers');
  return (
    <LightboxReadingFrame
      kind="stock-tiers"
      span={6}
      title="Stock & signature"
      view={lightboxLensView(board, 'stock')}
      empty="The reading classified no beats and named no phrase."
      footnote={<>Tiers and phrases are <b>counted by code</b> from what the reading names. <b>Familiar</b> means familiar to a reader, not a fault.</>}
    >
      {tiers && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: tiers.id })} className="pm-lb-craft-part pm-lb-tiers">
          <LightboxCraftHeading title="Cognitive economy" chip={<LightboxRegisterChip register="counted-read" />} />
          <span className="pm-lb-tier-bar" role="img" aria-label={lightboxTierSummary(tiers)}>
            {lightboxTierShares(tiers).filter((share) => share.count > 0).map((share) => (
              <i key={share.tier} className={`is-${share.tier}`} style={{ width: `${share.percent}%` }} />
            ))}
          </span>
          <span className="pm-lb-tier-key">
            {lightboxTierShares(tiers).map((share) => (
              <span key={share.tier} className="pm-lb-tier-entry"><i className={`is-${share.tier}`} />{share.label} <b>{share.count}</b></span>
            ))}
          </span>
          <span className="pm-lb-craft-note">
            Of {tiers.classified} beats the reading classified and code found. {tiers.claim}
          </span>
        </LightboxItemButton>
      )}
      <LightboxSignaturePhrases board={board} bind={bind} />
      <LightboxFamiliarPhrasing board={board} bind={bind} />
      <LightboxAirLocks board={board} bind={bind} />
      <LightboxEchoes board={board} bind={bind} />
    </LightboxReadingFrame>
  );
};
