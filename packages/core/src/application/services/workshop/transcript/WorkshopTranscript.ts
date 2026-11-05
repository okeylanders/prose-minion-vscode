/**
 * The Workshop transcript: what a reader sees in the thread, as data.
 *
 * Every reader of a past thread renders THIS projection — the export formats
 * (Markdown, JSON, styled HTML) today, session recall next — so "what a reader
 * may see" is decided exactly once. The rule mirrors the thread
 * bubble (WorkshopTurnBubble) minus its chrome:
 *
 * - Writer messages export their visible text. Attached files, Lightbox
 *   tiles (Lightbox Slice 4: the pill's label, its kind and title) and
 *   widget commits export as labels only; their bodies (a tile's claim,
 *   points and quotes) are host-private thread-artifacts and never leave
 *   the session.
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
 * - A turn the writer bookmarked carries `bookmarked: true` when the caller
 *   names its bookmarks (export does; ADR 2026-11-03 D10). The mark is the
 *   only bookmark fact a transcript holds: never an id or a label.
 * - Model slices (ADR 2026-11-03 D8) come from `deriveWorkshopModelSlices`,
 *   the thread's own derivation, run over every turn. A slice is printed
 *   before the first entry at or after the turn it belongs before, so a turn
 *   the transcript omits never drops one. A stamped reply or capability
 *   card carries its `model` (D10).
 * - A persona reply's file-edit cards (ADR 2026-11-05 D8) carry each card's
 *   file (its group and path, or the excerpt), its `why` and its state:
 *   never an operation's text (a quote, a replacement, a passage), which is
 *   the writer's file and the persona's draft of it.
 * - Neither slices, `model` nor `fileEdits` come from
 *   `projectWorkshopTranscriptTurn`, so session recall and the turn
 *   preview, which read turns only through it, never see them.
 *
 * Pure and deterministic: the caller supplies the turns and the clock.
 */

import {
  citationDisplayLabel,
  type ModelScope,
  type WorkshopFileEditState,
  type WorkshopFileEditTarget,
  type WorkshopTurn,
  type WorkshopTurnModel
} from '@messages';
import {
  deriveWorkshopModelSlices,
  workshopModelSliceText,
  type WorkshopModelSlice
} from '@shared/workshop/workshopModelSlices';
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
  /** Files and Lightbox tiles attached to this message, by label. Their text is never exported. */
  attachmentLabels: string[];
  /** The widget that composed this message. Its committed payload is never exported. */
  widget?: { label: string; detail: string };
  bookmarked?: true;
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
  bookmarked?: true;
  /** The model stamp, set by `projectWorkshopTranscript` only (ADR 2026-11-03 D10). */
  model?: WorkshopTurnModel;
  /** The reply's file-edit cards, set by `projectWorkshopTranscript` only (ADR 2026-11-05 D8). */
  fileEdits?: WorkshopTranscriptFileEdit[];
}

/** One file-edit card as a transcript shows it: which file, why, and what became of it. Never its text. */
export interface WorkshopTranscriptFileEdit {
  target: WorkshopFileEditTarget;
  why: string;
  state: WorkshopFileEditState;
}

/** A card's file in words: its path and group, or the excerpt's document. */
export function workshopTranscriptFileEditLabel(target: WorkshopFileEditTarget): string {
  return target.kind === 'excerpt' ? 'the excerpt\'s document' : `${target.path} (${target.group})`;
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
  bookmarked?: true;
  /** A capability card's model stamp, set by `projectWorkshopTranscript` only. */
  model?: WorkshopTurnModel;
}

/** One turn's entry: what `projectWorkshopTranscriptTurn` returns. */
export type WorkshopTranscriptEntry =
  | WorkshopTranscriptWriterEntry
  | WorkshopTranscriptReplyEntry
  | WorkshopTranscriptEventEntry;

/** Where the room's model changed (ADR 2026-11-03 D8). It belongs to no turn. */
export interface WorkshopTranscriptModelSliceEntry {
  kind: 'model-slice';
  scope: ModelScope;
  fromModelId: string;
  toModelId: string;
  /** The divider's copy, with display names resolved at projection. */
  text: string;
}

