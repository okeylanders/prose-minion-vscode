/**
 * What a press asks to read, checked before anything is reserved or sent
 * (ADR 2026-10-19 D6; Slice 4I). Pure: split from `LightboxReadingHandler`,
 * which owns the press, its snapshot, its reservation and its refusals.
 *
 * - **The scope is the webview's, never trusted as it stands.** A mode the
 *   host does not know, a lens or a group it does not know, a group that is
 *   no model call (counting, Measure, is free and has no call), or a lens
 *   the named call does not read is refused by name. The webview names a
 *   call and at most the lens pressed; it never names a list of lenses.
 * - **The calls come from the shared planner** (`lightboxPlannedCalls`).
 *   One call (`group`) reads its lenses that are on, with the lens named
 *   even when it is off; its other lenses that are off stay out.
 * - **Group F alone reads the board as it stands.** With nothing on it read
 *   and current, it is refused with the Opinion's own reason
 *   (`lightboxOpinionNothingToWeigh`), before the board is reserved. F's
 *   call still checks again when it opens on the digest.
 * - **What a press keeps until its new reading lands**
 *   (`lightboxPressKeptLens`): a tile's "Re-analyze this tile" keeps its
 *   lens's earlier reading, and so does the Opinion's call run on its own
 *   (epic decision 47): the old Opinion stays on the board while the new one
 *   is weighed, is replaced when it lands, and stays, standing and stale
 *   marks and all, if the call fails or is stopped. Every other call run on
 *   its own is cleared first and read whole (decision 42), and so is the
 *   Opinion in a run of every call.
 * - **What an estimate prices** (`lightboxEstimateCalls`): every call with a
 *   lens on, which is also what each call's Run and each widget's Analyze
 *   send for a lens that is on, and each tile's "Re-analyze this tile".
 */

import type { LightboxBoard, LightboxLensId, LightboxRunScope } from '@messages';
import {
  isLightboxLensId,
  isLightboxReadingGroupId,
  LIGHTBOX_BOARD_GROUP,
  LIGHTBOX_LENSES,
  lightboxLensGroup,
  lightboxLensLabel,
  lightboxPlannedCalls,
  lightboxRereadLenses,
  type LightboxPlannedCall
} from '@shared/constants/lightbox';
import { lightboxOpinionNothingToWeigh } from '@shared/constants/lightboxOpinion';

/** Writer-facing refusals, in host words. */
export const LIGHTBOX_PRESS_SCOPE_REFUSALS = {
  unknown: 'That is not a reading this board can run.',
  notACall: 'Only calls A to G can be analyzed. Counting (Measure) is free and makes no call.',
  lensNotInCall: (lens: LightboxLensId, group: string): string =>
    `${lightboxLensLabel(lens)} is read in call ${lightboxLensGroup(lens)}, not call ${group}.`,
  everyLensOff: 'Every lens is off, so there is nothing to read.',
  everyGroupRead: 'Every group is already read.',
  callLensesOff: (group: string): string => `Every lens of call ${group} is off, so it has nothing to read.`
} as const;

/** The press's scope, read from its payload, or why it is refused. */
export function parseLightboxRunScope(value: unknown): { scope: LightboxRunScope } | { refusal: string } {
  if (typeof value !== 'object' || value === null) {
    return { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown };
  }
  const candidate = value as { mode?: unknown; group?: unknown; lens?: unknown };
  switch (candidate.mode) {
    case 'all':
    case 'rest':
      return { scope: { mode: candidate.mode } };
    case 'lens':
      return isLightboxLensId(candidate.lens)
        ? { scope: { mode: 'lens', lens: candidate.lens } }
        : { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown };
    case 'group':
      return parseGroupScope(candidate.group, candidate.lens);
    default:
      return { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown };
  }
}

function parseGroupScope(group: unknown, lens: unknown): { scope: LightboxRunScope } | { refusal: string } {
  if (!isLightboxReadingGroupId(group)) {
    return { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.notACall };
  }
  if (lens === undefined) {
    return { scope: { mode: 'group', group } };
  }
  if (!isLightboxLensId(lens)) {
    return { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown };
  }
  if (lightboxLensGroup(lens) !== group) {
    return { refusal: LIGHTBOX_PRESS_SCOPE_REFUSALS.lensNotInCall(lens, group) };
  }
  return { scope: { mode: 'group', group, lens } };
}

/**
 * The calls a press of `scope` makes on `board` with these lenses off, or
 * why it makes none: nothing on, nothing left to read, or, for the Opinion
 * on its own, nothing current to weigh.
 */
export function lightboxPressCalls(
  scope: LightboxRunScope,
  lensesOff: readonly LightboxLensId[],
  board: Pick<LightboxBoard, 'readings'>
): { calls: LightboxPlannedCall[] } | { refusal: string } {
  const calls = lightboxPlannedCalls(lensesOff, scope, board.readings);
  if (calls.length === 0) {
    return {
      refusal: scope.mode === 'rest'
        ? LIGHTBOX_PRESS_SCOPE_REFUSALS.everyGroupRead
        : scope.mode === 'group'
          ? LIGHTBOX_PRESS_SCOPE_REFUSALS.callLensesOff(scope.group)
          : LIGHTBOX_PRESS_SCOPE_REFUSALS.everyLensOff
    };
  }
  const nothingToWeigh = scope.mode === 'group' && scope.group === LIGHTBOX_BOARD_GROUP
    ? lightboxOpinionNothingToWeigh(board)
    : undefined;
  return nothingToWeigh ? { refusal: nothingToWeigh } : { calls };
}

/**
 * The lens whose earlier reading a press of `scope` keeps until its new one
 * lands, if any (`startLightboxGroups`, `settleLightboxGroup`): a tile's
 * lens, or the Opinion when its call runs on its own (decision 47). For any
 * other press, its calls are cleared first and replaced whole.
 */
export function lightboxPressKeptLens(scope: LightboxRunScope): LightboxLensId | undefined {
  if (scope.mode === 'lens') {
    return scope.lens;
  }
  return scope.mode === 'group' && scope.group === LIGHTBOX_BOARD_GROUP ? 'opinion' : undefined;
}

/**
 * The calls an estimate prices: one per group with a lens on (what "Run AI
 * analyses" sends, and what a call's Run or a widget's Analyze sends for a
 * lens that is on), and what each tile's "Re-analyze this tile" sends: its
 * lens, with any read together with it (Slice 4C).
 */
export function lightboxEstimateCalls(lensesOff: readonly LightboxLensId[]): {
  groups: LightboxPlannedCall[];
  rereads: LightboxPlannedCall[];
} {
  return {
    groups: lightboxPlannedCalls(lensesOff, { mode: 'all' }),
    rereads: LIGHTBOX_LENSES
      .filter((lens) => !lensesOff.includes(lens.id))
      .map((lens) => ({ group: lens.group, lenses: lightboxRereadLenses(lens.id, lensesOff) }))
  };
}
