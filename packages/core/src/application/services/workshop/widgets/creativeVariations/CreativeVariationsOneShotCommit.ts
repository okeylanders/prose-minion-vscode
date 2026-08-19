/** Creative Variations validation and rendering plugged into the one-shot rail. */

import type {
  WorkshopCreativeVariationsCommitPayload,
  WorkshopCreativeVariationsDraft
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  assertCreativeVariationsDraftIntegrity
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigIntegrity';
import {
  assertCreativeVariationsDraftShape,
  summarizeCreativeVariationsDraft
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';
import {
  buildCreativeVariationsArtifact
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact';
import {
  creativeVariationsSelectionCommitIssues
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsCommitEligibility';
import type {
  WorkshopOneShotWidgetCommitPreparationResult
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';

export function prepareCreativeVariationsOneShotCommit(
  payload: WorkshopCreativeVariationsCommitPayload
): WorkshopOneShotWidgetCommitPreparationResult {
  if (payload.widgetId !== 'creative-variations') {
    return {
      ok: false,
      reason: 'unsupported-one-shot-widget',
      message: 'That payload does not belong to Creative Variations.'
    };
  }

  const invalid = validateCreativeVariationsCommitDraft(payload.draft);
  if (invalid) {
    return { ok: false, reason: 'invalid-draft', message: invalid };
  }

  const artifact = buildCreativeVariationsArtifact(payload.draft);
  const selectionCount = payload.draft.selections.length;
  const subjectPreview = summarizeCreativeVariationsDraft(payload.draft)
    .subjectPreview.replace(/\s+/g, ' ')
    .trim();
  const displayText = `I’m committing ${selectionCount} selected Creative Variations ${
    selectionCount === 1 ? 'take' : 'takes'
  } for “${subjectPreview}” to the room.`;

  return {
    ok: true,
    commit: {
      widgetId: payload.widgetId,
      widgetConfigInput: { widgetId: payload.widgetId, draft: payload.draft },
      clonedFromConfigId: payload.clonedFromConfigId,
      roomText: displayText,
      displayText,
      toolTargetRefusalMessage:
        'Switch to a persona target before committing Creative Variations — tool sidecars do not take creative directions.',
      artifact: {
        label: workshopWidgetLabel(payload.widgetId),
        content: artifact,
        selectionCount
      }
    }
  };
}

function validateCreativeVariationsCommitDraft(
  draft: WorkshopCreativeVariationsDraft
): string | undefined {
  try {
    assertCreativeVariationsDraftShape(draft, 'Creative Variations commit draft');
  } catch {
    return 'The Creative Variations draft is malformed. Reopen or regenerate it before committing.';
  }

  if (!draft.workup) {
    return 'Generate a settled workup before committing.';
  }
  if (draft.selections.length === 0) {
    return 'Select at least one take before committing.';
  }

  const selectionIssue = creativeVariationsSelectionCommitIssues(draft)[0];
  if (selectionIssue) {
    return selectionIssue.message;
  }

  // This binds host-derived ids, cardinality, and overlap shape. Generated text
  // remains immutable through the authoring UI; it is not cryptographically bound.
  try {
    assertCreativeVariationsDraftIntegrity(draft, 'Creative Variations commit draft');
  } catch {
    return 'The Creative Variations workup no longer matches its authored inputs. Regenerate it before committing.';
  }

  let artifact: string;
  try {
    artifact = buildCreativeVariationsArtifact(draft);
  } catch {
    return 'The selected Creative Variations takes could not be compiled.';
  }
  const budget = PROMPT_BUDGETS.workshopWidgets.creativeArtifactCharacters;
  if (artifact.length > budget) {
    return `The Creative Variations artifact exceeds ${budget.toLocaleString()} characters.`;
  }
  return undefined;
}
