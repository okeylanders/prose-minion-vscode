/**
 * A session-recall read window (ADR 2026-10-05 §4): whole visible entries,
 * in ledger order, until a character budget is spent.
 *
 * - Each entry opens with "[turn N · time · speaker]"; attachments and
 *   widgets use export phrasing, and a private instrument exchange carries
 *   a "private" marker, as export does.
 * - Discussion detail (D10) collapses each tool report (a reply whose
 *   participant is the tool) to one line naming its turn and word count.
 *   The writer's messages, host and guest persona replies, and events stay
 *   whole: the discussion of a report is usually the reply after it.
 * - Day headers use the session's timezone; elapsed gaps get the room
 *   frames' "[N hours later]" markers; a jump to the next requested range
 *   is marked.
 * - Only an entry too large for an empty window is cut, keeping its head,
 *   with a notice. The window reports what it delivered (first and last
 *   turn ids, for provenance) and where to continue.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import {
  WORKSHOP_TRANSCRIPT_WRITER_LABEL,
  WorkshopTranscriptReplyEntry
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopRecallEntry } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { recallLabel, recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';
import {
  WorkshopRecallClock,
  workshopRecallDuration,
  workshopRecallTimeKnown
} from '@/application/services/workshop/recall/WorkshopRecallTime';
import type {
  WorkshopRecallReadDetail,
  WorkshopRecallReadRange,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The "[turn N cut here …]" notice. */
const NOTICE_RESERVE = 120;
/** A cut shorter than this reads as noise; the entry waits for the next window instead. */
const MINIMUM_CUT_CHARACTERS = 200;
/** The "Attached:" line of one writer turn. */
const ATTACHMENT_LABEL_CHARACTERS = 1_000;
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

/** A tool report a discussion-detail window showed as one line. */
export interface WorkshopRecallCollapsedEntry {
  readonly position: number;
  readonly turnId: string;
}

/** The one entry cut to fit an empty window. */
export interface WorkshopRecallTruncatedEntry {
  readonly position: number;
  readonly shownCharacters: number;
  readonly totalCharacters: number;
}

export interface WorkshopRecallReadWindow {
  blocks: string[];
  /** Includes the tool reports shown as one line; `collapsed` names them. */
  delivered: WorkshopRecallDeliveredRange[];
  continuation: WorkshopRecallTurnRange[];
  collapsed: WorkshopRecallCollapsedEntry[];
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
  budget: number,
  detail: WorkshopRecallReadDetail
): WorkshopRecallReadWindow {
  const clock = new WorkshopRecallClock(timezone);
  const window: WorkshopRecallReadWindow = { blocks: [], delivered: [], continuation: [], collapsed: [] };
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
      const report = detail === 'discussion' ? toolReport(entry.entry) : undefined;
      const text = report ? collapsedReport(entry.position, report, clock) : renderEntry(entry, clock);
      const block = [...lead, text].join(WORKSHOP_RECALL_BLOCK_SEPARATOR);
      const cost = block.length + WORKSHOP_RECALL_BLOCK_SEPARATOR.length;
      if (used + cost <= budget) {
        window.blocks.push(block);
        used += cost;
        shown.push(entry);
        if (report) {
          window.collapsed.push({ position: entry.position, turnId: entry.turnId });
        }
        previous = entry;
        continue;
      }
      const prefix = lead.map((line) => `${line}${WORKSHOP_RECALL_BLOCK_SEPARATOR}`).join('');
      const cut = previous === undefined
        ? headOf(text, budget - used - prefix.length - NOTICE_RESERVE - 2 * WORKSHOP_RECALL_BLOCK_SEPARATOR.length)
        : '';
      if (cut.length >= MINIMUM_CUT_CHARACTERS) {
        // Too large for an empty window: keep its head, and say so.
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
        // No room for this entry, or for a readable head of it: it opens the next window.
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
  // No gap is measured to or from a time no Date can hold.
  const gap = previous && workshopRecallTimeKnown(previous.entry.timestamp) && workshopRecallTimeKnown(entry.entry.timestamp)
    ? entry.entry.timestamp - previous.entry.timestamp
    : 0;
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
        `[${at} · ${WORKSHOP_TRANSCRIPT_WRITER_LABEL}${entry.privateWith ? ` · private with ${recallLabel(entry.privateWith)}` : ''}]`
      ];
      if (entry.attachmentLabels.length > 0) {
        lines.push(`Attached: ${recallLabelList(entry.attachmentLabels, ATTACHMENT_LABEL_CHARACTERS)}`);
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
      // Labels from a saved file are clipped; the reply itself is the record.
      const lines = [`[${at} · ${recallLabel(entry.speaker)}${entry.privateWith ? ' · private' : ''}]`];
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

/** A reply from a tool, rather than a persona: what discussion detail collapses. */
function toolReport(entry: WorkshopRecallEntry['entry']): WorkshopTranscriptReplyEntry | undefined {
  return entry.kind === 'reply' && entry.participant === 'tool' ? entry : undefined;
}

/**
 * "[turn 12 · 10:42 AM · Stock & Signature report · 2,431 words · read it in
 * full with <turns>12</turns>]": a discussion-detail read's whole report.
 * Short enough never to be cut, and it shows nothing of the report's body.
 */
function collapsedReport(position: number, report: WorkshopTranscriptReplyEntry, clock: WorkshopRecallClock): string {
  const words = countWords(report.content);
  return `[turn ${position} · ${clock.time(report.timestamp)} · ${recallLabel(report.speaker)} report` +
    `${report.privateWith ? ' · private' : ''} · ${formatCount(words)} ${words === 1 ? 'word' : 'words'} · ` +
    `read it in full with <turns>${position}</turns>]`;
}

/**
 * At most `budget` characters from the start (none when the budget is not
 * positive), ending at a word boundary when one is near the limit.
 */
function headOf(text: string, budget: number): string {
  if (budget <= 0) {
    return '';
  }
  if (text.length <= budget) {
    return text;
  }
  const space = text.lastIndexOf(' ', budget);
  return text.slice(0, space >= 0 && space > budget - 40 ? space : budget).trimEnd();
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall entry: ${JSON.stringify(value)}`);
}
