/**
 * ModelScopeSelections — the one rule that turns the `proseMinion.*Model`
 * settings into the model each scope runs on. Pure: the settings arrive as a
 * reader.
 *
 * - **Own scopes.** The assistant, dictionary, context, category, widget and
 *   proofread scopes each read their own setting, with a built-in default
 *   when it is absent. A blank one is kept blank, so the hot-swap names it
 *   rather than running on a guess.
 * - **Following scopes (Lightbox Slice 4L; Craft Flags, Draft Edit Slice
 *   3c; the helper, ADR 2026-11-05 D3; Passage Search, ADR 2026-11-20 D14).** They have no model of their own
 *   until the writer picks one: the setting blank, each runs on the model of
 *   the own scope it names in `MODEL_SCOPE_FOLLOWS` (the Lightbox and Craft
 *   Flags the assistant model, the helper Proofread's, Passage Search
 *   Category Search's: ADR 2026-11-20 D14),
 *   resolved after that scope's own default, so it always names a model and
 *   moves when that one does. Picked, it is its own, and nothing the
 *   followed scope does changes it.
 */

import type { SettingsStore } from '@/platform';
import { DEFAULT_MODEL_SELECTIONS } from '@shared/constants/defaultModelSelections';
import {
  MODEL_SCOPE_FOLLOWS,
  type FollowingModelScope,
  type ModelScope,
  type OwnModelScope
} from '@messages';

/** The settings these rules read. */
export type ModelSettingsReader = Pick<SettingsStore, 'get'>;

/** Each scope's setting under `proseMinion.*`. */
export const MODEL_SCOPE_SETTING_KEYS: Readonly<Record<ModelScope, string>> = {
  assistant: 'assistantModel',
  dictionary: 'dictionaryModel',
  context: 'contextModel',
  category: 'categoryModel',
  widget: 'widgetModel',
  lightbox: 'lightboxModel',
  proofread: 'proofreadModel',
  craft: 'craftModel',
  helper: 'helperModel',
  passageSearch: 'passageSearchModel'
};

const FOLLOWING_SCOPES = Object.keys(MODEL_SCOPE_FOLLOWS) as FollowingModelScope[];
const OWN_SCOPES = Object.keys(DEFAULT_MODEL_SELECTIONS) as OwnModelScope[];

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
function resolveFollowingModels(
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
  const own = Object.fromEntries(OWN_SCOPES.map((scope) => [
    scope,
    settings.get<string>('proseMinion', MODEL_SCOPE_SETTING_KEYS[scope]) ?? DEFAULT_MODEL_SELECTIONS[scope]
  ])) as Record<OwnModelScope, string>;
  return { ...own, ...resolveFollowingModels(settings, own) };
}
