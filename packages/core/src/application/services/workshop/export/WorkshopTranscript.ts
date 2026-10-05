/**
 * The Workshop transcript: what a reader sees in the thread, as data.
 *
 * Export formats (Markdown, JSON, styled HTML) all render THIS projection, so
 * "what gets exported" is decided exactly once. The rule mirrors the thread
 * bubble (WorkshopTurnBubble) minus its chrome:
 *
 * - Writer messages export their visible text. Attached files and widget
 *   commits export as labels only; their bodies are host-private
 *   thread-artifacts and never leave the session.
 * - Participant replies export their display content, attribution, truncation
 *   notice, and web sources.
 * - Dividers (session start/resume, excerpt revisions, direct tool runs,
 *   standing-directive markers) export as events.
 * - Persona-requested capability artifacts (dictionary lookups, resource
 *   reads, persona-run analyses) are collapsed in the thread; they export as a
 *   one-line event naming the request, never the evidence body.
 * - Context-change dividers are context details and stay out entirely, as do
 *   token usage, action buttons, actionable-finding chips, and widget
 *   recommendation chips.
 *
 * Pure and deterministic: the caller supplies the turns and the clock.
 */

import { citationDisplayLabel, type WorkshopTurn } from '@messages';
import { workshopCapabilityArtifactLabel } from '@shared/constants/workshopCapabilityLabels';
import {
  workshopWidgetLabel,
  workshopWidgetSelectionUnitLabel
} from '@shared/constants/workshopWidgets';

/** The writer's own words, as sent. */
export interface WorkshopTranscriptWriterEntry {
  kind: 'writer';
  turnId: string;
  timestamp: number;
  content: string;
  /** The instrument this message went to privately, when it bypassed the room. */
  privateWith?: string;
  /** Files attached to this message, by label. Their text is never exported. */
  attachmentLabels: string[];
  /** The widget that composed this message. Its committed payload is never exported. */
  widget?: { label: string; detail: string };
}

/** One participant reply: host persona, guest persona, or analysis tool. */
export interface WorkshopTranscriptReplyEntry {
  kind: 'reply';
  turnId: string;
  timestamp: number;
  speaker: string;
  participant: 'host' | 'guest' | 'tool';
  content: string;
  /** The instrument this reply came from privately, when it bypassed the room. */
  privateWith?: string;
  /** The reply stopped at the max-token limit. */
  truncated: boolean;
  /** Provider-returned web sources, de-duplicated by URL. */
  sources: WorkshopTranscriptSource[];
}

export interface WorkshopTranscriptSource {
  url: string;
  /** Display label: the citation title, or the host name for a bare footnote. */
  label: string;
}

/** A divider or one-line notice in the thread. */
export interface WorkshopTranscriptEventEntry {
  kind: 'event';
  turnId: string;
  timestamp: number;
  text: string;
}

export type WorkshopTranscriptEntry =
  | WorkshopTranscriptWriterEntry
  | WorkshopTranscriptReplyEntry
  | WorkshopTranscriptEventEntry;

export interface WorkshopTranscript {
  title: string;
  exportedAt: number;
  /** Reply speakers in order of first appearance. */
  participants: string[];
  entries: WorkshopTranscriptEntry[];
}

export interface WorkshopTranscriptMeta {
  title: string;
  exportedAt: number;
}

export const WORKSHOP_TRANSCRIPT_WRITER_LABEL = 'Writer';

export function projectWorkshopTranscript(
  turns: readonly WorkshopTurn[],
  meta: WorkshopTranscriptMeta
): WorkshopTranscript {
  const entries = turns.flatMap((turn) => {
    const entry = projectTurn(turn);
    return entry ? [entry] : [];
  });
  const participants: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'reply' && !participants.includes(entry.speaker)) {
      participants.push(entry.speaker);
    }
  }
  return {
    title: meta.title,
    exportedAt: meta.exportedAt,
    participants,
    entries
  };
}

/** Writer messages and replies: the count a reader would call "messages". */
export function countWorkshopTranscriptMessages(transcript: WorkshopTranscript): number {
  return transcript.entries.filter((entry) => entry.kind !== 'event').length;
}

function projectTurn(turn: WorkshopTurn): WorkshopTranscriptEntry | undefined {
  if (turn.artifact === 'context_change') {
    return undefined;
  }
  if (
    turn.artifact === 'scope_change' ||
    turn.artifact === 'standing_directive_change' ||
    turn.artifact === 'session_start' ||
    turn.artifact === 'session_resume' ||
    turn.artifact === 'excerpt_revision' ||
    turn.participant === 'session'
  ) {
    return event(turn, turn.content);
  }
  if (turn.role === 'user') {
    return turn.kind === 'message'
      ? writerEntry(turn)
      : event(turn, `${turn.toolLabel ?? 'Tool'} · direct run · excerpt v${turn.excerptVersion}`);
  }
  if (turn.capability) {
    return event(
      turn,
      `${workshopCapabilityArtifactLabel(turn.capability, turn.toolLabel)} · ${turn.capability.status}`
    );
  }
  return replyEntry(turn);
}

function event(turn: WorkshopTurn, text: string): WorkshopTranscriptEventEntry | undefined {
  const trimmed = text.trim();
  return trimmed
    ? { kind: 'event', turnId: turn.id, timestamp: turn.timestamp, text: trimmed }
    : undefined;
}

function writerEntry(turn: WorkshopTurn): WorkshopTranscriptWriterEntry | undefined {
  const widgetCommit = turn.widgetCommit?.rail === 'thread-artifact' ? turn.widgetCommit : undefined;
  if (!turn.content.trim() && !widgetCommit) {
    return undefined;
  }
  return {
    kind: 'writer',
    turnId: turn.id,
    timestamp: turn.timestamp,
    content: turn.content,
    ...privateWith(turn),
    attachmentLabels: (turn.messageAttachments ?? []).map((attachment) => attachment.label),
    ...(widgetCommit
      ? {
          widget: {
            label: workshopWidgetLabel(widgetCommit.widgetId),
            detail: `${widgetCommit.selectionCount} ${workshopWidgetSelectionUnitLabel(
              widgetCommit.widgetId,
              widgetCommit.selectionCount
            )}`
          }
        }
      : {})
  };
}

function replyEntry(turn: WorkshopTurn): WorkshopTranscriptReplyEntry | undefined {
  if (!turn.content.trim()) {
    return undefined;
  }
  const seen = new Set<string>();
  const sources = (turn.citations ?? []).flatMap((citation) => {
    if (seen.has(citation.url)) {
      return [];
    }
    seen.add(citation.url);
    return [{ url: citation.url, label: citationDisplayLabel(citation) }];
  });
  return {
    kind: 'reply',
    turnId: turn.id,
    timestamp: turn.timestamp,
    speaker: turn.personaLabel ?? turn.toolLabel ?? 'Follow-up',
    participant: turn.participant === 'guest' || turn.participant === 'tool'
      ? turn.participant
      : 'host',
    content: turn.content,
    ...privateWith(turn),
    truncated: turn.truncated === true,
    sources
  };
}

function privateWith(turn: WorkshopTurn): { privateWith?: string } {
  return turn.artifact === 'direct_tool_message' || turn.artifact === 'direct_tool_response'
    ? { privateWith: turn.toolLabel ?? 'instrument' }
    : {};
}
