/**
 * A session-recall read window (ADR 2026-10-05 §4): whole visible entries,
 * in ledger order, until a character budget is spent.
 *
 * - Each entry opens with "[turn N · time · speaker]"; attachments and
 *   widgets use export phrasing, and a private instrument exchange carries
 *   a "private" marker, as export does.
 * - Day headers use the session's timezone; elapsed gaps get the room
 *   frames' "[N hours later]" markers; a jump to the next requested range
 *   is marked.
 * - Only an entry too large for an empty window is cut, keeping its head,
 *   with a notice. The window reports what it delivered (first and last
 *   turn ids, for provenance) and where to continue.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_TRANSCRIPT_WRITER_LABEL } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopRecallEntry } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  WorkshopRecallClock,
  workshopRecallDuration
} from '@/application/services/workshop/recall/WorkshopRecallTime';
import type {
  WorkshopRecallReadRange,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The "[turn N cut here …]" notice. */
const NOTICE_RESERVE = 120;
/** Between header, entries, notices, and footer. */
export const WORKSHOP_RECALL_BLOCK_SEPARATOR = '\n\n';

/** A range of entries a read window delivered, for provenance. */
export interface WorkshopRecallDeliveredRange {
  readonly from: number;
  readonly to: number;
  readonly firstTurnId: string;
  readonly lastTurnId: string;
  readonly entryCount: number;
}

/** The one entry cut to fit an empty window. */
export interface WorkshopRecallTruncatedEntry {
  readonly position: number;
  readonly shownCharacters: number;
  readonly totalCharacters: number;
}

export interface WorkshopRecallReadWindow {
  blocks: string[];
  delivered: WorkshopRecallDeliveredRange[];
  continuation: WorkshopRecallTurnRange[];
  truncatedEntry?: WorkshopRecallTruncatedEntry;
}

/** "38-46, 52": the `<turns>` grammar. */
export function formatWorkshopRecallTurnRanges(ranges: readonly WorkshopRecallTurnRange[]): string {
  return ranges.map((range) => (range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`)).join(', ');
}

/**
 * Pack whole entries in ledger order until `budget` characters are spent,
 * counting each block's separator. Only the first entry of an empty window
 * may be cut.
 */
export function packWorkshopRecallReadWindow(
  ranges: readonly WorkshopRecallReadRange[],
  timezone: string,
  budget: number
): WorkshopRecallReadWindow {
  const clock = new WorkshopRecallClock(timezone);
  const window: WorkshopRecallReadWindow = { blocks: [], delivered: [], continuation: [] };
  let used = 0;
  let previous: WorkshopRecallEntry | undefined;

  for (const range of ranges) {
    if (window.continuation.length > 0) {
      if (range.entries.length > 0) {
        window.continuation.push({ from: range.entries[0].position, to: range.to });
      }
      continue;
    }
    const shown: WorkshopRecallEntry[] = [];
    for (const [index, entry] of range.entries.entries()) {
      const lead = leadIn(previous, entry, index === 0, clock);
      const text = renderEntry(entry, clock);
      const block = [...lead, text].join(WORKSHOP_RECALL_BLOCK_SEPARATOR);
      const cost = block.length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length;
      if (used + cost <= budget) {
        window.blocks.push(block);
        used += cost;
        shown.push(entry);
        previous = entry;
        continue;
      }
      if (previous === undefined) {
        // Too large for an empty window: keep its head, and say so.
        const prefix = lead.map((line) => `${line}${WORKSHOP_RECALL_BLOCK_SEPARATOR}`).join('');
        const cut = headOf(text, budget - used - prefix.length - NOTICE_RESERVE - 2 * WORKSHOP_RECALL_BLOCK_SEPARATOR.length);
        window.blocks.push(
          `${prefix}${cut}`,
          `[turn ${entry.position} cut here: ${formatCount(cut.length)} of ` +
            `${formatCount(text.length)} characters shown]`
        );
        window.truncatedEntry = {
          position: entry.position,
          shownCharacters: cut.length,
          totalCharacters: text.length
        };
        shown.push(entry);
        previous = entry;
        // The cut entry spends the window; anything after it continues next time.
        used = budget;
        const next = range.entries[index + 1];
        if (next) {
          window.continuation.push({ from: next.position, to: range.to });
        }
      } else {
        window.continuation.push({ from: entry.position, to: range.to });
      }
      break;
    }
    if (shown.length > 0) {
      const first = shown[0];
      const last = shown[shown.length - 1];
      window.delivered.push({
        from: first.position,
        to: last.position,
        firstTurnId: first.turnId,
        lastTurnId: last.turnId,
        entryCount: shown.length
      });
    }
  }
  return window;
}

/**
 * Separators before an entry: a jump to the next requested range, an elapsed
 * gap, a new day. Within a range, positions also skip turns the thread never
 * shows; those need no marker.
 */
function leadIn(
  previous: WorkshopRecallEntry | undefined,
  entry: WorkshopRecallEntry,
  firstInRange: boolean,
  clock: WorkshopRecallClock
): string[] {
  const lead: string[] = [];
  if (previous && firstInRange && entry.position > previous.position + 1) {
    const from = previous.position + 1;
    const to = entry.position - 1;
    lead.push(from === to ? `[turn ${from} not shown]` : `[turns ${from}-${to} not shown]`);
  }
  const gap = previous ? entry.entry.timestamp - previous.entry.timestamp : 0;
  if (previous && gap > PROMPT_BUDGETS.workshopRoom.gapMilliseconds) {
    lead.push(`[${workshopRecallDuration(gap)} later]`);
  }
  if (!previous || clock.day(previous.entry.timestamp) !== clock.day(entry.entry.timestamp)) {
    lead.push(`── ${clock.date(entry.entry.timestamp)} ──`);
  }
  return lead;
}

function renderEntry(recall: WorkshopRecallEntry, clock: WorkshopRecallClock): string {
  const { entry, position } = recall;
  const at = `turn ${position} · ${clock.time(entry.timestamp)}`;
  switch (entry.kind) {
    case 'event':
      return `[${at} · event] ${entry.text}`;
    case 'writer': {
      const lines = [
        `[${at} · ${WORKSHOP_TRANSCRIPT_WRITER_LABEL}${entry.privateWith ? ` · private with ${entry.privateWith}` : ''}]`
      ];
      if (entry.attachmentLabels.length > 0) {
        lines.push(`Attached: ${entry.attachmentLabels.join(', ')}`);
      }
      if (entry.widget) {
        lines.push(`Composed with ${entry.widget.label} · ${entry.widget.detail}`);
      }
      if (entry.content.trim()) {
        lines.push(entry.content);
      }
      return lines.join('\n');
    }
    case 'reply': {
      const lines = [`[${at} · ${entry.speaker}${entry.privateWith ? ' · private' : ''}]`];
      if (entry.truncated) {
        lines.push('(This reply hit the max-token limit and was cut off.)');
      }
      lines.push(entry.content);
      if (entry.sources.length > 0) {
        lines.push(`Sources: ${entry.sources.map((source) => `${source.label} <${source.url}>`).join('; ')}`);
      }
      return lines.join('\n');
    }
    default:
      return assertNever(entry);
  }
}

/** At most `limit` characters from the start, ending at a word boundary when one is near. */
function headOf(text: string, budget: number): string {
  const limit = Math.max(0, budget);
  if (text.length <= limit) {
    return text;
  }
  const space = text.lastIndexOf(' ', limit);
  return text.slice(0, space > limit - 40 ? space : limit).trimEnd();
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall entry: ${JSON.stringify(value)}`);
}
