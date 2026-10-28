/**
 * LightboxCharacters — the vibes the people on the page give (ADR 2026-10-19
 * D7). A read tile: each card is one character as this chapter shows them,
 * with the name code counted, a resemblance (never a role), what they seem
 * to want and to hide, and where they live in the chapter.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxParagraphStrip, lightboxTopSupport } from '@components/lightbox/LightboxReadingParts';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCharacters: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxReadingFrame
    kind="character"
    span={6}
    title="Characters · the vibes they give"
    view={lightboxLensView(board, 'characters')}
    empty="No one on the page is shown enough to read."
  >
    <div className="pm-lb-characters">
      {lightboxTilesOfKind(board, 'character').map((character) => (
        <LightboxItemButton
          key={character.id}
          binding={bind({ kind: 'reading', tileId: character.id })}
          className="pm-lb-character"
        >
          <span className="pm-lb-character-top">
            <span className="pm-lb-character-name">{character.title}</span>
            {lightboxTopSupport(character) && <span className="pm-lb-character-count">{lightboxTopSupport(character)}</span>}
          </span>
          <span className="pm-lb-character-archetype">{character.archetype}</span>
          <span className="pm-lb-character-energy">{character.energy}</span>
          <span className="pm-lb-character-kv">
            <span><b>Wants</b>{character.wants}</span>
            <span><b>Hides</b>{character.hides}</span>
          </span>
          <LightboxParagraphStrip board={board} paragraphs={character.paragraphs} />
        </LightboxItemButton>
      ))}
    </div>
  </LightboxReadingFrame>
);
