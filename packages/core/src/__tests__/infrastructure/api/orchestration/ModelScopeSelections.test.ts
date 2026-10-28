/**
 * ModelScopeSelections (Lightbox Slice 4L): the one rule that turns the
 * `proseMinion.*Model` settings into the model each scope runs on. The
 * Lightbox and Craft Flags (Draft Edit Slice 3c) each follow the assistant
 * model (the Workshop's) until they have one of their own. Model ids are
 * placeholders.
 */
import {
  DEFAULT_PROOFREAD_MODEL,
  DEFAULT_WIDGET_MODEL,
  MODEL_SCOPE_SETTING_KEYS,
  followingModelScopes,
  ownFollowingModel,
  resolveModelScopeSelections
} from '@orchestration/ModelScopeSelections';
import { DEFAULT_CATEGORY_MODEL } from '@providers/OpenRouterModels';
import { MODEL_SCOPE_FOLLOWS, isFollowingModelScope } from '@messages';

const WORKSHOP = 'placeholder/workshop-model';
const LIGHTBOX = 'placeholder/lightbox-model';

/** A settings store over plain values; `undefined` is an unset key, as VS Code reads it. */
function settingsOf(values: Record<string, unknown>) {
  return {
    get: <T>(_section: string, key: string, fallback?: T) => (values[key] !== undefined ? values[key] as T : fallback)
  };
}

describe('resolveModelScopeSelections: the Lightbox model scope (Slice 4L)', () => {
  it('runs the Lightbox on its own model once one is set', () => {
    expect(resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX })))
      .toMatchObject({ assistant: WORKSHOP, lightbox: LIGHTBOX });
  });

  it('falls back to the assistant model while it is unset', () => {
    expect(resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP })))
      .toMatchObject({ assistant: WORKSHOP, lightbox: WORKSHOP });
  });

  it.each([
    ['empty, the manifest default', ''],
    ['only whitespace', '   ']
  ])('reads a blank setting (%s) as unset', (_name, blank) => {
    expect(resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP, lightboxModel: blank })).lightbox)
      .toBe(WORKSHOP);
  });

  it('falls back again once the setting is cleared', () => {
    const values: Record<string, unknown> = { assistantModel: WORKSHOP, lightboxModel: LIGHTBOX };
    expect(resolveModelScopeSelections(settingsOf(values)).lightbox).toBe(LIGHTBOX);

    values.lightboxModel = undefined;
    expect(resolveModelScopeSelections(settingsOf(values)).lightbox).toBe(WORKSHOP);
  });

  it('follows the assistant model after its own default, so it always names a model', () => {
    const defaults = resolveModelScopeSelections(settingsOf({}));
    expect(defaults.assistant).not.toBe('');
    expect(defaults.lightbox).toBe(defaults.assistant);
  });

  it('trims an own model, and a Lightbox model never moves the assistant model', () => {
    const selections = resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP, lightboxModel: `  ${LIGHTBOX} ` }));
    expect(selections.lightbox).toBe(LIGHTBOX);
    expect(selections.assistant).toBe(WORKSHOP);
  });

  it('keeps the other scopes exactly as before: their own setting or default, a blank one kept blank', () => {
    const defaults = resolveModelScopeSelections(settingsOf({}));
    expect(resolveModelScopeSelections(settingsOf({ contextModel: '', dictionaryModel: 'placeholder/dictionary-model' }))).toEqual({
      assistant: defaults.assistant,
      dictionary: 'placeholder/dictionary-model',
      context: '',
      category: DEFAULT_CATEGORY_MODEL,
      widget: DEFAULT_WIDGET_MODEL,
      lightbox: defaults.assistant,
      proofread: DEFAULT_PROOFREAD_MODEL,
      craft: defaults.assistant
    });
  });
});

