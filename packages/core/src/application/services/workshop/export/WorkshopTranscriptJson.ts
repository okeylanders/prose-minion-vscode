/**
 * JSON rendering of a Workshop transcript — the format meant for scripts and
 * agent pipelines.
 *
 * This is a transcript projection, NOT the session codec: it cannot be opened
 * as a session and carries no host-private state. `formatVersion` versions
 * this shape only; bump it when a field changes meaning or disappears.
 * `bookmarked` and `model` (ADR 2026-11-03 D10) are additive, so the version
 * stands. Model slices are not entries here: a script derives them from each
 * entry's `model`, which is exactly what the thread and the other formats
 * draw them from.
 */

import type { WorkshopTurnModel } from '@messages';
import {
  WorkshopTranscript,
  WorkshopTranscriptEntry,
  countWorkshopTranscriptMessages
} from '@/application/services/workshop/transcript/WorkshopTranscript';

export const WORKSHOP_TRANSCRIPT_JSON_FORMAT = 'prose-minion.workshop-transcript';
export const WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION = 1;

export interface WorkshopTranscriptJsonDocument {
  format: typeof WORKSHOP_TRANSCRIPT_JSON_FORMAT;
  formatVersion: typeof WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION;
  title: string;
  /** ISO-8601, UTC. */
  exportedAt: string;
  participants: string[];
  messageCount: number;
  entries: WorkshopTranscriptJsonEntry[];
}

export type WorkshopTranscriptJsonEntry =
  | {
      kind: 'writer';
      timestamp: string;
      content: string;
      privateWith?: string;
      attachments: string[];
      widget?: { label: string; detail: string };
      bookmarked?: true;
    }
  | {
      kind: 'reply';
      timestamp: string;
      speaker: string;
      participant: 'host' | 'guest' | 'tool';
      content: string;
      privateWith?: string;
      truncated: boolean;
      sources: Array<{ url: string; label: string }>;
      bookmarked?: true;
      model?: WorkshopTurnModel;
      /** File-edit cards: the file, why and state, never the edit's text (ADR 2026-11-05 D10). */
      fileEdits?: Array<{ path: string; why: string; state: string }>;
    }
  | {
      kind: 'event';
      timestamp: string;
      text: string;
      bookmarked?: true;
      /** A capability card's model, as a reply's. */
      model?: WorkshopTurnModel;
    };

export function buildWorkshopTranscriptJsonDocument(
  transcript: WorkshopTranscript
): WorkshopTranscriptJsonDocument {
  return {
    format: WORKSHOP_TRANSCRIPT_JSON_FORMAT,
    formatVersion: WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION,
    title: transcript.title,
    exportedAt: new Date(transcript.exportedAt).toISOString(),
    participants: [...transcript.participants],
    messageCount: countWorkshopTranscriptMessages(transcript),
    entries: transcript.entries.flatMap((entry) => (entry.kind === 'model-slice' ? [] : [toJsonEntry(entry)]))
  };
}

export function renderWorkshopTranscriptJson(transcript: WorkshopTranscript): string {
  return `${JSON.stringify(buildWorkshopTranscriptJsonDocument(transcript), null, 2)}\n`;
}

function toJsonEntry(entry: WorkshopTranscriptEntry): WorkshopTranscriptJsonEntry {
  const timestamp = new Date(entry.timestamp).toISOString();
  switch (entry.kind) {
    case 'event':
      return { kind: 'event', timestamp, text: entry.text, ...bookmarked(entry), ...model(entry) };
    case 'writer':
      return {
        kind: 'writer',
        timestamp,
        content: entry.content,
        ...(entry.privateWith ? { privateWith: entry.privateWith } : {}),
        attachments: [...entry.attachmentLabels],
        ...(entry.widget ? { widget: { ...entry.widget } } : {}),
        ...bookmarked(entry)
      };
    case 'reply':
      return {
        kind: 'reply',
        timestamp,
        speaker: entry.speaker,
        participant: entry.participant,
        content: entry.content,
        ...(entry.privateWith ? { privateWith: entry.privateWith } : {}),
        truncated: entry.truncated,
        sources: entry.sources.map((source) => ({ ...source })),
        ...bookmarked(entry),
        ...model(entry),
        ...(entry.fileEdits ? {
          fileEdits: entry.fileEdits.map((edit) => ({ path: edit.path, why: edit.why, state: edit.state }))
        } : {})
      };
  }
}

function bookmarked(entry: WorkshopTranscriptEntry): { bookmarked?: true } {
  return entry.bookmarked ? { bookmarked: true } : {};
}

function model(entry: WorkshopTranscriptEntry): { model?: WorkshopTurnModel } {
  return entry.kind !== 'writer' && entry.model
    ? { model: { ...entry.model, servedModelIds: [...entry.model.servedModelIds] } }
    : {};
}
