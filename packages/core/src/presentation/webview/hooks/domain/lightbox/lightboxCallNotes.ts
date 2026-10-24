/**
 * A call that did not land, said once (Slice 4J, epic decision 52). Pure: no
 * React, no transport.
 *
 * A failed call's message (its reason and, for a reply that came back
 * unusable, where the paid reply was saved) used to repeat in every widget
 * of the call. It now shows once, in a note under the run line, where the
 * writer finishes or re-runs it, and each widget it concerns shows a short
 * line pointing there:
 * - **failed**: the group's latest call failed (`error`);
 * - **stopped**: it was stopped, or set aside when the text changed under it
 *   (`error`);
 * - **cut off**: a reply reached the output ceiling (decision 40), and the
 *   lenses the cut touched say so with the place that reply was saved
 *   (`isLightboxCutReplyReason`).
 *
 * **A note is one event, not one group** (PR #170 F-01). Readings are kept
 * until replaced (decision 49), so one group can hold the reasons of
 * several calls: the motif kept by one cut reply, the tension by the next,
 * each saved in its own place. A cut's identity is the place its reply was
 * saved, which every reason the cut wrote carries after its first sentence
 * (`lightboxCutEvent`): one reply cut off gives one note however many
 * lenses it touched, and two replies give two, each widget pointing to its
 * own. A failure or a stop is its group's latest call, matched by its whole
 * message. A widget points to a note only when the reason it shows is that
 * note's; any other reason (a block withheld for its own fault, an older
 * call's failure no note stands for now) is shown in the widget as before.
 * A call being read again has no note. Calls that did not land in the same
 * words (a whole board's run stopped, two calls rate-limited alike) share
 * one note: "Calls A, B, C · stopped".
 */