/** A line of the whole transcript: a turn's entry or a model slice. */
export type WorkshopTranscriptLine = WorkshopTranscriptEntry | WorkshopTranscriptModelSliceEntry;

export interface WorkshopTranscript {
  title: string;
  exportedAt: number;
  /** Reply speakers in order of first appearance. */
  participants: string[];
  entries: WorkshopTranscriptLine[];
}

export interface WorkshopTranscriptMeta {
  title: string;
  exportedAt: number;
  /** The writer's bookmarked turns; their entries carry `bookmarked: true`. */
  bookmarkedTurnIds?: ReadonlySet<string>;
  /** A model's display name for slices; the raw id when it names none. */
  modelLabel?: (modelId: string) => string | undefined;
}

export const WORKSHOP_TRANSCRIPT_WRITER_LABEL = 'Writer';

export function projectWorkshopTranscript(
  turns: readonly WorkshopTurn[],
  meta: WorkshopTranscriptMeta
): WorkshopTranscript {
  const slices = slicesByTurn(deriveWorkshopModelSlices(turns), meta);
  const pending: WorkshopTranscriptModelSliceEntry[] = [];
  const entries = turns.flatMap((turn): WorkshopTranscriptLine[] => {
    pending.push(...(slices.get(turn.id) ?? []));
    const entry = projectWorkshopTranscriptTurn(turn);
    if (!entry) {
      return [];
    }
    const marked = meta.bookmarkedTurnIds?.has(turn.id) ? { ...entry, bookmarked: true as const } : entry;
    return [...pending.splice(0), withFileEdits(withModel(marked, turn), turn)];
  });
  // A slice whose turns all print nothing still closes the transcript.
  entries.push(...pending);
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
  return transcript.entries.filter((entry) => entry.kind === 'writer' || entry.kind === 'reply').length;
}

function slicesByTurn(
  slices: readonly WorkshopModelSlice[],
  meta: WorkshopTranscriptMeta
): ReadonlyMap<string, WorkshopTranscriptModelSliceEntry[]> {
  const label = (modelId: string) => meta.modelLabel?.(modelId) ?? modelId;
  const byTurn = new Map<string, WorkshopTranscriptModelSliceEntry[]>();
  for (const slice of slices) {
    byTurn.set(slice.beforeTurnId, [...(byTurn.get(slice.beforeTurnId) ?? []), {
      kind: 'model-slice',
      scope: slice.scope,
      fromModelId: slice.fromModelId,
      toModelId: slice.toModelId,
      text: workshopModelSliceText(slice.scope, label(slice.fromModelId), label(slice.toModelId))
    }]);
  }
  return byTurn;
}

/** A stamped reply's or capability card's entry, carrying its model (D10). */
function withModel(entry: WorkshopTranscriptEntry, turn: WorkshopTurn): WorkshopTranscriptEntry {
  if (entry.kind === 'writer' || turn.role !== 'assistant' || !turn.model) {
    return entry;
  }
  return {
    ...entry,
    model: {
      scope: turn.model.scope,
      requestedModelId: turn.model.requestedModelId,
      servedModelIds: [...turn.model.servedModelIds]
    }
  };
}

/** A reply's file-edit cards: file, why and state, never the operations (D8). */
function withFileEdits(entry: WorkshopTranscriptEntry, turn: WorkshopTurn): WorkshopTranscriptEntry {
  if (entry.kind !== 'reply' || !turn.fileEditProposals?.length) {
    return entry;
  }
  return {
    ...entry,
    fileEdits: turn.fileEditProposals.map((proposal) => ({
      target: proposal.target.kind === 'excerpt'
        ? { kind: 'excerpt' }
        : { kind: 'resource', group: proposal.target.group, path: proposal.target.path },
      why: proposal.why,
      state: proposal.state
    }))
  };
}

/**
 * One turn's visible entry, or undefined when the thread shows nothing for it.
 * Exposed so a reader that keeps its own position bookkeeping (session recall
 * numbers turns by ledger position) applies exactly the same rule.
 */
export function projectWorkshopTranscriptTurn(
  turn: WorkshopTurn
): WorkshopTranscriptEntry | undefined {
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
