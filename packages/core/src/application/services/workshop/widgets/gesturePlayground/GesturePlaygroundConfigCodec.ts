/**
 * Gesture Playground's local persisted-draft contract.
 *
 * The Workshop session codec owns the outer config envelope and schema clock;
 * this module owns only Gesture-specific shape rules, defensive copies,
 * display-safe summary fields, and development-checkpoint defaults.
 */

import { WorkshopGesturePlaygroundDraft } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  arrayOf,
  boundedArrayAt,
  booleanAt,
  boundedStringAt,
  exactKeys,
  exactObject,
  objectAt,
  optionalBoundedStringAt,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';

export interface GesturePlaygroundDraftSummary {
  targetPhrase: string;
  selectionCount: number;
}

export type GesturePlaygroundCheckpointNormalization =
  | 'defaulted-widget-dictionary-sharing'
  | 'defaulted-widget-source-references';

export function assertGesturePlaygroundDraftCheckpointShape(
  value: unknown,
  path: string
): void {
  assertGesturePlaygroundDraftShapeInternal(value, path, true);
}

export function assertGesturePlaygroundDraftShape(value: unknown, path: string): void {
  assertGesturePlaygroundDraftShapeInternal(value, path, false);
}

function assertGesturePlaygroundDraftShapeInternal(
  value: unknown,
  path: string,
  allowCheckpointDefaults: boolean
): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const draft = exactObject(
    value,
    path,
    [
      'targetPhrase',
      'writerInstructions',
      'contextText',
      'characterNotes',
      'dictionaryMarkdown',
      'menu',
      'selections',
      'note',
      ...(allowCheckpointDefaults
        ? []
        : ['includeDictionaryInCommit', 'sourceReferences'])
    ],
    allowCheckpointDefaults
      ? ['includeDictionaryInCommit', 'sourceReferences']
      : []
  );
  boundedStringAt(
    draft.targetPhrase,
    `${path}.targetPhrase`,
    budget.gestureTargetPhraseCharacters,
    false
  );
  boundedStringAt(
    draft.writerInstructions,
    `${path}.writerInstructions`,
    budget.gestureWriterInstructionsCharacters
  );
  boundedStringAt(
    draft.contextText,
    `${path}.contextText`,
    budget.gestureContextCharacters
  );
  boundedStringAt(
    draft.characterNotes,
    `${path}.characterNotes`,
    budget.gestureCharacterNotesCharacters
  );
  if (draft.sourceReferences !== undefined) {
    assertGesturePlaygroundSourceReferencesShape(
      draft.sourceReferences,
      `${path}.sourceReferences`
    );
  }
  boundedStringAt(
    draft.dictionaryMarkdown,
    `${path}.dictionaryMarkdown`,
    budget.gestureDictionaryCharacters,
    false
  );
  if (draft.includeDictionaryInCommit !== undefined) {
    booleanAt(draft.includeDictionaryInCommit, `${path}.includeDictionaryInCommit`);
  }
  boundedArrayAt(
    draft.selections,
    `${path}.selections`,
    1,
    budget.gestureSelectionsPerCommit,
    'strings'
  );
  arrayOf(draft.selections, `${path}.selections`, (selection, selectionPath) => {
    boundedStringAt(selection, selectionPath, budget.gestureOptionCharacters, false);
  });
  boundedStringAt(draft.note, `${path}.note`, budget.gestureNoteCharacters);
  boundedArrayAt(
    draft.menu,
    `${path}.menu`,
    budget.gestureMenuGroupsMinimum,
    budget.gestureMenuGroups,
    'groups'
  );
  arrayOf(draft.menu, `${path}.menu`, (groupValue, groupPath) => {
    const group = exactObject(groupValue, groupPath, ['heading', 'options']);
    boundedStringAt(
      group.heading,
      `${groupPath}.heading`,
      budget.gestureOptionCharacters,
      false
    );
    boundedArrayAt(
      group.options,
      `${groupPath}.options`,
      budget.gestureOptionsPerGroupMinimum,
      budget.gestureOptionsPerGroup,
      'strings'
    );
    arrayOf(group.options, `${groupPath}.options`, (option, optionPath) => {
      boundedStringAt(option, optionPath, budget.gestureOptionCharacters, false);
    });
  });
}

export function assertGesturePlaygroundSourceReferencesShape(
  value: unknown,
  path: string
): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  boundedArrayAt(value, path, 0, budget.gestureSourceReferences, 'source references');
  arrayOf(value, path, (referenceValue, referencePath) => {
    const reference = objectAt(referenceValue, referencePath);
    if (reference.kind === 'active-excerpt') {
      exactKeys(reference, referencePath, ['kind']);
    } else if (reference.kind === 'context-attachment') {
      exactKeys(reference, referencePath, ['kind', 'attachmentId']);
      stringAt(reference.attachmentId, `${referencePath}.attachmentId`);
      if (!/^ctx-[1-9]\d*$/.test(reference.attachmentId as string)) {
        shapeError(`${referencePath}.attachmentId`, 'a ctx-<n> attachment id');
      }
    } else {
      shapeError(`${referencePath}.kind`, 'active-excerpt or context-attachment');
    }
  });
}

