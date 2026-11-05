/**
 * Model slices (Workshop Wayfinding ADR 2026-11-03 D8): where the thread and
 * the transcript export say the room's model changed.
 *
 * Slices are derived from the turns' model stamps (D7), never stored. This is
 * the one function both readers call, the webview's thread and the host's
 * `projectWorkshopTranscript`, so the two can never disagree about where a
 * slice goes. It lives in `shared/` because the webview cannot import
 * `application/`.
 *
 * - A slice marks a reply whose `requestedModelId` differs from the last
 *   stamped reply's **in the same scope**. A dictionary lookup between two
 *   host replies is compared only with other dictionary lookups.
 * - It sits before the writer turn that prompted the reply: the nearest
 *   preceding writer turn with no other reply between them. A persona's
 *   capability cards (its dictionary lookups, analyses, reads) are that
 *   reply's own evidence, so they don't end the search. With no such writer
 *   turn, the slice sits before the reply itself.
 * - A turn without a stamp is unknown: never a switch, and it leaves the last
 *   stamped value where it was. A session saved before stamps shows nothing.
 *
 * Pure and deterministic. It names models by id only; display names are the
 * renderer's, resolved at render time.
 */

import type { ModelScope, WorkshopTurn } from '@messages';

/** The turn fields the derivation reads, and nothing else. */
export type WorkshopModelSliceTurn = Pick<
  WorkshopTurn,
  'id' | 'role' | 'model' | 'capability'
>;

/** The last stamped requested model per scope, before a window's first turn. */
export type WorkshopModelsBeforeWindow = Partial<Record<ModelScope, string>>;

export interface WorkshopModelSlice {
  /** The slice is drawn immediately before this turn. */
  beforeTurnId: string;
  /** The stamped reply whose requested model changed. */
  replyTurnId: string;
  scope: ModelScope;
  fromModelId: string;
  toModelId: string;
}

export interface WorkshopModelSliceOptions {
  /** Seeds each scope's last value, so a window's first reply can still slice. */
  modelsBeforeWindow?: WorkshopModelsBeforeWindow;
}

export function deriveWorkshopModelSlices(
  turns: readonly WorkshopModelSliceTurn[],
  options: WorkshopModelSliceOptions = {}
): WorkshopModelSlice[] {
  const last: WorkshopModelsBeforeWindow = { ...options.modelsBeforeWindow };
  const slices: WorkshopModelSlice[] = [];
  turns.forEach((turn, index) => {
    const model = stampOf(turn);
    if (!model) {
      return;
    }
    const previous = last[model.scope];
    last[model.scope] = model.requestedModelId;
    if (previous === undefined || previous === model.requestedModelId) {
      return;
    }
    slices.push({
      beforeTurnId: promptingWriterTurnId(turns, index) ?? turn.id,
      replyTurnId: turn.id,
      scope: model.scope,
      fromModelId: previous,
      toModelId: model.requestedModelId
    });
  });
  return slices;
}

/**
 * The window seed: each scope's last stamped requested model among the turns
 * before `windowStart`. Undefined when the window starts at the first turn
 * (nothing is cut) or when nothing before it carries a stamp.
 */
export function workshopModelsBeforeWindow(
  turns: readonly WorkshopModelSliceTurn[],
  windowStart: number
): WorkshopModelsBeforeWindow | undefined {
  const seed: WorkshopModelsBeforeWindow = {};
  for (const turn of turns.slice(0, Math.max(0, windowStart))) {
    const model = stampOf(turn);
    if (model) {
      seed[model.scope] = model.requestedModelId;
    }
  }
  return Object.keys(seed).length > 0 ? seed : undefined;
}

/**
 * The full history's slices as a window of its latest turns shows them: the
 * thread's slices, derived from the window and seeded with
 * `workshopModelsBeforeWindow`, are exactly these.
 *
 * A slice whose prompting writer turn fell before the window moves to its
 * reply, the window's turn the thread can still find; one whose reply fell
 * before the window is not shown, and the seed carries its model on.
 */
export function workshopModelSlicesInWindow(
  slices: readonly WorkshopModelSlice[],
  windowTurnIds: readonly string[]
): WorkshopModelSlice[] {
  const inWindow = new Set(windowTurnIds);
  return slices.flatMap((slice) => {
    if (inWindow.has(slice.beforeTurnId)) {
      return [{ ...slice }];
    }
    return inWindow.has(slice.replyTurnId) ? [{ ...slice, beforeTurnId: slice.replyTurnId }] : [];
  });
}

/**
 * What a slice in each scope is called. The room's own model is "Model"; a
 * dictionary lookup's change says whose model it was, so it never reads as the
 * room's.
 */
const WORKSHOP_MODEL_SLICE_SCOPE_LABELS: Readonly<Record<ModelScope, string>> = {
  assistant: 'Model',
  dictionary: 'Dictionary model',
  context: 'Context model',
  category: 'Category model',
  widget: 'Widget model',
  lightbox: 'Lightbox model',
  proofread: 'Proofread model',
  craft: 'Craft model'
};

/** The slice's copy, as the thread and the export both write it. */
export function workshopModelSliceText(scope: ModelScope, fromLabel: string, toLabel: string): string {
  return `${WORKSHOP_MODEL_SLICE_SCOPE_LABELS[scope]} · ${fromLabel} → ${toLabel}`;
}

function stampOf(turn: WorkshopModelSliceTurn): WorkshopTurn['model'] {
  return turn.role === 'assistant' ? turn.model : undefined;
}

/** The writer turn that prompted the reply at `replyIndex`, if one did. */
function promptingWriterTurnId(
  turns: readonly WorkshopModelSliceTurn[],
  replyIndex: number
): string | undefined {
  for (let index = replyIndex - 1; index >= 0; index--) {
    const turn = turns[index];
    if (turn.role === 'user') {
      return turn.id;
    }
    // Another reply ends the search; a capability card is the run's own
    // evidence, and a divider or notice is neither.
    if (turn.role === 'assistant' && !turn.capability) {
      return undefined;
    }
  }
  return undefined;
}
