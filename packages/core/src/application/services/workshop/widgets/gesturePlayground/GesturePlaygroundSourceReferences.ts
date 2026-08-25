/** Writer-facing validation for Gesture Playground source-reference inputs. */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export function gesturePlaygroundSourceReferencesValidationError(
  value: unknown
): string | undefined {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const maximum = budget.gestureSourceReferences;
  if (!Array.isArray(value) || value.length > maximum) {
    return `Source material must carry at most ${maximum} references.`;
  }
  const seen = new Set<string>();
  let serializedCharacters = 0;
  for (const referenceValue of value) {
    if (
      typeof referenceValue !== 'object'
      || referenceValue === null
      || Array.isArray(referenceValue)
    ) {
      return 'One of the source material references is invalid.';
    }
    const reference = referenceValue as Record<string, unknown>;
    let key: string;
    if (reference.kind === 'active-excerpt') {
      if (Object.keys(reference).length !== 1) {
        return 'The active excerpt source reference is invalid.';
      }
      key = 'active-excerpt';
    } else if (reference.kind === 'context-attachment') {
      if (
        Object.keys(reference).length !== 2
        || typeof reference.attachmentId !== 'string'
        || !/^ctx-[1-9]\d*$/.test(reference.attachmentId)
      ) {
        return 'One of the context source references is invalid.';
      }
      key = `context-attachment:${reference.attachmentId}`;
    } else {
      return 'One of the source material references is invalid.';
    }
    serializedCharacters += key.length + (seen.size > 0 ? 1 : 0);
    if (serializedCharacters > budget.gestureSourceReferenceCharacters) {
      return `Source material references exceed ${budget.gestureSourceReferenceCharacters} characters.`;
    }
    if (seen.has(key)) {
      return 'The source material references contain a duplicate.';
    }
    seen.add(key);
  }
  return undefined;
}
