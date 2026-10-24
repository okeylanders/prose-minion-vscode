/**
 * LightboxCallNotes — a call that did not land, said once (Slice 4J, epic
 * decision 52). Props-only over `lightboxCallNotes`.
 *
 * - **The note, once per call**, under the run line: "Call E · failed" and
 *   the host's whole message, the place a paid reply was saved included. It
 *   sits where the writer finishes or re-runs the call, above every widget
 *   but the headline, and whichever rail panel is open. A failure or a cut
 *   is an alert; a stop, which the writer asked for, a status. Each note is
 *   focusable (`tabIndex={-1}`), so a widget's line can bring the writer to
 *   it.
 * - **A widget's short line** (`LightboxCallLine`) in place of the message:
 *   "Call E failed: see its note by the run line. Analyze to try again.", or,
 *   over an earlier reading (decision 49), "Earlier reading · this call
 *   failed: see its note by the run line." "see its note" is a button that
 *   moves the focus to the note; the widget's frame is also described by
 *   the note, so a screen reader hears the whole message with the frame.
 */
import * as React from 'react';
import type { LightboxLensId } from '@messages';
import { lightboxLensGroup } from '@shared/constants/lightbox';
import type { LightboxCallNote } from '@hooks/domain/lightbox/lightboxCallNotes';
import { lightboxCallPointer } from '@hooks/domain/lightbox/lightboxCallNotes';

/** Every call's note, under the run line; nothing when every call landed. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCallNotes: React.FC<{ notes: readonly LightboxCallNote[] }> = ({ notes }) =>
  notes.length === 0 ? null : (
    <div className="pm-lb-call-notes">
      {notes.map((note) => (
        <p
          key={note.id}
          id={note.id}
          tabIndex={-1}
          className={`pm-lb-call-note is-${note.kind}`}
          role={note.kind === 'stopped' ? 'status' : 'alert'}
        >
          <b className="pm-lb-call-note-label">{note.label}</b> {note.message}
        </p>
      ))}
    </div>
  );

/** Bring the writer to a call's note: scrolled into view and focused. */
function showNote(id: string): void {
  const note = document.getElementById(id);
  note?.scrollIntoView?.({ block: 'nearest' });
  note?.focus();
}

/** The short line that points a lens's widget to its call's note; `earlier` over an earlier reading. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCallPointer: React.FC<{ lens: LightboxLensId; note: LightboxCallNote; earlier: boolean }> = ({ lens, note, earlier }) => {
  const words = lightboxCallPointer(lightboxLensGroup(lens), note, earlier);
  return (
    <>
      {words.lead}
      <button
        type="button"
        className="pm-lb-link pm-lb-call-link"
        aria-label={`${words.link}: ${note.label}`}
        onClick={() => showNote(note.id)}
      >
        {words.link}
      </button>
      {words.after}
    </>
  );
};

/** A widget of a call that did not land, with no earlier reading to show: the short line, never the whole message. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCallLine: React.FC<{ lens: LightboxLensId; note: LightboxCallNote; id?: string; prefix?: string }> = ({
  lens,
  note,
  id,
  prefix
}) => (
  <p id={id} className={`pm-lb-reading-notice pm-lb-call-line${note.kind === 'stopped' ? '' : ' is-failed'}`}>
    {prefix && `${prefix} `}
    <LightboxCallPointer lens={lens} note={note} earlier={false} />
  </p>
);
