/**
 * A call that did not land, said once (Slice 4J, epic decision 52). Pure: no
 * React, no transport.
 *
 * A failed call's message (its reason and, for a reply that came back
 * unusable, where the paid reply was saved) used to repeat in every widget
 * of the call. It now shows once, in the call's note under the run line,
 * where the writer finishes or re-runs it, and each widget of the call shows
 * a short line pointing there:
 * - **failed**: the group's latest call failed (`error`);
 * - **stopped**: it was stopped, or set aside when the text changed under it
 *   (`error`);
 * - **cut off**: its reply reached the output ceiling (decision 40), and the
 *   lenses the cut touched say so with the place the reply was saved
 *   (`isLightboxCeilingReason`).
 * A widget whose state carries the note's message points to it: its group's
 * notice, its earlier reading's reason (decision 49: "Earlier reading · this
 * call failed"), or its block withheld by the cut. A reason that is not the
 * note's (an older call's, a block withheld for its own fault) is shown in
 * the widget as before. A call being read again has no note.
 */

import type { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { isLightboxCeilingReason, LIGHTBOX_CEILING_CUT_REASON } from '@shared/constants/lightboxCallNotes';

export type LightboxCallNoteKind = 'failed' | 'stopped' | 'cut-off';

export interface LightboxCallNote {
  group: LightboxReadingGroupId;
  kind: LightboxCallNoteKind;
  /** "Call E · failed". */
  label: string;
  /** The host's whole message, once. */
  message: string;
  /** The document id of the note, which each widget's line points to. */
  id: string;
}

const KIND_WORDS: Readonly<Record<LightboxCallNoteKind, { label: string; short: string; earlier: string }>> = {
  failed: { label: 'failed', short: 'failed', earlier: 'this call failed' },
  stopped: { label: 'stopped', short: 'was stopped', earlier: 'this call was stopped' },
  // eslint-disable-next-line @typescript-eslint/naming-convention -- note kinds are kebab-case, as their classes are.
  'cut-off': { label: 'cut off', short: 'was cut off at the output ceiling', earlier: 'this call was cut off' }
};

/** The note's document id: one per call. */
export function lightboxCallNoteId(group: LightboxReadingGroupId): string {
  return `pm-lb-call-note-${group}`;
}

/** The note of a group's call that did not land, if one did not. */
export function lightboxCallNoteOf(group: LightboxReadingGroup | undefined): LightboxCallNote | undefined {
  if (!group || group.status === 'running' || group.status === 'not-run') {
    return undefined;
  }
  const note = (kind: LightboxCallNoteKind, message: string): LightboxCallNote => ({
    group: group.group,
    kind,
    label: `Call ${group.group} · ${KIND_WORDS[kind].label}`,
    message,
    id: lightboxCallNoteId(group.group)
  });
  if (group.status === 'failed' || group.status === 'cancelled') {
    return group.error ? note(group.status === 'failed' ? 'failed' : 'stopped', group.error) : undefined;
  }
  // Cut off: the block it was cut inside names the place first; a cut between blocks, the first block it never reached.
  const reasons = [
    ...group.withheldBlocks.map((block) => block.reason),
    ...(group.earlierLenses ?? []).map((mark) => mark.reason)
  ].filter(isLightboxCeilingReason);
  return reasons.length > 0 ? note('cut-off', reasons.sort((a, b) => cutFirst(a) - cutFirst(b))[0]) : undefined;
}

/** Every call's note, in run order. */
export function lightboxCallNotes(board: Pick<LightboxBoard, 'readings'>): LightboxCallNote[] {
  return LIGHTBOX_READING_GROUPS.flatMap((id) => {
    const note = lightboxCallNoteOf(board.readings.find((group) => group.group === id));
    return note ? [note] : [];
  });
}

/** Whether a widget's reason is the call note's own, so the widget points to it instead of repeating it. */
export function lightboxPointsToCallNote(note: LightboxCallNote | undefined, reason: string | undefined): boolean {
  if (!note || reason === undefined) {
    return false;
  }
  return reason === note.message || (note.kind === 'cut-off' && isLightboxCeilingReason(reason));
}

/**
 * A widget's short line: "Call E failed: see its note by the run line.
 * Analyze to try again.", or, over an earlier reading, "Earlier reading ·
 * this call failed: see its note by the run line."
 */
export function lightboxCallPointer(note: LightboxCallNote, earlier: boolean): { lead: string; link: string; after: string } {
  const words = KIND_WORDS[note.kind];
  return earlier
    ? { lead: `${words.earlier}: `, link: 'see its note', after: ' by the run line.' }
    : { lead: `Call ${note.group} ${words.short}: `, link: 'see its note', after: ' by the run line. Analyze to try again.' };
}

function cutFirst(reason: string): number {
  return reason.startsWith(LIGHTBOX_CEILING_CUT_REASON) ? 0 : 1;
}
