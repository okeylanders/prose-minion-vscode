/**
 * ModelScopeSelections — the one rule that turns the `proseMinion.*Model`
 * settings into the model each scope runs on. Pure: the settings arrive as a
 * reader.
 *
 * - **Own scopes.** The assistant, dictionary, context, category and widget
 *   scopes each read their own setting, with a built-in default when it is
 *   absent. A blank one is kept blank, so the hot-swap names it rather than
 *   running on a guess.
 * - **Following scopes (Lightbox Slice 4L).** The Lightbox has no model of
 *   its own until the writer picks one: its setting blank, it runs on the
 *   model of the scope it follows (`MODEL_SCOPE_FOLLOWS`: the assistant
 *   model, the Workshop's), resolved after that scope's own default, so it
 *   always names a model and moves when that one does. Picked, it is its own,
 *   and nothing the followed scope does changes it.
 */

import type { SettingsStore } from '@/platform';
import {
  MODEL_SCOPE_FOLLOWS,
  type FollowingModelScope,
  type ModelScope
} from '@shared/types';
import { DEFAULT_CATEGORY_MODEL } from '@providers/OpenRouterModels';

/** The settings these rules read. */
export type ModelSettingsReader = Pick<SettingsStore, 'get'>;

/** The scopes that read only their own setting. */
export type OwnModelScope = Exclude<ModelScope, FollowingModelScope>;

/**
 * Quality-first default for the `widget` scope. Conversation Widgets are
 * occasional, bounded creative workflows, so output usefulness matters more
 * than minimizing the small per-run cost.
 */
export const DEFAULT_WIDGET_MODEL = 'anthropic/claude-sonnet-5';
const DEFAULT_SCOPE_MODEL = 'anthropic/claude-sonnet-5';

/** Each scope's setting under `proseMinion.*`. */
export const MODEL_SCOPE_SETTING_KEYS: Readonly<Record<ModelScope, string>> = {
  assistant: 'assistantModel',
  dictionary: 'dictionaryModel',
  context: 'contextModel',
  category: 'categoryModel',
  widget: 'widgetModel',
  lightbox: 'lightboxModel'
};

const FOLLOWING_SCOPES = Object.keys(MODEL_SCOPE_FOLLOWS) as FollowingModelScope[];

/** A following scope's own model as its setting names it, trimmed; undefined while it has none. */
export function ownFollowingModel(settings: ModelSettingsReader, scope: FollowingModelScope): string | undefined {
  const value = settings.get<unknown>('proseMinion', MODEL_SCOPE_SETTING_KEYS[scope]);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** The following scopes with no model of their own right now. */
export function followingModelScopes(settings: ModelSettingsReader): FollowingModelScope[] {
  return FOLLOWING_SCOPES.filter((scope) => ownFollowingModel(settings, scope) === undefined);
}

/** Every following scope's model, from the own scopes' models already resolved. */
export function resolveFollowingModels(
  settings: ModelSettingsReader,
  own: Readonly<Record<OwnModelScope, string>>
): Record<FollowingModelScope, string> {
  return Object.fromEntries(FOLLOWING_SCOPES.map((scope) => [
    scope,
    ownFollowingModel(settings, scope) ?? own[MODEL_SCOPE_FOLLOWS[scope]]
  ])) as Record<FollowingModelScope, string>;
}

/** The model every scope runs on, as the AI resource manager builds and hot-swaps them. */
export function resolveModelScopeSelections(settings: ModelSettingsReader): Record<ModelScope, string> {
  const read = (scope: OwnModelScope) => settings.get<string>('proseMinion', MODEL_SCOPE_SETTING_KEYS[scope]);
  const own: Record<OwnModelScope, string> = {
    assistant: read('assistant') ?? DEFAULT_SCOPE_MODEL,
    dictionary: read('dictionary') ?? DEFAULT_SCOPE_MODEL,
    context: read('context') ?? DEFAULT_SCOPE_MODEL,
    category: read('category') ?? DEFAULT_CATEGORY_MODEL,
    widget: read('widget') ?? DEFAULT_WIDGET_MODEL
  };
  return { ...own, ...resolveFollowingModels(settings, own) };
}
