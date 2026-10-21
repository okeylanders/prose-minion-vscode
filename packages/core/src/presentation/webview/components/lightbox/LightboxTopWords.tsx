/**
 * LightboxTopWords — the content words the text uses most, sized by count
 * (ADR 2026-10-19 D5), and under them the words it uses once (Slice 4E,
 * `LightboxHapaxList`). Counts and places come from the host; hovering a
 * word lights its paragraphs, clicking pins it.
 */
import * as React from 'react';
import type { LightboxBoard } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';
import { LightboxHapaxList } from '@components/lightbox/LightboxHapaxList';

export interface LightboxTopWordsProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

const SMALLEST_PX = 14;
const LARGEST_PX = 34;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTopWords: React.FC<LightboxTopWordsProps> = ({ board, bind }) => {
  const words = board.measured.topWords;
  const counts = words.map((word) => word.count);
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  const size = (count: number): number =>
    high > low ? Math.round(SMALLEST_PX + ((count - low) / (high - low)) * (LARGEST_PX - SMALLEST_PX)) : 20;
  const tone = (rank: number): string =>
    rank < Math.ceil(words.length / 4) ? 'is-top' : rank < Math.ceil(words.length / 2) ? 'is-mid' : 'is-low';

  return (
    <LightboxTileFrame
      kind="top-words"
      span={3}
      title="Top words · sized by count"
      className="pm-lb-top-words"
      footnote="Hover a word to light its paragraphs. Click to pin it."
    >
      {words.length === 0 ? (
        <p className="pm-lb-empty-note">No content words to count.</p>
      ) : (
        <div className="pm-lb-cloud">
          {words.map((word, rank) => (
            <LightboxItemButton
              key={word.term}
              binding={bind({ kind: 'word', word: word.term })}
              className={`pm-lb-cloud-word ${tone(rank)}`}
              style={{ fontSize: `${size(word.count)}px` }}
              title={`${word.term} ×${word.count}`}
            >
              {word.term}
              <sup>{word.count}</sup>
            </LightboxItemButton>
          ))}
        </div>
      )}
      {/* A new board starts the list at its first page. */}
      <LightboxHapaxList key={board.boardId} board={board} bind={bind} />
    </LightboxTileFrame>
  );
};