function assertGesturePlaygroundSourceReferencesIntegrity(
  references: WorkshopGesturePlaygroundDraft['sourceReferences'],
  path: string
): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const sourceReferences = new Set<string>();
  let serializedCharacters = 0;
  for (const reference of references) {
    const key = reference.kind === 'active-excerpt'
      ? 'active-excerpt'
      : `context-attachment:${reference.attachmentId}`;
    serializedCharacters += key.length + (sourceReferences.size > 0 ? 1 : 0);
    if (serializedCharacters > budget.gestureSourceReferenceCharacters) {
      shapeError(
        path,
        `source references within ${budget.gestureSourceReferenceCharacters} characters`
      );
    }
    if (sourceReferences.has(key)) {
      shapeError(path, 'source references without duplicates');
    }
    sourceReferences.add(key);
  }
}

export function assertGesturePlaygroundDraftIntegrity(
  draft: WorkshopGesturePlaygroundDraft,
  path: string
): void {
  const selections = new Set<string>();
  for (const selection of draft.selections) {
    if (selections.has(selection)) {
      shapeError(`${path}.selections`, 'an array without duplicate directions');
    }
    selections.add(selection);
  }

  const menuOptions = new Set<string>();
  for (const group of draft.menu) {
    for (const option of group.options) {
      if (menuOptions.has(option)) {
        shapeError(`${path}.menu`, 'groups without duplicate options');
      }
      menuOptions.add(option);
    }
  }
  if ([...selections].some((selection) => !menuOptions.has(selection))) {
    shapeError(`${path}.selections`, 'directions drawn from the generated menu');
  }

  assertGesturePlaygroundSourceReferencesIntegrity(
    draft.sourceReferences,
    `${path}.sourceReferences`
  );
}

export function assertGesturePlaygroundRecommendationSeedShape(
  value: unknown,
  path: string
): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const seed = exactObject(
    value,
    path,
    [],
    [
      'targetPhrase',
      'writerInstructions',
      'contextText',
      'characterNotes',
      'sourceReferences'
    ]
  );
  optionalBoundedStringAt(
    seed.targetPhrase,
    `${path}.targetPhrase`,
    budget.gestureTargetPhraseCharacters,
    false
  );
  optionalBoundedStringAt(
    seed.writerInstructions,
    `${path}.writerInstructions`,
    budget.gestureWriterInstructionsCharacters,
    false
  );
  optionalBoundedStringAt(
    seed.contextText,
    `${path}.contextText`,
    budget.gestureContextCharacters,
    false
  );
  optionalBoundedStringAt(
    seed.characterNotes,
    `${path}.characterNotes`,
    budget.gestureCharacterNotesCharacters,
    false
  );
  if (seed.sourceReferences !== undefined) {
    assertGesturePlaygroundSourceReferencesShape(
      seed.sourceReferences,
      `${path}.sourceReferences`
    );
    assertGesturePlaygroundSourceReferencesIntegrity(
      seed.sourceReferences as WorkshopGesturePlaygroundDraft['sourceReferences'],
      `${path}.sourceReferences`
    );
  }
}

export function cloneGesturePlaygroundDraft(
  draft: WorkshopGesturePlaygroundDraft
): WorkshopGesturePlaygroundDraft {
  return {
    targetPhrase: draft.targetPhrase,
    writerInstructions: draft.writerInstructions,
    contextText: draft.contextText,
    characterNotes: draft.characterNotes,
    sourceReferences: draft.sourceReferences.map((reference) => ({ ...reference })),
    dictionaryMarkdown: draft.dictionaryMarkdown,
    menu: draft.menu.map((group) => ({ heading: group.heading, options: [...group.options] })),
    selections: [...draft.selections],
    note: draft.note,
    includeDictionaryInCommit: draft.includeDictionaryInCommit === true
  };
}

export function summarizeGesturePlaygroundDraft(
  draft: WorkshopGesturePlaygroundDraft
): GesturePlaygroundDraftSummary {
  return {
    targetPhrase: draft.targetPhrase,
    selectionCount: draft.selections.length
  };
}

export function normalizeGesturePlaygroundDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopGesturePlaygroundDraft,
  GesturePlaygroundCheckpointNormalization
> {
  assertGesturePlaygroundDraftCheckpointShape(value, 'Gesture Playground checkpoint draft');
  const draft = value as WorkshopGesturePlaygroundDraft;
  const defaultedDictionarySharing = typeof draft.includeDictionaryInCommit !== 'boolean';
  const defaultedSourceReferences = !Array.isArray(draft.sourceReferences);
  const normalizations: GesturePlaygroundCheckpointNormalization[] = [];
  if (defaultedDictionarySharing) {
    normalizations.push('defaulted-widget-dictionary-sharing');
  }
  if (defaultedSourceReferences) {
    normalizations.push('defaulted-widget-source-references');
  }
  const normalized = {
    ...draft,
    ...(defaultedDictionarySharing ? { includeDictionaryInCommit: false } : {}),
    ...(defaultedSourceReferences ? { sourceReferences: [] } : {})
  } as WorkshopGesturePlaygroundDraft;
  return {
    draft: cloneGesturePlaygroundDraft(normalized),
    normalizations,
    notices: []
  };
}
