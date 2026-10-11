/**
 * Pure rules for the Show vs. Tell surrounding passage and context sources
 * (Sprint 05, Slice 7 design edits, D2).
 *
 * The surrounding passage is writer text: typed, pasted, or copied in from the
 * excerpt or the editor selection. The context is a multi-select of the room's
 * sources, stored unique and in canonical order, exactly as the host's
 * integrity gate demands. Both are generation inputs; neither rides the commit.
 * Everything here is a deterministic function of its arguments.
 */

import type {
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopShowVsTellDraft,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  showVsTellSourceReferenceKey,
  sortShowVsTellSourceReferences
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import type {
  ShowVsTellAvailableSource,
  ShowVsTellGenerateBlocker
} from '@components/workshop/widgets/showVsTell/showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

/** The room sources a writer may ground the beat on: the active excerpt and each attachment. */
export function deriveShowVsTellAvailableSources(
  activeExcerpt: WorkshopExcerptSnapshot | null,
  contextAttachments: readonly WorkshopContextAttachmentSnapshot[]
): ShowVsTellAvailableSource[] {
  return [
    ...(activeExcerpt
      ? [{
          reference: { kind: 'active-excerpt' } as const,
          label: 'Active excerpt',
          detail: activeExcerpt.source.kind === 'manual'
            ? `Pasted Workshop passage · version ${activeExcerpt.version}`
            : `${activeExcerpt.source.relativePath} · version ${activeExcerpt.version}`
        }]
      : []),
    ...contextAttachments.map((attachment) => ({
      reference: { kind: 'context-attachment' as const, attachmentId: attachment.id },
      label: attachment.label,
      detail: `${attachment.kind === 'file' ? attachment.relativePath ?? 'Project file' : 'Workshop text'} · ${attachment.words.toLocaleString()} words`
    }))
  ];
}

/**
 * Toggles one context source. The result is unique and in canonical order
 * whatever order the writer clicked, and the same array comes back when the
 * selection would exceed the reference budget.
 */
export function toggledShowVsTellSourceReferences(
  references: readonly WorkshopWidgetSourceReference[],
  reference: WorkshopWidgetSourceReference
): WorkshopWidgetSourceReference[] {
  const key = showVsTellSourceReferenceKey(reference);
  const selected = references.some((candidate) => showVsTellSourceReferenceKey(candidate) === key);
  if (!selected && references.length >= BUDGET.showVsTellSourceReferences) {
    return references as WorkshopWidgetSourceReference[];
  }
  return sortShowVsTellSourceReferences(
    selected
      ? references.filter((candidate) => showVsTellSourceReferenceKey(candidate) !== key)
      : [...references, { ...reference }]
  );
}

/**
 * Text arriving in the surrounding-passage box, from any intake. Line breaks
 * are kept (a passage is not a beat), and text over the context allowance is
 * shortened with a visible notice rather than refused.
 */
export function showVsTellPassageFromText(raw: string): { text: string; notice: string | null } {
  const limit = BUDGET.showVsTellContextCharacters;
  if (raw.length <= limit) {
    return { text: raw, notice: null };
  }
  return {
    text: raw.slice(0, limit),
    notice: `That passage was longer than ${limit.toLocaleString()} characters, so the box holds its first ${limit.toLocaleString()}.`
  };
}

/** The draft with new passage text; the same draft comes back when nothing changes. */
export function withShowVsTellPassageText(
  draft: WorkshopShowVsTellDraft,
  writerText: string
): WorkshopShowVsTellDraft {
  return writerText === draft.surroundingContext.writerText
    ? draft
    : { ...draft, surroundingContext: { ...draft.surroundingContext, writerText } };
}

/** The draft with one context source toggled; the same draft comes back when nothing changes. */
export function withShowVsTellSourceReferenceToggled(
  draft: WorkshopShowVsTellDraft,
  reference: WorkshopWidgetSourceReference
): WorkshopShowVsTellDraft {
  const sourceReferences = toggledShowVsTellSourceReferences(
    draft.surroundingContext.sourceReferences,
    reference
  );
  return sourceReferences === draft.surroundingContext.sourceReferences
    ? draft
    : { ...draft, surroundingContext: { ...draft.surroundingContext, sourceReferences } };
}

/** The selected context sources the room no longer offers; each blocks Generate until removed. */
export function unavailableShowVsTellSourceReferences(
  draft: WorkshopShowVsTellDraft,
  availableSources: readonly ShowVsTellAvailableSource[]
): WorkshopWidgetSourceReference[] {
  const available = new Set(
    availableSources.map((source) => showVsTellSourceReferenceKey(source.reference))
  );
  return draft.surroundingContext.sourceReferences.filter(
    (reference) => !available.has(showVsTellSourceReferenceKey(reference))
  );
}

/**
 * Why Generate is unavailable: a blank beat, or a context source the room no
 * longer offers. Must survive is optional (D3) and zero channels is "no
 * emphasis" (D4), so neither blocks.
 */
export function deriveShowVsTellGenerateBlockers(
  draft: WorkshopShowVsTellDraft,
  availableSources: readonly ShowVsTellAvailableSource[]
): ShowVsTellGenerateBlocker[] {
  const blockers: ShowVsTellGenerateBlocker[] = [];
  if (draft.beat.text.trim().length === 0) {
    blockers.push('beat-required');
  }
  if (unavailableShowVsTellSourceReferences(draft, availableSources).length > 0) {
    blockers.push('source-unavailable');
  }
  return blockers;
}
