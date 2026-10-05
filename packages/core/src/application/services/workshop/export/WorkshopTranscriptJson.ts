/**
 * JSON rendering of a Workshop transcript — the format meant for scripts and
 * agent pipelines.
 *
 * This is a transcript projection, NOT the session codec: it cannot be opened
 * as a session and carries no host-private state. `formatVersion` versions
 * this shape only; bump it when a field changes meaning or disappears.
 */

import {
  WorkshopTranscript,
  WorkshopTranscriptEntry,
  countWorkshopTranscriptMessages
} from './WorkshopTranscript';

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
    }
  | {
      kind: 'event';
      timestamp: string;
      text: string;
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
    entries: transcript.entries.map(toJsonEntry)
  };
}

export function renderWorkshopTranscriptJson(transcript: WorkshopTranscript): string {
  return `${JSON.stringify(buildWorkshopTranscriptJsonDocument(transcript), null, 2)}\n`;
}

function toJsonEntry(entry: WorkshopTranscriptEntry): WorkshopTranscriptJsonEntry {
  const timestamp = new Date(entry.timestamp).toISOString();
  switch (entry.kind) {
    case 'event':
      return { kind: 'event', timestamp, text: entry.text };
    case 'writer':
      return {
        kind: 'writer',
        timestamp,
        content: entry.content,
        ...(entry.privateWith ? { privateWith: entry.privateWith } : {}),
        attachments: [...entry.attachmentLabels],
        ...(entry.widget ? { widget: { ...entry.widget } } : {})
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
        sources: entry.sources.map((source) => ({ ...source }))
      };
  }
}
