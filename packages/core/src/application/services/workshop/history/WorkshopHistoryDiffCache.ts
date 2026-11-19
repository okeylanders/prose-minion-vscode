/**
 * Finished diffs, kept so a continuation never aligns again (ADR 2026-11-19
 * D13; PR #286 F-03). Built once, in `extension.ts`, and shared by every
 * turn's history capability: a continuation is a later call, often in a
 * later turn.
 *
 * Keyed by the SHA-256 of both texts, so a key can only name the diff of
 * exactly those two texts: a file saved again, or another commit, is
 * another key. At most `diffCacheEntries` are kept, the least recently used
 * dropped first. Holds no path, and logs nothing.
 */

import { createHash } from 'crypto';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  diffWorkshopHistoryTexts,
  type WorkshopHistoryDiffResult
} from '@/application/services/workshop/history/WorkshopHistoryDiff';

const digest = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

export class WorkshopHistoryDiffCache {
  private readonly entries = new Map<string, WorkshopHistoryDiffResult>();

  constructor(
    private readonly capacity: number = PROMPT_BUDGETS.workshopHistory.diffCacheEntries,
    private readonly compute: (older: string, newer: string) => WorkshopHistoryDiffResult = diffWorkshopHistoryTexts
  ) {}

  /** The diff of `older` and `newer`: kept from an earlier call when there is one, else computed and kept. */
  diff(older: string, newer: string): { readonly result: WorkshopHistoryDiffResult; readonly cached: boolean } {
    const key = `${digest(older)}:${digest(newer)}`;
    const kept = this.entries.get(key);
    if (kept) {
      this.entries.delete(key);
      this.entries.set(key, kept);
      return { result: kept, cached: true };
    }
    const result = this.compute(older, newer);
    this.entries.set(key, result);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
    return { result, cached: false };
  }
}
