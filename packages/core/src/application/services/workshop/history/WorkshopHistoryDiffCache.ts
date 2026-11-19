/**
 * Computed change lists, kept per window so a continuation never runs the
 * paragraph alignment again (ADR 2026-11-19 D13a; PR #286 F-03). Built once,
 * in `extension.ts`, and shared by every turn's history capability: a
 * continuation is a later call, often in a later turn.
 *
 * Keyed by the file, the two full hashes or the `current` fingerprint, and
 * the budgets the alignment ran under, so a key names exactly one pair of
 * versions: a file saved again, another commit or changed budgets is
 * another key. A refusal is kept too, so a repeated call does not rerun it.
 * At most `alignCacheEntries` are kept, the least recently used dropped
 * first. Host-side only: a key never reaches a result or a log.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  diffWorkshopHistoryTexts,
  type WorkshopHistoryDiffOutcome
} from '@/application/services/workshop/history/WorkshopHistoryDiff';

/** What names one computed diff (D13a). */
export interface WorkshopHistoryAlignKey {
  /** HOST-SIDE ONLY. */
  readonly fsPath: string;
  readonly from: string;
  /** A full hash, or `current:<fingerprint>`. */
  readonly to: string;
}

/** The budgets an alignment ran under, as part of its key. */
function budgetsKey(): string {
  const { alignParagraphs, paragraphEditLength, maxEditLength, wordDiffParagraphCharacters, contextParagraphs } =
    PROMPT_BUDGETS.workshopHistory;
  return [alignParagraphs, paragraphEditLength, maxEditLength, wordDiffParagraphCharacters, contextParagraphs].join(',');
}

export class WorkshopHistoryDiffCache {
  private readonly entries = new Map<string, WorkshopHistoryDiffOutcome>();

  constructor(
    private readonly capacity: number = PROMPT_BUDGETS.workshopHistory.alignCacheEntries,
    private readonly compute: (older: string, newer: string) => WorkshopHistoryDiffOutcome = diffWorkshopHistoryTexts
  ) {}

  /** The diff of the pair `key` names: kept from an earlier call, else computed once from the texts and kept. */
  diff(key: WorkshopHistoryAlignKey, older: string, newer: string): { readonly outcome: WorkshopHistoryDiffOutcome; readonly cached: boolean } {
    const id = [key.fsPath, key.from, key.to, budgetsKey()].join('\u0000');
    const kept = this.entries.get(id);
    if (kept) {
      this.entries.delete(id);
      this.entries.set(id, kept);
      return { outcome: kept, cached: true };
    }
    const outcome = this.compute(older, newer);
    this.entries.set(id, outcome);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
    return { outcome, cached: false };
  }
}
