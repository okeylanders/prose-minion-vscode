/** Show vs. Tell validation and rendering plugged into the one-shot rail. */

import type { WorkshopShowVsTellCommitPayload } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  appendShowVsTellArtifactWarnings,
  buildShowVsTellArtifactWarnings
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifactWarnings';
import {
  showVsTellArtifactOverBudgetMessage,
  showVsTellCommitIssues
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellCommitEligibility';
import {
  assertShowVsTellDraftShape,
  summarizeShowVsTellDraft
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellDraftIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import {
  SHOW_VS_TELL_POSITIONS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import type {
  WorkshopOneShotWidgetCommitPreparationResult
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';

type Rejection = Extract<WorkshopOneShotWidgetCommitPreparationResult, { ok: false }>;

const reject = (message: string): Rejection => ({
  ok: false,
  reason: 'invalid-draft',
  message
});

/**
 * Validates the host-received draft and compiles the artifact itself; the
 * webview never supplies artifact text. Nothing here touches the editor: the
 * plan has no editor operation to run, only a room message and an artifact.
 */
export function prepareShowVsTellOneShotCommit(
  payload: WorkshopShowVsTellCommitPayload
): WorkshopOneShotWidgetCommitPreparationResult {
  if (payload.widgetId !== 'show-vs-tell') {
    return {
      ok: false,
      reason: 'unsupported-one-shot-widget',
      message: 'That payload does not belong to Show vs. Tell.'
    };
  }

  const { draft } = payload;
  try {
    assertShowVsTellDraftShape(draft, 'Show vs. Tell commit draft');
  } catch {
    return reject('The Show vs. Tell draft is malformed. Reopen or regenerate it before committing.');
  }

  const issue = showVsTellCommitIssues(draft)[0];
  if (issue) {
    return reject(issue.message);
  }

  // This binds host-derived ids, cardinality, per-field ceilings, and flag
  // grammar (no direction-versus-prose rule since D5). Generated text stays immutable through the authoring UI; it is
  // not cryptographically bound.
  try {
    assertShowVsTellDraftIntegrity(draft, 'Show vs. Tell commit draft');
  } catch {
    return reject(
      'The Show vs. Tell workup no longer matches its authored inputs. Regenerate it before committing.'
    );
  }

  let body: string;
  try {
    body = buildShowVsTellArtifact(draft);
  } catch {
    return reject('The kept Show vs. Tell variants could not be compiled.');
  }
  // The host's independent ceiling: it re-measures the body that actually
  // ships, whatever the webview's meter said. Warning lines are not counted.
  if (body.length > PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters) {
    return reject(showVsTellArtifactOverBudgetMessage());
  }

  const content = appendShowVsTellArtifactWarnings(
    body,
    buildShowVsTellArtifactWarnings(draft)
  );
  const text = writerTurnText(draft);
  return {
    ok: true,
    commit: {
      widgetId: payload.widgetId,
      widgetConfigInput: { widgetId: payload.widgetId, draft },
      clonedFromConfigId: payload.clonedFromConfigId,
      roomText: text,
      displayText: text,
      toolTargetRefusalMessage:
        'Switch to a persona target before committing Show vs. Tell — tool sidecars do not take craft directions.',
      artifact: {
        label: workshopWidgetLabel(payload.widgetId),
        content,
        selectionCount: draft.kept.length
      }
    }
  };
}

/**
 * The writer's turn carries only the bounded beat preview, the position, and
 * the optional note, so the directions have a referent. Prose, directions,
 * invariants, warnings, and the surrounding passage never ride it.
 */
function writerTurnText(draft: WorkshopShowVsTellCommitPayload['draft']): string {
  const beat = summarizeShowVsTellDraft(draft).beatPreview.replace(/\s+/g, ' ').trim();
  const position = SHOW_VS_TELL_POSITIONS.find((candidate) => candidate.id === draft.position);
  const positionName = (position?.name ?? draft.position).toLowerCase();
  const note = draft.note.replace(/\s+/g, ' ').trim();
  return `Ran “${beat}” through the playground at ${positionName} — here's how I want the beat carried`
    + `${note.length > 0 ? ` — ${note}` : ''}.`;
}
