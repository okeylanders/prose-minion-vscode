/**
 * The words a host shows for Craft Flags (ADR 2026-10-21, Amendment
 * 2026-10-26: Slice 3c): the confirmation before a run, with its price, and
 * one notification line after it. Pure, so every host words a run the same
 * way, and so the wording is tested without a host.
 */

import type { CraftFlagsOutcome } from '@/domain/models/CraftFlag';
import type { CraftFlagsRunPlan } from '@/application/services/draftEdit/CraftFlagsUseCase';
import { costOf, plural, rejectedPart, type DraftEditSummary } from '@/application/services/draftEdit/draftEditSummary';

/**
 * The confirmation for a run that is ready: what it reads, the calls, the
 * model, and the price. A price is an estimate, never a cap: "≈ $0.06", or
 * "< $0.01" for one that rounds to nothing.
 */
export function describeCraftFlagsPlan(plan: Extract<CraftFlagsRunPlan, { kind: 'ready' }>, documentLabel: string): string {
  const words = plan.words.toLocaleString('en-US');
  const reads = plan.reads === 'selection'
    ? `${documentLabel} is too long to read whole, so Craft Flags reads the selection alone: ${words} words`
    : plan.selection
      ? `Craft Flags reads all ${words} words of ${documentLabel} for context, and flags only the selection`
      : `Craft Flags reads all ${words} words of ${documentLabel}`;
  const { estimate } = plan;
  const model = estimate.model ? ` to ${modelName(estimate.model)}` : '';
  const price = estimate.usd === undefined ? 'price unknown: the model catalog has no live price for it' : priceOf(estimate.usd);
  return `${reads}. That is ${plural(estimate.calls, 'request')}${model} (${price}).`;
}

/** One line for the writer; `documentLabel` is a path or "untitled document", never the text. */
export function describeCraftFlagsOutcome(outcome: CraftFlagsOutcome, documentLabel: string): DraftEditSummary {
  switch (outcome.kind) {
    case 'empty':
      return { level: 'info', message: `Nothing for Craft Flags to read in ${documentLabel}.`, hasFlags: false };
    case 'too-long':
      return {
        level: 'warning',
        message: `${documentLabel} has ${outcome.words.toLocaleString('en-US')} words, and Craft Flags reads up to ${outcome.limit.toLocaleString('en-US')} at once. Select a part of it to read that alone.`,
        hasFlags: false
      };
    case 'unconfigured':
      return { level: 'warning', message: 'Craft Flags needs an OpenRouter API key.', hasFlags: false };
    case 'busy':
      return { level: 'info', message: `Craft Flags is already running on ${documentLabel}.`, hasFlags: false };
    case 'changed':
      return { level: 'warning', message: `${documentLabel} changed before Craft Flags could start, so nothing was sent. Run it again.`, hasFlags: false };
    case 'cancelled': {
      const cost = costOf(outcome.usage?.costUsd);
      return { level: 'info', message: `Craft Flags cancelled. No flags changed${cost ? ` (spent ${cost})` : ''}.`, hasFlags: false };
    }
    case 'closed': {
      const parts = [`${documentLabel} was closed or changed language before Craft Flags finished, so no flags were shown`];
      const rejected = rejectedPart(outcome.rejectedCalls);
      const cost = costOf(outcome.usage?.costUsd);
      return { level: 'warning', message: `${[...parts, rejected, cost].filter(Boolean).join(' · ')}.`, hasFlags: false };
    }
    case 'completed': {
      const { dropped } = outcome;
      const kept = outcome.kept ?? 0;
      const lead = outcome.flagged === 0 ? (kept > 0 || outcome.reads === 'selection' ? 'no flags in the selection' : 'no flags') : plural(outcome.flagged, 'flag');
      const unplaced = dropped.unanchored + dropped.protected + dropped.overlapping + dropped.stale + dropped.malformed;
      const parts = [
        `Craft Flags ${documentLabel}: ${lead}`,
        kept > 0 ? `${plural(kept, 'earlier flag')} outside the selection kept` : '',
        dropped.dialogue > 0 ? `${dropped.dialogue} left alone in dialogue` : '',
        unplaced > 0 ? `${unplaced} not placed` : '',
        outcome.notesWithheld > 0 ? `${plural(outcome.notesWithheld, 'note')} not shown as written` : '',
        rejectedPart(outcome.rejectedCalls),
        costOf(outcome.usage?.costUsd)
      ];
      let message = parts.filter(Boolean).join(' · ');
      if (outcome.interrupted) {
        message += `. ${outcome.interrupted.message} (${outcome.calls.completed} of ${plural(outcome.calls.total, 'category', 'categories')} read.)`;
      }
      const rejected = outcome.rejectedCalls.saved + outcome.rejectedCalls.unsaved > 0;
      return {
        level: outcome.interrupted || rejected ? 'warning' : 'info',
        message,
        hasFlags: outcome.flagged + kept > 0
      };
    }
    default: {
      const unknown: never = outcome;
      return unknown;
    }
  }
}

/** "≈ $0.06", or "< $0.01" for a price that rounds to nothing. */
function priceOf(usd: number): string {
  return usd < 0.005 ? '< $0.01' : `≈ $${usd.toFixed(2)}`;
}

/** A model id without its provider ("anthropic/claude-sonnet-5" reads "claude-sonnet-5"). */
function modelName(model: string): string {
  const slash = model.lastIndexOf('/');
  return slash >= 0 ? model.slice(slash + 1) : model;
}
