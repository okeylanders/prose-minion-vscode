/**
 * LightboxSteering — craft steering (ADR 2026-10-19 D7 second addendum;
 * Slice 4F): being verbs, adverbs (-ly) and intensifiers and fillers, one
 * section each.
 *
 * - **Measured** (solid, drawn before any reading, at no cost): the total
 *   and rate (the numbers tile's own count), narration and dialogue, the
 *   constructions as a bar and a key, the weak verbs among the adverbs' and
 *   the instances in runs of short sentences. Every row lights the
 *   paragraphs that hold its instances.
 * - **Read** (dashed): how the figure works here, and the instance notes:
 *   a stance (Earns, Leans, Compensates), the quote holding the instance,
 *   the why, and, only where a note leans or compensates, the nudge under
 *   "Worth a look" with its one example, if any, under "One way it could
 *   go". The example is an illustration, marked so, and never drawn as a
 *   quote. A note whose instance is in dialogue shows the host's "In
 *   dialogue" line instead: the character's voice, with no nudge (epic
 *   decision 26). Hovering a note lights its paragraph.
 * Nothing here says fix or cut; rewriting happens in the Workshop.
 */
import * as React from 'react';
import type { LightboxSteeringNoteTile, LightboxSteeringStatId } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxSteeringSections, type LightboxSteeringSection } from '@hooks/domain/lightbox/lightboxSteering';
import {
  LIGHTBOX_STEERING_EXAMPLE_LABEL,
  LIGHTBOX_STEERING_EXAMPLE_NOTE,
  LIGHTBOX_STEERING_STANCE_LABELS,
  LIGHTBOX_STEERING_VOICE_LABEL
} from '@shared/constants/lightboxSteering';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';

type Bind = (ref: LightboxItemRef) => LightboxItemBinding;

