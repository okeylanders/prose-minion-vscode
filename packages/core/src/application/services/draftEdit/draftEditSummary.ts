/**
 * The words a host shows for a Draft Edit outcome (ADR 2026-10-21 D8): one
 * notification line, with counts and cost. Pure, so every host words a run
 * the same way, and so the wording is tested without a host.
 */

import type { DraftEditOutcome, DraftEditRejectedChunks } from '@/domain/models/DraftEdit';

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
    case 'changed':
      return { level: 'warning', message: `${documentLabel} changed before Proofread could start, so nothing was sent. Run it again.`, hasFlags: false };
    case 'cancelled': {
      const cost = costOf(outcome.usage?.costUsd);
      return { level: 'info', message: `Proofread cancelled. No flags changed${cost ? ` (spent ${cost})` : ''}.`, hasFlags: false };
    }
    case 'closed': {
      const parts = [`${documentLabel} was closed before Proofread finished, so no flags were shown`];
      const rejected = rejectedPart(outcome.rejectedChunks);
      if (rejected) {
        parts.push(rejected);
      }
      const cost = costOf(outcome.usage?.costUsd);
      if (cost) {
        parts.push(cost);
      }
      return { level: 'warning', message: `${parts.join(' · ')}.`, hasFlags: false };
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
      const rejected = rejectedPart(outcome.rejectedChunks);
      if (rejected) {
        parts.push(rejected);
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
        level: outcome.interrupted || rejected ? 'warning' : 'info',
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

/**
 * Unreadable parts, saying only what is true of their recovery copies: a
 * failed save is never called saved (PR #171 F-06). The output channel holds
 * the store's reason.
 */
function rejectedPart({ saved, unsaved }: DraftEditRejectedChunks): string {
  const total = saved + unsaved;
  if (total === 0) {
    return '';
  }
  if (unsaved === 0) {
    return `${plural(total, 'part')} unreadable, saved for recovery`;
  }
  if (saved === 0) {
    return `${plural(total, 'part')} unreadable and not saved for recovery (see the Prose Minion output)`;
  }
  return `${plural(total, 'part')} unreadable: ${saved} saved for recovery, ${unsaved} not saved (see the Prose Minion output)`;
}

/** A cost the provider reported, or '' when it is unknown (never a made-up $0). */
function costOf(costUsd: number | undefined): string {
  return costUsd === undefined ? '' : `$${costUsd.toFixed(4)}`;
}
