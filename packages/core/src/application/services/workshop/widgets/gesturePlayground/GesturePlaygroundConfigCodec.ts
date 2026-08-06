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
  booleanAt,
  boundedStringAt,
  exactKeys,
  exactObject,
  objectAt,
  optionalBoundedStringAt,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';

export interface GesturePlaygroundDraftSummary {
  targetPhrase: string;
  selectionCount: number;
}

export interface GesturePlaygroundDraftHydrationDefaults {
  draft: WorkshopGesturePlaygroundDraft;
  defaultedDictionarySharing: boolean;
  defaultedSourceReferences: boolean;
}

export function assertGesturePlaygroundDraftShape(value: unknown, path: string): void {
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
      'note'
    ],
    // Both fields joined the evolving development checkpoint after the first
    // Gesture drafts. Hydration supplies safe defaults before current
    // integrity is enforced.
    ['includeDictionaryInCommit', 'sourceReferences']
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
  if (
    !Array.isArray(draft.selections)
    || draft.selections.length === 0
    || draft.selections.length > budget.gestureSelectionsPerCommit
  ) {
    shapeError(
      `${path}.selections`,
      `an array of 1–${budget.gestureSelectionsPerCommit} strings`
    );
  }
  const selections = draft.selections as unknown[];
  const seenSelections = new Set<string>();
  arrayOf(selections, `${path}.selections`, (selection, selectionPath) => {
    boundedStringAt(selection, selectionPath, budget.gestureOptionCharacters, false);
    const text = selection as string;
    if (seenSelections.has(text)) {
      shapeError(`${path}.selections`, 'an array without duplicate directions');
    }
    seenSelections.add(text);
  });
  boundedStringAt(draft.note, `${path}.note`, budget.gestureNoteCharacters);
  if (
    !Array.isArray(draft.menu)
    || draft.menu.length < budget.gestureMenuGroupsMinimum
    || draft.menu.length > budget.gestureMenuGroups
  ) {
    shapeError(
      `${path}.menu`,
      `an array of ${budget.gestureMenuGroupsMinimum}–${budget.gestureMenuGroups} groups`
    );
  }
  const menuOptions = new Set<string>();
  arrayOf(draft.menu, `${path}.menu`, (groupValue, groupPath) => {
    const group = exactObject(groupValue, groupPath, ['heading', 'options']);
    boundedStringAt(
      group.heading,
      `${groupPath}.heading`,
      budget.gestureOptionCharacters,
      false
    );
    if (
      !Array.isArray(group.options)
      || group.options.length < budget.gestureOptionsPerGroupMinimum
      || group.options.length > budget.gestureOptionsPerGroup
    ) {
      shapeError(
        `${groupPath}.options`,
        `an array of ${budget.gestureOptionsPerGroupMinimum}–${budget.gestureOptionsPerGroup} strings`
      );
    }
    arrayOf(group.options, `${groupPath}.options`, (option, optionPath) => {
      boundedStringAt(option, optionPath, budget.gestureOptionCharacters, false);
      const text = option as string;
      if (menuOptions.has(text)) {
        shapeError(`${path}.menu`, 'groups without duplicate options');
      }
      menuOptions.add(text);
    });
  });
  if ([...seenSelections].some((selection) => !menuOptions.has(selection))) {
    shapeError(`${path}.selections`, 'directions drawn from the generated menu');
  }
}

export function assertGesturePlaygroundSourceReferencesShape(
  value: unknown,
  path: string
): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (!Array.isArray(value) || value.length > budget.gestureSourceReferences) {
    shapeError(path, `an array of at most ${budget.gestureSourceReferences} source references`);
  }
  const seen = new Set<string>();
  let serializedCharacters = 0;
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
    const key = reference.kind === 'active-excerpt'
      ? 'active-excerpt'
      : `context-attachment:${String(reference.attachmentId)}`;
    serializedCharacters += key.length + (seen.size > 0 ? 1 : 0);
    if (serializedCharacters > budget.gestureSourceReferenceCharacters) {
      shapeError(
        path,
        `source references within ${budget.gestureSourceReferenceCharacters} characters`
      );
    }
    if (seen.has(key)) {
      shapeError(path, 'source references without duplicates');
    }
    seen.add(key);
  });
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
  draft: WorkshopGesturePlaygroundDraft
): GesturePlaygroundDraftHydrationDefaults {
  const defaultedDictionarySharing = typeof draft.includeDictionaryInCommit !== 'boolean';
  const defaultedSourceReferences = !Array.isArray(draft.sourceReferences);
  if (!defaultedDictionarySharing && !defaultedSourceReferences) {
    return { draft, defaultedDictionarySharing, defaultedSourceReferences };
  }
  return {
    draft: {
      ...draft,
      ...(defaultedDictionarySharing ? { includeDictionaryInCommit: false } : {}),
      ...(defaultedSourceReferences ? { sourceReferences: [] } : {})
    },
    defaultedDictionarySharing,
    defaultedSourceReferences
  };
}
