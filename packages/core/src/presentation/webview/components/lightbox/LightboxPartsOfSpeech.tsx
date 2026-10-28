/**
 * LightboxPartsOfSpeech — parts of speech, repeated phrases and style flags
 * (ADR 2026-10-19 D5). The tags come from the word-frequency tool's offline
 * tagger; a repeated phrase is shown only when one of its words is not a
 * stopword. Words and phrases light their paragraphs. A style flag that
 * counts instances (Slice 4E: adverbs, passive voice, weak verbs, filler
 * words) is a board item too: hover lights its paragraphs, click pins it and
 * lists its sentences. Repetitive Words and Clichés count words and phrases,
 * not instances, so they are shown as counts only.
 */
import * as React from 'react';
import type { LightboxBoard } from '@messages';
import type { LightboxItemRef, LightboxPartOfSpeech } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';

export interface LightboxPartsOfSpeechProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

const COLUMNS: ReadonlyArray<{ pos: LightboxPartOfSpeech; heading: string }> = [
  { pos: 'verbs', heading: 'Top verbs' },
  { pos: 'adjectives', heading: 'Top adjectives' },
  { pos: 'nouns', heading: 'Top nouns' },
  { pos: 'adverbs', heading: 'Top adverbs' }
];

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxPartsOfSpeech: React.FC<LightboxPartsOfSpeechProps> = ({ board, bind }) => {
  const { partsOfSpeech, phrases, styleFlags } = board.measured;
  const repeated = [...phrases.bigrams, ...phrases.trigrams];

  return (
    <LightboxTileFrame kind="parts-of-speech" span={3} title="Parts of speech · repetition">
      {partsOfSpeech.available ? (
        <div className="pm-lb-pos">
          {COLUMNS.map(({ pos, heading }) => (
            <div key={pos} className="pm-lb-pos-col">
              <p className="pm-lb-pos-head">{heading}</p>
              {partsOfSpeech[pos].length === 0 && <p className="pm-lb-empty-note">None counted.</p>}
              {partsOfSpeech[pos].map((term) => (
                <LightboxItemButton
                  key={term.term}
                  binding={bind({ kind: 'pos', pos, word: term.term })}
                  className="pm-lb-pos-row"
                >
                  {term.term}
                  <span>{term.count}</span>
                </LightboxItemButton>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="pm-lb-empty-note">The offline part-of-speech tagger did not load, so no tags were counted.</p>
      )}

      <div className="pm-lb-phrases">
        <span className="pm-lb-phrases-label">Repeated phrases</span>
        {repeated.length === 0 && <span className="pm-lb-empty-note">No phrase with a content word repeats.</span>}
        {repeated.map((phrase) => (
          <LightboxItemButton
            key={phrase.term}
            binding={bind({ kind: 'phrase', phrase: phrase.term })}
            className="pm-lb-phrase"
          >
            “{phrase.term}” ×{phrase.count}
          </LightboxItemButton>
        ))}
      </div>

      {styleFlags.length > 0 && (
        <p className="pm-lb-flags">
          <span className="pm-lb-phrases-label">Style flags</span>
          {styleFlags.map((flag) => (flag.id ? (
            <LightboxItemButton
              key={flag.type}
              binding={bind({ kind: 'flag', flag: flag.id })}
              className="pm-lb-flag is-item"
              title={flag.examples.join(', ')}
            >
              {flag.type} <b>{flag.count.toLocaleString('en-US')}</b>
            </LightboxItemButton>
          ) : (
            <span key={flag.type} className="pm-lb-flag" title={flag.examples.join(', ')}>
              {flag.type} <b>{flag.count.toLocaleString('en-US')}</b>
            </span>
          )))}
        </p>
      )}
    </LightboxTileFrame>
  );
};
