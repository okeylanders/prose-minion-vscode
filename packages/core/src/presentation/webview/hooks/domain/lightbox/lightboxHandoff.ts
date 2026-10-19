/**
 * "Build as a lens in Lexical Gravity", as the Lightbox webview offers it
 * (ADR 2026-10-19 D11; Slice 3). Pure: no React, no transport.
 *
 * The webview only names a pinned borrowed field; the host resolves it on its
 * current board, re-checks it and hands it to the Workshop, which opens its
 * Lexical Gravity widget's Build lens with the subject filled in. Nothing is
 * built until the writer presses Build there. Here the action is labeled,
 * disabled with a reason when the host would refuse (a stale field, a lens
 * being read again), and shows the host's answer.
 */

import type {
  LightboxBoard,
  LightboxGravityFieldTile,
  LightboxHandOffPayload,
  LightboxHandOffResultPayload
} from '@messages';

export const LIGHTBOX_BUILD_LENS_LABEL = 'Build as a lens in Lexical Gravity';

/** The gravity tile's footnote. */
export const LIGHTBOX_BUILD_LENS_HINT =
  'Pin a field, then Build as a lens to open it in Lexical Gravity in the Workshop, where you decide what, if anything, to do with it.';

/** The handoff this webview has asked for, until the host answers, then the answer. */
export type LightboxHandOffState =
  | { status: 'sending'; boardId: string; fieldId: string }
  | { status: 'answered'; result: LightboxHandOffResultPayload };

export interface LightboxBuildLensView {
  label: string;
  disabled: boolean;
  /** Why it is disabled, when it is. */
  reason?: string;
  /** What pressing it does, or the host's answer for this field. */
  note: string;
  /** The host's answer for this field: sent, or refused. */
  outcome?: 'sent' | 'refused';
}

const NOTE = 'Opens Lexical Gravity in the Workshop with this field as the subject. Nothing is built until you press Build there.';

/** The request the webview sends: it names the field, nothing more. */
export function lightboxBuildLensRequest(boardId: string, fieldId: string): LightboxHandOffPayload {
  return { kind: 'lexical-gravity-seed', boardId, fieldId };
}

/** The action for a pinned borrowed field. */
export function lightboxBuildLensView(
  board: LightboxBoard,
  field: LightboxGravityFieldTile,
  handoff: LightboxHandOffState | null
): LightboxBuildLensView {
  const group = board.readings.find((candidate) => candidate.tiles.some((tile) => tile.id === field.id));
  const stale = group?.staleLenses?.some((mark) => mark.lens === field.lens) ?? false;
  const reading = group?.status === 'running' && (group.pending?.includes(field.lens) ?? false);
  const mine = handoff && (handoff.status === 'sending'
    ? handoff.fieldId === field.id && handoff.boardId === board.boardId
    : handoff.result.fieldId === field.id && handoff.result.boardId === board.boardId);
  const reason = stale
    ? 'Read against an earlier version of the chapter. Read the lens again before building it.'
    : reading
      ? 'This lens is being read again.'
      : mine && handoff?.status === 'sending'
        ? 'Opening the Workshop…'
        : undefined;
  const answer = mine && handoff?.status === 'answered' ? handoff.result : undefined;
  return {
    label: LIGHTBOX_BUILD_LENS_LABEL,
    disabled: reason !== undefined,
    ...(reason ? { reason } : {}),
    note: answer?.message ?? reason ?? NOTE,
    ...(answer ? { outcome: answer.ok ? 'sent' as const : 'refused' as const } : {})
  };
}