/** A segment's color: by its place, and neutral for "other", which is always last. */
function segmentClass(construction: string, index: number): string {
  return construction === 'other' ? 'is-other' : `is-seg${index + 1}`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SteeringNote: React.FC<{ note: LightboxSteeringNoteTile; bind: Bind }> = ({ note, bind }) => {
  const [quote] = note.evidence;
  return (
    <LightboxItemButton binding={bind({ kind: 'reading', tileId: note.id })} className={`pm-lb-steer-note is-${note.stance}`}>
      <span className="pm-lb-steer-note-top">
        <span className={`pm-lb-craft-tag is-${note.stance}`}>{LIGHTBOX_STEERING_STANCE_LABELS[note.stance]}</span>
        {quote && <span className="pm-lb-craft-para">¶{quote.paragraph}</span>}
      </span>
      {quote && <span className="pm-lb-craft-quote"><q>{quote.text}</q></span>}
      <span className="pm-lb-craft-note">{note.claim}</span>
      {note.nudge && (
        <span className="pm-lb-steer-nudge"><b>Worth a look</b>{note.nudge}</span>
      )}
      {note.example && (
        <span className="pm-lb-steer-example">
          <b>{LIGHTBOX_STEERING_EXAMPLE_LABEL}</b>
          <span className="pm-lb-steer-example-pair">
            <span className="pm-lb-steer-before">{note.example.before}</span>
            <span className="pm-lb-steer-arrow" aria-hidden="true"> → </span>
            <span className="pm-lb-steer-after">{note.example.after}</span>
          </span>
          <i>{LIGHTBOX_STEERING_EXAMPLE_NOTE}</i>
        </span>
      )}
      {note.exampleWithheld && <span className="pm-lb-steer-withheld"><b>Example withheld</b> {note.exampleWithheld}</span>}
      {note.voice && <span className="pm-lb-steer-voice"><b>{LIGHTBOX_STEERING_VOICE_LABEL}</b> {note.voice}</span>}
    </LightboxItemButton>
  );
};

/**
 * The instance notes, in the order read: one figure's, inside its section,
 * or every figure's (the renderer map's `steering-note`, drawn within the
 * tile).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSteeringNotes: React.FC<LightboxTileProps & { stat?: LightboxSteeringStatId }> = ({ board, bind, stat }) => {
  const notes = lightboxTilesOfKind(board, 'steering-note')
    .filter((note) => stat === undefined || note.stat === stat)
    .sort((a, b) => a.ordinal - b.ordinal);
  return notes.length === 0 ? null : (
    <div className="pm-lb-steer-notes">
      {notes.map((note) => <SteeringNote key={note.id} note={note} bind={bind} />)}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SteeringFigure: React.FC<LightboxTileProps & { section: LightboxSteeringSection; read: boolean }> = ({
  board,
  section,
  read,
  bind
}) => (
  <section className="pm-lb-steer-figure" aria-label={section.label}>
    <LightboxItemButton binding={bind({ kind: 'steering', stat: section.stat })} className="pm-lb-steer-head">
      <span className="pm-lb-steer-name">{section.label}</span>
      <span className="pm-lb-steer-total">{section.headline}</span>
      <span className="pm-lb-steer-meta">{section.split}</span>
    </LightboxItemButton>
    <div className="pm-lb-steer-measured">
      {section.segments.length > 0 && (
        <span className="pm-lb-steer-bar" aria-hidden="true">
          {section.segments.map((segment, index) => (
            <i key={segment.construction} className={segmentClass(segment.construction, index)} style={{ width: `${segment.share}%` }} />
          ))}
        </span>
      )}
      {section.segments.length > 0 && (
        <ul className="pm-lb-steer-key" aria-label={`${section.label} by construction`}>
          {section.segments.map((segment, index) => (
            <li key={segment.construction}>
              <LightboxItemButton
                binding={bind({ kind: 'steering', stat: section.stat, construction: segment.construction })}
                className="pm-lb-steer-row"
              >
                <i className={segmentClass(segment.construction, index)} aria-hidden="true" />
                <span>{segment.label}</span>
                <span className="pm-lb-steer-count">{segment.count.toLocaleString('en-US')}</span>
              </LightboxItemButton>
            </li>
          ))}
        </ul>
      )}
      {!board.measured.steering.tagged && <p className="pm-lb-steer-meta">Constructions are not measured: the part-of-speech tagger did not load.</p>}
      {section.weakVerbs && <p className="pm-lb-steer-meta">{section.weakVerbs}</p>}
      <p className="pm-lb-steer-meta">{section.runs}</p>
    </div>
    {read && section.reading && (
      <LightboxItemButton binding={bind({ kind: 'reading', tileId: section.reading.id })} className="pm-lb-steer-reading">
        <span className="pm-lb-craft-chip">How it works here</span>
        <span className="pm-lb-craft-note">{section.reading.claim}</span>
        {section.reading.evidence.slice(0, 2).map((quote) => (
          <span key={`${quote.paragraph}:${quote.text}`} className="pm-lb-craft-quote">
            <span className="pm-lb-craft-para">¶{quote.paragraph}</span><q>{quote.text}</q>
          </span>
        ))}
      </LightboxItemButton>
    )}
    {read && <LightboxSteeringNotes board={board} bind={bind} stat={section.stat} />}
  </section>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSteering: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const view = lightboxLensView(board, 'steering');
  const sections = lightboxSteeringSections(board);
  return (
    <LightboxReadingFrame
      kind="steering-reading"
      span={6}
      staleFirst
      title="Craft steering"
      view={view}
      frameClass="is-steering"
      empty="The reading found nothing in these figures to steer."
      aside={(
        <div className="pm-lb-craft-part">
          <span className="pm-lb-craft-sub">
            Counts<LightboxRegisterChip register="measured" />
            Readings and notes<LightboxRegisterChip register="read" />
          </span>
          <div className="pm-lb-steer-grid">
            {sections.map((section) => (
              <SteeringFigure key={section.stat} board={board} section={section} read={view.phase === 'ok'} bind={bind} />
            ))}
          </div>
        </div>
      )}
      footnote={(
        <>
          <b>Counts are measured</b> by the numbers&apos; own detectors. <b>Notes are read</b>: each quote holds an instance,
          checked by code. A nudge names a move worth a look, and an example is one way it could go, never your text. The
          call is yours; rewriting happens in the Workshop.
        </>
      )}
    >
      {null}
    </LightboxReadingFrame>
  );
};
