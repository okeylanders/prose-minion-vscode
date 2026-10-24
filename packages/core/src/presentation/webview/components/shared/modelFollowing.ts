/**
 * How a following model scope is offered to the writer (Lightbox Slice 4L).
 *
 * The Lightbox has no model of its own until the writer picks one; until
 * then it reads with the Workshop's (the assistant model) and moves when that
 * one does. Every picker that shows the Lightbox's model, the Lightbox's
 * header chip and the Settings overlay's row, says so in these words.
 * Presentation only: no transport.
 */
import type { FollowingModelScope, ModelOption } from '@messages';

export interface ModelFollowCopy {
  /** The choice's name, before the followed model's: "Same as Workshop". */
  label: string;
  /** What following does, under the choice. */
  description: string;
}

export const MODEL_FOLLOW_COPY: Readonly<Record<FollowingModelScope, ModelFollowCopy>> = {
  lightbox: {
    label: 'Same as Workshop',
    description: 'The Lightbox reads with the Workshop’s model and follows it when it changes. ' +
      'Pick a model to give the Lightbox its own; the Workshop keeps its model either way.'
  }
};

/** The choice as the writer reads it, with the followed model's label in parentheses ("Same as Workshop (…)"), or bare before that model is known. */
export function modelFollowLabel(
  scope: FollowingModelScope,
  followedModelId: string | undefined,
  options: readonly Pick<ModelOption, 'id' | 'label'>[]
): string {
  const name = MODEL_FOLLOW_COPY[scope].label;
  if (!followedModelId) {
    return name;
  }
  const model = options.find((option) => option.id === followedModelId)?.label ?? followedModelId;
  return `${name} (${model})`;
}