describe('resolveModelScopeSelections: the Craft Flags model scope (Draft Edit Slice 3c)', () => {
  const CRAFT = 'placeholder/craft-model';

  it('follows the assistant model until it has its own, and moves when that one does', () => {
    const values: Record<string, unknown> = { assistantModel: WORKSHOP };
    expect(resolveModelScopeSelections(settingsOf(values)).craft).toBe(WORKSHOP);
    expect(followingModelScopes(settingsOf(values))).toContain('craft');

    values.assistantModel = 'placeholder/workshop-model-next';
    expect(resolveModelScopeSelections(settingsOf(values)).craft).toBe('placeholder/workshop-model-next');
  });

  it('runs on its own model once picked, apart from the Lightbox\'s, and the assistant model never moves it', () => {
    const values: Record<string, unknown> = { assistantModel: WORKSHOP, craftModel: ` ${CRAFT} ` };
    expect(resolveModelScopeSelections(settingsOf(values))).toMatchObject({ assistant: WORKSHOP, lightbox: WORKSHOP, craft: CRAFT });
    expect(followingModelScopes(settingsOf(values))).toEqual(['lightbox']);

    values.assistantModel = 'placeholder/workshop-model-next';
    expect(resolveModelScopeSelections(settingsOf(values)).craft).toBe(CRAFT);
  });

  it('never moves the Lightbox\'s model, nor the Lightbox\'s it', () => {
    expect(resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX })).craft).toBe(WORKSHOP);
    expect(resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP, craftModel: 'placeholder/craft-model' })).lightbox).toBe(WORKSHOP);
  });
});

describe('resolveModelScopeSelections: the Proofread model scope (ADR 2026-10-21 D6)', () => {
  const PROOFREAD = 'placeholder/proofread-model';

  it('defaults to the inexpensive Proofread model, never the assistant model', () => {
    const selections = resolveModelScopeSelections(settingsOf({ assistantModel: WORKSHOP }));
    expect(selections.proofread).toBe(DEFAULT_PROOFREAD_MODEL);
    expect(selections.proofread).not.toBe(WORKSHOP);
  });

  it('runs on its own setting, and the assistant model never moves it', () => {
    const values: Record<string, unknown> = { assistantModel: WORKSHOP, proofreadModel: PROOFREAD };
    expect(resolveModelScopeSelections(settingsOf(values)).proofread).toBe(PROOFREAD);

    values.assistantModel = 'placeholder/workshop-model-next';
    expect(resolveModelScopeSelections(settingsOf(values)).proofread).toBe(PROOFREAD);
  });

  it('is an own scope: it is never reported as following', () => {
    expect(followingModelScopes(settingsOf({}))).not.toContain('proofread');
    expect(isFollowingModelScope('proofread')).toBe(false);
  });
});

describe('the following scopes', () => {
  it('reports which scopes have no model of their own', () => {
    expect(followingModelScopes(settingsOf({ assistantModel: WORKSHOP }))).toEqual(['lightbox', 'craft']);
    expect(followingModelScopes(settingsOf({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX }))).toEqual(['craft']);
    expect(followingModelScopes(settingsOf({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX, craftModel: 'placeholder/craft-model' }))).toEqual([]);
    expect(ownFollowingModel(settingsOf({ lightboxModel: 42 }), 'lightbox')).toBeUndefined();
  });

  it('names a setting for every scope, and follows only from a scope with its own', () => {
    expect(MODEL_SCOPE_SETTING_KEYS).toEqual({
      assistant: 'assistantModel',
      dictionary: 'dictionaryModel',
      context: 'contextModel',
      category: 'categoryModel',
      widget: 'widgetModel',
      lightbox: 'lightboxModel',
      proofread: 'proofreadModel',
      craft: 'craftModel'
    });
    expect(MODEL_SCOPE_FOLLOWS).toEqual({ lightbox: 'assistant', craft: 'assistant' });
    expect(['lightbox', 'craft', 'assistant', 'widget', 'toString', undefined].map(isFollowingModelScope))
      .toEqual([true, true, false, false, false, false]);
  });
});
