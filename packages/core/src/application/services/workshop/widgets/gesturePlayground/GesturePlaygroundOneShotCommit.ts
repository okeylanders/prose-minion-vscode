/** Gesture Playground validation and rendering plugged into the one-shot rail. */

import type {
  WorkshopGesturePlaygroundCommitPayload,
  WorkshopGesturePlaygroundDraft,
  WorkshopGesturePlaygroundMenuGroup
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  buildGestureDirective
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundDirective';
import {
  gesturePlaygroundSourceReferencesValidationError
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundSourceReferences';
import type {
  WorkshopOneShotWidgetCommitPreparationResult
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';

export function prepareGesturePlaygroundOneShotCommit(
  payload: WorkshopGesturePlaygroundCommitPayload
): WorkshopOneShotWidgetCommitPreparationResult {
  const invalid = validateGesturePlaygroundDraft(payload.draft);
  if (invalid) {
    return { ok: false, reason: 'invalid-draft', message: invalid };
  }
  const { draft } = payload;
  const displayText = `For “${draft.targetPhrase.trim()}” — here are the gesture directions I want${
    draft.note.trim().length > 0 ? ` — ${draft.note.trim()}` : ''
  }${draft.includeDictionaryInCommit ? ', with the full Gesture Dictionary shared as reference' : ''}.`;
  return {
    ok: true,
    commit: {
      widgetId: payload.widgetId,
      widgetConfigInput: { widgetId: payload.widgetId, draft },
      clonedFromConfigId: payload.clonedFromConfigId,
      roomText: displayText,
      displayText,
      toolTargetRefusalMessage:
        'Switch to a persona target before committing a widget — tool sidecars do not take gesture directions.',
      artifact: {
        label: workshopWidgetLabel(payload.widgetId),
        content: buildGestureDirective(draft),
        selectionCount: draft.selections.length
      }
    }
  };
}

/** Deterministic pre-flight — the same bounds the generate service enforces. */
function validateGesturePlaygroundDraft(
  draft: WorkshopGesturePlaygroundDraft
): string | undefined {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (typeof draft.includeDictionaryInCommit !== 'boolean') {
    return 'Choose whether the full Gesture Dictionary should be shared with the room.';
  }
  if (draft.targetPhrase.trim().length === 0) {
    return 'Gesture Playground needs a target phrase.';
  }
  if (draft.targetPhrase.length > budget.gestureTargetPhraseCharacters) {
    return `The target phrase exceeds ${budget.gestureTargetPhraseCharacters} characters.`;
  }
  if (draft.writerInstructions.length > budget.gestureWriterInstructionsCharacters) {
    return `The writer instructions exceed ${budget.gestureWriterInstructionsCharacters} characters.`;
  }
  if (draft.contextText.length > budget.gestureContextCharacters) {
    return `The context exceeds ${budget.gestureContextCharacters} characters.`;
  }
  if (draft.characterNotes.length > budget.gestureCharacterNotesCharacters) {
    return `The character notes exceed ${budget.gestureCharacterNotesCharacters} characters.`;
  }
  const invalidSources = gesturePlaygroundSourceReferencesValidationError(
    draft.sourceReferences
  );
  if (invalidSources) {
    return invalidSources;
  }
  if (draft.dictionaryMarkdown.trim().length === 0) {
    return 'Generate a Gesture Dictionary and alternatives before committing.';
  }
  if (draft.dictionaryMarkdown.length > budget.gestureDictionaryCharacters) {
    return `The Gesture Dictionary exceeds ${budget.gestureDictionaryCharacters} characters.`;
  }
  if (!draft.menu) {
    return 'Generate a valid alternatives menu before committing.';
  }
  const invalidMenu = validateGesturePlaygroundMenu(draft.menu);
  if (invalidMenu) {
    return invalidMenu;
  }
  if (draft.selections.length === 0) {
    return 'Keep at least one direction before committing.';
  }
  if (draft.selections.length > budget.gestureSelectionsPerCommit) {
    return `A commit carries at most ${budget.gestureSelectionsPerCommit} directions.`;
  }
  if (draft.selections.some((selection) =>
    selection.trim().length === 0 || selection.length > budget.gestureOptionCharacters
  )) {
    return 'One of the kept directions is empty or too long.';
  }
  if (
    new Set(draft.selections.map((selection) => selection.trim())).size
      !== draft.selections.length
  ) {
    return 'The kept directions contain a duplicate.';
  }
  const menuOptions = new Set(draft.menu.flatMap((group) => group.options));
  if (draft.selections.some((selection) => !menuOptions.has(selection))) {
    return 'One of the kept directions is not part of the generated menu.';
  }
  if (draft.note.length > budget.gestureNoteCharacters) {
    return `The note exceeds ${budget.gestureNoteCharacters} characters.`;
  }
  return undefined;
}

function validateGesturePlaygroundMenu(
  menu: readonly WorkshopGesturePlaygroundMenuGroup[]
): string | undefined {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (
    menu.length < budget.gestureMenuGroupsMinimum
    || menu.length > budget.gestureMenuGroups
  ) {
    return `The alternatives menu must carry ${budget.gestureMenuGroupsMinimum}–${budget.gestureMenuGroups} groups.`;
  }

  const seenOptions = new Set<string>();
  for (const [groupIndex, group] of menu.entries()) {
    if (
      group.heading.trim().length === 0
      || group.heading !== group.heading.trim()
      || group.heading.length > budget.gestureOptionCharacters
    ) {
      return `Alternatives group ${groupIndex + 1} has an invalid heading.`;
    }
    if (
      group.options.length < budget.gestureOptionsPerGroupMinimum
      || group.options.length > budget.gestureOptionsPerGroup
    ) {
      return `Alternatives group ${groupIndex + 1} must carry ${budget.gestureOptionsPerGroupMinimum}–${budget.gestureOptionsPerGroup} options.`;
    }
    for (const option of group.options) {
      if (
        option.trim().length === 0
        || option !== option.trim()
        || option.length > budget.gestureOptionCharacters
      ) {
        return `Alternatives group ${groupIndex + 1} contains an invalid option.`;
      }
      if (seenOptions.has(option)) {
        return 'The alternatives menu contains a duplicate option.';
      }
      seenOptions.add(option);
    }
  }
  return undefined;
}
