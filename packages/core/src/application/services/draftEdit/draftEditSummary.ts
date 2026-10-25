/**
 * The words a host shows for a Draft Edit outcome (ADR 2026-10-21 D8): one
 * notification line, with counts and cost. Pure, so every host words a run
 * the same way, and so the wording is tested without a host.
 */

import type { DraftEditFixReport, DraftEditOutcome, DraftEditRejectedChunks } from '@/domain/models/DraftEdit';
import type { DraftEditQuickFixOutcome } from '@/application/services/draftEdit/DraftEditUseCase';

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
      const parts = [`${documentLabel} was closed or changed language before Proofread finished, so no flags were shown`];
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
      const { dropped, fix } = outcome;
      const unplaced = dropped.unanchored + dropped.protected + dropped.overlapping + dropped.stale + dropped.malformed;
      const flagged = outcome.flagged === 0
        ? ''
        : `${plural(outcome.flagged, 'issue')} flagged`
          + (outcome.judgmentCalls > 0 ? ` (${outcome.judgmentCalls} tense or agreement)` : '');
      const lead = [fix ? fixLead(fix) : '', flagged].filter(Boolean).join(' · ') || 'no issues found';
      const parts = [`Proofread ${documentLabel}: ${lead}`];
      if (fix && fix.unknown > 0) {
        parts.push(`${plural(fix.unknown, 'fix', 'fixes')} you edited during review left as you wrote ${fix.unknown === 1 ? 'it' : 'them'}`);
      }
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
        level: outcome.interrupted || rejected || fix?.answer === 'stale' || fix?.answer === 'failed' ? 'warning' : 'info',
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

/** What a Fix run did with its fixes, as the lead of its line; '' when it had none to offer. */
function fixLead(fix: DraftEditFixReport): string {
  switch (fix.answer) {
    case 'submitted':
      return `${plural(fix.applied, 'fix', 'fixes')} applied`
        + (fix.notApplied > 0 ? ` (${fix.notApplied} ${fix.review === 'preview' ? 'left unticked' : 'not applied'}, flagged)` : '');
    case 'declined':
      return 'fixes discarded, nothing changed';
    case 'stale':
      return fix.review === 'preview'
        ? 'the file changed during review, so no fixes were applied'
        : 'the file changed as the fixes went in, so they were not applied';
    case 'failed':
      return `the editor did not apply the fixes${fix.failure ? ` (${fix.failure})` : ''}`;
    case 'none':
      return '';
    default: {
      const unknown: never = fix.answer;
      return unknown;
    }
  }
}

/** The words for a quick fix (Replace with, Fix all); `quiet` when a single fix simply landed, and nothing needs saying. */
export function describeQuickFixOutcome(outcome: DraftEditQuickFixOutcome, documentLabel: string): DraftEditSummary & { readonly quiet: boolean } {
  const say = (level: 'info' | 'warning', message: string, quiet = false) => ({ level, message, hasFlags: false, quiet });
  switch (outcome.kind) {
    case 'busy':
      return say('info', `Proofread is already working on ${documentLabel}.`);
    case 'changed':
      return say('warning', `${documentLabel} changed since the fix was offered, so nothing was changed.`);
    case 'nothing':
      return say('info', 'That Proofread fix is no longer there: its flag was dismissed, or its text edited.');
    case 'closed':
      // Its lifetime is over, so what landed cannot be read: an Apply can win the race to it (PR #172 F-02).
      return say('warning', `${documentLabel} was closed or changed language before the fix finished. Check it: the fix may have gone in.`);
    case 'done': {
      switch (outcome.answer) {
        case 'submitted': {
          const left = outcome.notApplied > 0 ? ` · ${outcome.notApplied} left as flags` : '';
          return say('info', `Proofread ${documentLabel}: ${plural(outcome.applied, 'fix', 'fixes')} applied${left}.`, left === '' && outcome.applied === 1);
        }
        case 'declined':
          return say('info', 'Proofread fixes discarded; nothing changed.');
        case 'stale':
          return say('warning', outcome.review === 'preview'
            ? `${documentLabel} changed during review, so no fixes were applied.`
            : `${documentLabel} changed as the fix went in, so it was not applied.`);
        case 'failed':
          return say('warning', `The editor did not apply the fix${outcome.failure ? ` (${outcome.failure})` : ''}.`);
        case 'none':
          return say('warning', 'That fix was not applied: its text has changed, or it would change a line break or the Markdown around it.');
        default: {
          const unknown: never = outcome.answer;
          return unknown;
        }
      }
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
