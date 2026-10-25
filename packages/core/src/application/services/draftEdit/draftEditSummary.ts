/**
 * The words a host shows for a Draft Edit outcome (ADR 2026-10-21 D8): one
 * notification line, with counts and cost. Pure, so every host words a run
 * the same way, and so the wording is tested without a host.
 */

import type { DraftEditOutcome } from '@/domain/models/DraftEdit';

export interface DraftEditSummary {
  readonly level: 'info' | 'warning';
  readonly message: string;
  /** True when flags were shown, so the host may offer to open its problems view. */
  readonly hasFlags: boolean;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** One line for the writer; `documentLabel` is a path or "untitled document", never the text. */
export function describeDraftEditOutcome(outcome: DraftEditOutcome, documentLabel: string): DraftEditSummary {
  switch (outcome.kind) {
    case 'empty':
      return { level: 'info', message: `Nothing to proofread in ${documentLabel}.`, hasFlags: false };
    case 'unconfigured':
      return { level: 'warning', message: 'Proofread needs an OpenRouter API key.', hasFlags: false };
    case 'busy':
      return { level: 'info', message: `Proofread is already running on ${documentLabel}.`, hasFlags: false };
    case 'cancelled': {
      const cost = costOf(outcome.usage?.costUsd);
      return { level: 'info', message: `Proofread cancelled. No flags changed${cost ? ` (spent ${cost})` : ''}.`, hasFlags: false };
    }
    case 'completed': {
      const { dropped } = outcome;
      const unplaced = dropped.unanchored + dropped.protected + dropped.overlapping + dropped.stale + dropped.malformed;
      const parts = [
        outcome.flagged === 0
          ? `Proofread ${documentLabel}: no issues found`
          : `Proofread ${documentLabel}: ${plural(outcome.flagged, 'issue')} flagged`
            + (outcome.judgmentCalls > 0 ? ` (${outcome.judgmentCalls} tense or agreement)` : '')
      ];
      if (unplaced > 0) {
        parts.push(`${unplaced} not placed`);
      }
      if (outcome.rejectedChunks > 0) {
        parts.push(`${plural(outcome.rejectedChunks, 'part')} unreadable, saved for recovery`);
      }
      const cost = costOf(outcome.usage?.costUsd);
      if (cost) {
        parts.push(cost);
      }
      let message = parts.join(' · ');
      if (outcome.interrupted) {
        message += `. ${outcome.interrupted.message} (${outcome.chunks.completed} of ${plural(outcome.chunks.total, 'part')} proofread.)`;
      }
      return {
        level: outcome.interrupted || outcome.rejectedChunks > 0 ? 'warning' : 'info',
        message,
        hasFlags: outcome.flagged > 0
      };
    }
    default: {
      const unknown: never = outcome;
      return unknown;
    }
  }
}

/** A cost the provider reported, or '' when it is unknown (never a made-up $0). */
function costOf(costUsd: number | undefined): string {
  return costUsd === undefined ? '' : `$${costUsd.toFixed(4)}`;
}
