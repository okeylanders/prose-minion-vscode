/**
 * LightboxHapaxList — the words the text uses once (Slice 4E), under the Top
 * Words cloud, in the room the panel has beside Parts of speech.
 *
 * The list is the host's (`measured.hapax`): exactly as many words as the
 * stats row's "hapax" counts, by the same rule, in order of first
 * appearance, so it reads with the chapter and walks the ribbon left to
 * right. Each word is shown as the text writes it and is a board item: hover
 * lights its one paragraph, click pins it and opens its one sentence.
 *
 * The well scrolls inside the panel. It renders `LIGHTBOX_HAPAX_PAGE` words
 * at a time; a button at its end shows the next page and says how many are
 * not shown yet.
 */
import * as React from 'react';
import type { LightboxBoard } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

/** Words rendered at once; the rest are a button press away. */
export const LIGHTBOX_HAPAX_PAGE = 300;

export interface LightboxHapaxListProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxHapaxList: React.FC<LightboxHapaxListProps> = ({ board, bind }) => {
  const words = board.measured.hapax;
  const [shown, setShown] = React.useState(LIGHTBOX_HAPAX_PAGE);
  const hidden = Math.max(0, words.length - shown);

  return (
    <div className="pm-lb-hapax">
      <p className="pm-lb-hapax-head">
        <span className="pm-lb-phrases-label">Used once</span>
        {words.length === 0 ? 'No word is used only once.' : `${pluralize(words.length, 'word')}, in order of appearance`}
      </p>
      {words.length > 0 && (
        <div className="pm-lb-hapax-box">
          <div className="pm-lb-hapax-well" role="region" aria-label={`Words used once: ${words.length.toLocaleString('en-US')}`}>
            {words.slice(0, shown).map((word) => (
              <LightboxItemButton
                key={word.term}
                binding={bind({ kind: 'hapax', word: word.term })}
                className="pm-lb-hapax-word"
                title={`Used once, in ¶${word.paragraph}` + (word.written.toLowerCase() === word.term ? '' : `; counted as “${word.term}”`)}
              >
                {word.written}
              </LightboxItemButton>
            ))}
            {hidden > 0 && (
              <button type="button" className="pm-lb-hapax-more" onClick={() => setShown((count) => count + LIGHTBOX_HAPAX_PAGE)}>
                Show {Math.min(LIGHTBOX_HAPAX_PAGE, hidden).toLocaleString('en-US')} more · {hidden.toLocaleString('en-US')} not shown yet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