import type { LightboxBoard, LightboxLensId, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { LIGHTBOX_LENSES, LIGHTBOX_READING_GROUPS, lightboxLensLabel } from '@shared/constants/lightbox';
import { isLightboxCutReplyReason, LIGHTBOX_CUT_BEFORE_REASON, LIGHTBOX_CUT_INSIDE_REASON } from '@shared/constants/lightboxCallNotes';

export type LightboxCallNoteKind = 'failed' | 'stopped' | 'cut-off';

export interface LightboxCallNote {
  /** The calls it says, in run order: one, or several that did not land in the same words. */
  groups: LightboxReadingGroupId[];
  kind: LightboxCallNoteKind;
  /** "Call E · failed", "Calls A, B · stopped"; "Call A · cut off (Tension arc)" beside another note of the same call. */
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

/** A note's document id: the call's first note, then `-2`, `-3` for another event of the same call. */
export function lightboxCallNoteId(group: LightboxReadingGroupId, index = 0): string {
  return index === 0 ? `pm-lb-call-note-${group}` : `pm-lb-call-note-${group}-${index + 1}`;
}

/**
 * Which cut a reason says: what follows its first sentence, the place its
 * reply was saved (or that it could not be). Undefined for a reason that is
 * not a cut's.
 */
export function lightboxCutEvent(reason: string): string | undefined {
  if (!isLightboxCutReplyReason(reason)) {
    return undefined;
  }
  const lead = [LIGHTBOX_CUT_INSIDE_REASON, LIGHTBOX_CUT_BEFORE_REASON].find((sentence) => reason.startsWith(sentence));
  return lead ? reason.slice(lead.length).trim() : reason;
}

/** The notes of a group's calls that did not land: its latest call's failure or stop, then each cut whose reasons it still shows. */
export function lightboxCallNotesOf(group: LightboxReadingGroup | undefined): LightboxCallNote[] {
  if (!group || group.status === 'running' || group.status === 'not-run') {
    return [];
  }
  const found: Array<{ kind: LightboxCallNoteKind; message: string; lenses: LightboxLensId[] }> = [];
  if ((group.status === 'failed' || group.status === 'cancelled') && group.error) {
    found.push({ kind: group.status === 'failed' ? 'failed' : 'stopped', message: group.error, lenses: [] });
  }
  // Each cut once, however many lenses it touched; its message names the block it was cut inside when it has one.
  const cuts = new Map<string, { reasons: string[]; lenses: LightboxLensId[] }>();
  for (const { lens, reason } of cutReasons(group)) {
    const event = lightboxCutEvent(reason) as string;
    const entry = cuts.get(event) ?? { reasons: [], lenses: [] };
    entry.reasons.push(reason);
    entry.lenses.push(lens);
    cuts.set(event, entry);
  }
  for (const { reasons, lenses } of cuts.values()) {
    const message = reasons.find((reason) => reason.startsWith(LIGHTBOX_CUT_INSIDE_REASON)) ?? reasons[0];
    found.push({ kind: 'cut-off', message, lenses: [...new Set(lenses)] });
  }
  return found.map(({ kind, message, lenses }, index) => ({
    groups: [group.group],
    kind,
    // Beside another note of the same call, a cut names the lenses it touched.
    label: `Call ${group.group} · ${KIND_WORDS[kind].label}${found.length > 1 && lenses.length > 0 ? ` (${lenses.map(lightboxLensLabel).join(', ')})` : ''}`,
    message,
    id: lightboxCallNoteId(group.group, index)
  }));
}

/** Every call's notes, in run order; calls that did not land in the same words share one. */
export function lightboxCallNotes(board: Pick<LightboxBoard, 'readings'>): LightboxCallNote[] {
  const notes: LightboxCallNote[] = [];
  for (const id of LIGHTBOX_READING_GROUPS) {
    for (const note of lightboxCallNotesOf(board.readings.find((group) => group.group === id))) {
      const same = notes.find((entry) => entry.kind === note.kind && entry.message === note.message);
      if (same) {
        same.groups.push(id);
        same.label = `Calls ${same.groups.join(', ')} · ${KIND_WORDS[note.kind].label}`;
      } else {
        notes.push(note);
      }
    }
  }
  return notes;
}

/** The note of call `group` whose message `reason` is, if one stands for it. */
export function lightboxBoardCallNote(
  board: Pick<LightboxBoard, 'readings'>,
  group: LightboxReadingGroupId,
  reason: string | undefined
): LightboxCallNote | undefined {
  return lightboxCallNotes(board).find((note) => note.groups.includes(group) && lightboxPointsToCallNote(note, reason));
}

/**
 * Whether a widget's reason is the note's own, so the widget points to it
 * instead of repeating it: the same message, or, for a cut, the same cut
 * (the same saved reply), never just any cut.
 */
export function lightboxPointsToCallNote(note: LightboxCallNote | undefined, reason: string | undefined): boolean {
  if (!note || reason === undefined) {
    return false;
  }
  return note.kind === 'cut-off' ? lightboxCutEvent(reason) === lightboxCutEvent(note.message) : reason === note.message;
}

/**
 * A widget's short line: "Call E failed: see its note by the run line.
 * Analyze to try again.", or, over an earlier reading, "Earlier reading ·
 * this call failed: see its note by the run line."
 */
export function lightboxCallPointer(
  group: LightboxReadingGroupId,
  note: LightboxCallNote,
  earlier: boolean
): { lead: string; link: string; after: string } {
  const words = KIND_WORDS[note.kind];
  return earlier
    ? { lead: `${words.earlier}: `, link: 'see its note', after: ' by the run line.' }
    : { lead: `Call ${group} ${words.short}: `, link: 'see its note', after: ' by the run line. Analyze to try again.' };
}

/** The cut reasons a group shows, lens by lens in rail order: its withheld blocks', then its earlier readings'. */
function cutReasons(group: LightboxReadingGroup): Array<{ lens: LightboxLensId; reason: string }> {
  const reasons = [...group.withheldBlocks, ...(group.earlierLenses ?? [])]
    .filter((entry) => isLightboxCutReplyReason(entry.reason));
  const order = LIGHTBOX_LENSES.map((lens) => lens.id);
  return reasons
    .map((entry, index) => ({ entry, index }))
    .sort((x, y) => order.indexOf(x.entry.lens) - order.indexOf(y.entry.lens) || x.index - y.index)
    .map(({ entry }) => ({ lens: entry.lens, reason: entry.reason }));
}
