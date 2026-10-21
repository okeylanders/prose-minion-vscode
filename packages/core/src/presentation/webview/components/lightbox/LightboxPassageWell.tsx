/**
 * LightboxPassageWell — the inspector's wells (Slice 4E). Props-only: the
 * view model comes from `useLightboxPassages`.
 *
 * - **Paragraph text.** A pinned paragraph's whole text, as the chapter has
 *   it, in a scrollable, labelled, focusable well. Reached from a counted
 *   term, that term's instances are lit, with the count lit and a way back
 *   to the term.
 * - **Sentences.** Every sentence holding an instance of a pinned counted
 *   term, as an ordered list in a scrollable, labelled, focusable well, the
 *   instances lit, each row with its ¶ address. An address is a board item:
 *   hover lights its paragraph, click pins it, lit by the term.
 *
 * The inspector reads changes out politely; a well's text is not read out
 * (`aria-live="off"`), only its heading and notes.
 */
import * as React from 'react';
import type { LightboxPassageSegment, LightboxPassageRow } from '@messages';
import type { LightboxPassageWellView } from '@hooks/domain/lightbox/lightboxPassages';
import type { LightboxItemRef, LightboxTermRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxPassageWellProps {
  view: LightboxPassageWellView;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

/** A stretch of text, lit when it is part of an instance. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxPassageText: React.FC<{ segments: readonly LightboxPassageSegment[] }> = ({ segments }) => (
  <>
    {segments.map((segment, index) => (segment.instances
      ? <mark key={index} className="pm-lb-mark" data-instances={segment.instances.join(' ')}>{segment.text}</mark>
      : <React.Fragment key={index}>{segment.text}</React.Fragment>))}
  </>
);

/** The paragraphs a row stands in, in order, each once. */
const rowParagraphs = (row: LightboxPassageRow) => [...new Set(row.sentences.map((sentence) => sentence.paragraph))];

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxSentenceRow: React.FC<{
  row: LightboxPassageRow;
  term: LightboxTermRef;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}> = ({ row, term, bind }) => (
  <li className="pm-lb-well-row">
    <span className="pm-lb-well-where">
      {rowParagraphs(row).map((paragraph) => (
        <LightboxItemButton
          key={paragraph}
          binding={bind({ kind: 'paragraphs', from: paragraph, to: paragraph, via: term })}
          className="pm-lb-well-address"
          title={`Pin ¶${paragraph}, its text lit`}
        >
          ¶{paragraph}
        </LightboxItemButton>
      ))}
    </span>
    <span className="pm-lb-well-text">
      {row.sentences.map((sentence, index) => (
        <React.Fragment key={`${sentence.paragraph}:${sentence.sentence}`}>
          {index > 0 && (sentence.paragraph !== row.sentences[index - 1].paragraph ? <span className="pm-lb-well-break"> ¶ </span> : ' ')}
          <LightboxPassageText segments={sentence.segments} />
        </React.Fragment>
      ))}
    </span>
  </li>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxPassageWell: React.FC<LightboxPassageWellProps> = ({ view, bind }) => {
  const { passage, term } = view;
  return (
    <div className={`pm-lb-passage is-${view.kind}`} data-status={view.status}>
      <p className="pm-lb-label">
        {view.label}
        {view.header && <span className="pm-lb-passage-count"> · {view.header}</span>}
      </p>
      {view.note && <p className={`pm-lb-passage-note${view.status === 'refused' ? ' is-refused' : ''}`} role="status">{view.note}</p>}
      {passage?.kind === 'paragraphs' && (
        <div className="pm-lb-well" role="region" aria-label={view.regionLabel} tabIndex={0} aria-live="off">
          {passage.paragraphs.map((paragraph) => (
            <p key={paragraph.index} className="pm-lb-well-paragraph">
              {passage.paragraphs.length > 1 && <span className="pm-lb-well-number">¶{paragraph.index}</span>}
              <LightboxPassageText segments={paragraph.segments} />
            </p>
          ))}
        </div>
      )}
      {passage?.kind === 'instances' && term && (
        <div className="pm-lb-well" role="region" aria-label={view.regionLabel} tabIndex={0} aria-live="off">
          <ol className="pm-lb-well-rows">
            {passage.rows.map((row) => (
              <LightboxSentenceRow
                key={`${row.sentences[0].paragraph}:${row.sentences[0].sentence}`}
                row={row}
                term={term}
                bind={bind}
              />
            ))}
          </ol>
        </div>
      )}
      {view.more && <p className="pm-lb-passage-note">{view.more}</p>}
      {(view.lit || view.back) && (
        <div className="pm-lb-passage-lit">
          {view.lit && <span>{view.lit}</span>}
          {view.back && (
            <LightboxItemButton binding={bind(view.back.ref)} className="pm-lb-passage-back">
              ← {view.back.label}
            </LightboxItemButton>
          )}
        </div>
      )}
    </div>
  );
};
