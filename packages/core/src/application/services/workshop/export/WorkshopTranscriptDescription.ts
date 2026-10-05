/** The one-line provenance summary every export format prints under its title. */

import type { WorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';

export function formatWorkshopTranscriptDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function describeWorkshopTranscript(
  transcript: WorkshopTranscript,
  messageCount: number
): string {
  const parts = [
    'Prose Minion Workshop',
    formatWorkshopTranscriptDate(transcript.exportedAt),
    `${messageCount.toLocaleString()} ${messageCount === 1 ? 'message' : 'messages'}`
  ];
  if (transcript.participants.length > 0) {
    parts.push(`with ${transcript.participants.join(', ')}`);
  }
  return parts.join(' · ');
}
