/**
 * LightboxRhythm — rhythm and handoffs (ADR 2026-10-19 D7; Slice 4B).
 *
 * - **Measured** (drawn before any reading): each ribbon column's sentence
 *   lengths, its mean and its longest, from the host's per-paragraph
 *   sentence lengths; the mean, the longest sentence and the very short
 *   ones.
 * - **Read:** how each column's paragraphs end (Lands, Holds, Opens), whether
 *   the sentences move toward conclusion, and handoff samples: two sentences
 *   code found side by side in one paragraph, with what is carried, what
 *   changes and the effect.
 * Hovering a column lights its paragraphs; a reading pins like any other.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind, pluralize } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxEndingTally, lightboxSentenceColumns } from '@hooks/domain/lightbox/lightboxCraft';
import { LIGHTBOX_ENDING_LABELS, LIGHTBOX_HANDOFF_EFFECT_LABELS } from '@shared/constants/lightbox';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';
import { LightboxCraftHeading } from '@components/lightbox/LightboxStock';

const BAR_HEIGHT = 56;

/** The measured part: sentence lengths per column, and the summary line. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxSentenceLengths: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const columns = lightboxSentenceColumns(board);
  const scale = Math.max(1, ...columns.map((column) => column.longest));
  const { longest, veryShort, underWords } = board.measured.sentences;
  return (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Sentence lengths by paragraph" chip={<LightboxRegisterChip register="measured" />} />
      <div className="pm-lb-rhythm-bars" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <LightboxItemButton
            key={`${column.from}-${column.to}`}
            binding={bind({ kind: 'paragraphs', from: column.from, to: column.to })}
            className="pm-lb-rhythm-col"
            label={column.from === column.to
              ? `Sentence lengths in paragraph ${column.from}`
              : `Sentence lengths in paragraphs ${column.from} to ${column.to}`}
            title={`¶${column.from}${column.to > column.from ? `–¶${column.to}` : ''} · ${pluralize(column.sentences, 'sentence')} · ` +
              `mean ${column.mean} words · longest ${column.longest}`}
          >
            <i className="is-longest" style={{ height: `${Math.round((column.longest / scale) * BAR_HEIGHT)}px` }} />
            <i className="is-mean" style={{ height: `${Math.max(2, Math.round((column.mean / scale) * BAR_HEIGHT))}px` }} />
          </LightboxItemButton>
        ))}
      </div>
      <span className="pm-lb-craft-note">
        Mean {board.measured.headline.averageWordsPerSentence} words
        {longest && <> · longest {longest.words} (¶{longest.paragraph})</>}
        {' · '}{pluralize(veryShort, 'sentence')} under {underWords} words. Measured by code, per paragraph.
      </span>
    </div>
  );
};

/** Handoff samples: drawn inside the rhythm tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxHandoffs: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const handoffs = lightboxTilesOfKind(board, 'handoff');
  return handoffs.length === 0 ? null : (
    <div className="pm-lb-craft-part pm-lb-craft-inset">
      <LightboxCraftHeading title="Handoff samples" chip={<LightboxRegisterChip register="read" />} />
      {handoffs.map((handoff) => (
        <LightboxItemButton key={handoff.id} binding={bind({ kind: 'reading', tileId: handoff.id })} className="pm-lb-handoff">
          <span className="pm-lb-craft-para">¶{handoff.from.paragraph}</span>
          <span className="pm-lb-handoff-pair">
            <q>{handoff.from.text}</q><span className="pm-lb-handoff-arrow" aria-label="then">→</span><q>{handoff.to.text}</q>
          </span>
          <span className="pm-lb-handoff-kv"><b>Carried</b>{handoff.carried}</span>
          <span className="pm-lb-handoff-kv"><b>What changes</b>{handoff.claim}</span>
          <span className="pm-lb-handoff-kv">
            <b>Effect</b><span className={`pm-lb-craft-tag is-${handoff.effect}`}>{LIGHTBOX_HANDOFF_EFFECT_LABELS[handoff.effect]}</span>
          </span>
        </LightboxItemButton>
      ))}
      <span className="pm-lb-craft-note">Code checks that both quotes are adjacent sentences in one paragraph.</span>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxRhythm: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [endings] = lightboxTilesOfKind(board, 'rhythm-endings');
  const tally = endings ? lightboxEndingTally(endings, board.ribbon) : undefined;
  return (
    <LightboxReadingFrame
      kind="rhythm-endings"
      span={6}
      title="Rhythm & handoffs"
      view={lightboxLensView(board, 'rhythm')}
      empty="The reading returned no endings and no handoff."
      aside={<LightboxSentenceLengths board={board} bind={bind} />}
      footnote={<><b>Lengths are measured;</b> endings and handoffs are a reading. Stress and sound are one possible reading aloud, not a fact.</>}
    >
      {endings && tally && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: endings.id })} className="pm-lb-craft-part pm-lb-endings">
          <LightboxCraftHeading title="How each paragraph ends" chip={<LightboxRegisterChip register="read" />} />
          <span className="pm-lb-endings-row" style={{ gridTemplateColumns: `repeat(${Math.max(1, endings.endings.length)}, minmax(0, 1fr))` }}>
            {endings.endings.map((ending, index) => (
              <i key={index} className={ending ? `is-${ending}` : 'is-unread'} title={ending ? LIGHTBOX_ENDING_LABELS[ending] : 'Changed since the reading'} />
            ))}
          </span>
          <span className="pm-lb-tier-key">
            <span className="pm-lb-tier-entry"><i className="pm-lb-ending-key is-lands" />Lands <b>{tally.lands}</b></span>
            <span className="pm-lb-tier-entry"><i className="pm-lb-ending-key is-holds" />Holds <b>{tally.holds}</b></span>
            <span className="pm-lb-tier-entry">
              <i className="pm-lb-ending-key is-opens" />Opens <b>{tally.opens}</b>
              {tally.opensAt.length > 0 && ` · ${tally.opensAt.slice(0, 8).map((index) => `¶${index}`).join(', ')}`}
            </span>
          </span>
          <span className="pm-lb-craft-note"><b>Do sentences move toward conclusion?</b> {endings.claim}</span>
        </LightboxItemButton>
      )}
      <LightboxHandoffs board={board} bind={bind} />
    </LightboxReadingFrame>
  );
};
