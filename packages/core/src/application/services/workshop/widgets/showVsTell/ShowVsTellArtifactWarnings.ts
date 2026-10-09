/**
 * Host-appended invariant warning lines for the committed Show vs. Tell artifact.
 *
 * Warnings ride the room beneath the counted body but are never part of the
 * 600-character count: the writer cannot shorten a model's warning, so it must
 * never be the reason commit is blocked. They are passive. A warning does not
 * change eligibility, and nothing here can refuse a commit.
 *
 * Each line is
 *   `warning: kept line <n> · <strong|advisory> · <must survive|must not change> · <note>`
 * where `<n>` is the one-based ordinal among the artifact's `keep:`/`direction:`
 * lines (the only numbering the room ever sees), `strong` is a `hard-conflict`,
 * and `advisory` is an `advisory-risk`. Variants come in workup order and each
 * variant's flags in flag order, so the block is deterministic. The key is not
 * one of the counted line keys, so a reader can never mistake a warning for a
 * counted line.
 */

import {
  PROMPT_BUDGETS
} from '@shared/constants/promptBudgets';
import type {
  WorkshopShowVsTellInvariantFlag,
  WorkshopShowVsTellDraft
} from '@messages';
import {
  encodeShowVsTellArtifactValue,
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

export const SHOW_VS_TELL_WARNING_LINE_KEY = 'warning:';

const STRENGTH: Record<WorkshopShowVsTellInvariantFlag['kind'], string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Flag kinds are wire literals.
  'hard-conflict': 'strong',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Flag kinds are wire literals.
  'advisory-risk': 'advisory'
};

const INVARIANT: Record<WorkshopShowVsTellInvariantFlag['invariantField'], string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Flag fields are wire literals.
  'must-survive': 'must survive',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Flag fields are wire literals.
  'must-not-change': 'must not change'
};

export function showVsTellWarningLine(
  keptLineOrdinal: number,
  flag: WorkshopShowVsTellInvariantFlag
): string {
  return `${SHOW_VS_TELL_WARNING_LINE_KEY} kept line ${keptLineOrdinal} · `
    + `${STRENGTH[flag.kind]} · ${INVARIANT[flag.invariantField]} · `
    + encodeShowVsTellArtifactValue(flag.note);
}

/**
 * Warning lines for the kept variants, in workup order. Empty when nothing
 * flagged. Requires a settled workup; a draft without one has no variants.
 */
export function buildShowVsTellArtifactWarnings(
  draft: Pick<WorkshopShowVsTellDraft, 'workup' | 'kept'>
): string[] {
  if (!draft.workup) {
    return [];
  }
  const keptIds = new Set(draft.kept.map((kept) => kept.variantId));
  const lines: string[] = [];
  let ordinal = 0;
  for (const variant of showVsTellWorkupVariants(draft.workup)) {
    if (!keptIds.has(variant.id)) {
      continue;
    }
    ordinal += 1;
    for (const flag of variant.invariantFlags) {
      lines.push(showVsTellWarningLine(ordinal, flag));
    }
  }
  return lines;
}

/** Upper bound of the warning block: variants × flags × (note + the longest fixed prefix). */
export function showVsTellWarningBlockBound(): number {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const longestPrefix = showVsTellWarningLine(
    budget.showVsTellVariants,
    { id: 'x', invariantField: 'must-not-change', kind: 'advisory-risk', note: '' }
  ).length;
  const lines = budget.showVsTellVariants * budget.showVsTellFlagsPerVariant;
  // Each warning is its own line, so the joining newlines count too.
  return lines * (longestPrefix + budget.showVsTellFlagNoteCharacters) + lines;
}

/** Appends the warning block beneath the counted body; the body is returned unchanged when none. */
export function appendShowVsTellArtifactWarnings(
  body: string,
  warnings: readonly string[]
): string {
  return warnings.length === 0 ? body : [body, ...warnings].join('\n');
}
