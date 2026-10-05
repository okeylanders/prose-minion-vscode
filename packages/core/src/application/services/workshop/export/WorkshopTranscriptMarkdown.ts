/**
 * Markdown rendering of a Workshop transcript — the format meant for pasting
 * into another agent or a notes app. Message bodies stay verbatim: replies are
 * already Markdown, and the writer's text is exported exactly as typed.
 *
 * Every entry opens with a horizontal rule. Replies carry their own headings
 * ("### Next steps"), so a speaker heading alone would not tell a reader —
 * or an agent — where one message ends and the next speaker begins.
 */

import {
  WORKSHOP_TRANSCRIPT_WRITER_LABEL,
  WorkshopTranscript,
  WorkshopTranscriptEntry,
  countWorkshopTranscriptMessages
} from './WorkshopTranscript';
import { describeWorkshopTranscript } from './WorkshopTranscriptDescription';

export function renderWorkshopTranscriptMarkdown(transcript: WorkshopTranscript): string {
  const blocks = [
    `# ${escapeInline(transcript.title)}`,
    `_${escapeInline(describeWorkshopTranscript(transcript, countWorkshopTranscriptMessages(transcript)))}_`,
    ...transcript.entries.map((entry) => `---\n\n${renderEntry(entry)}`)
  ];
  return `${blocks.join('\n\n')}\n`;
}

function renderEntry(entry: WorkshopTranscriptEntry): string {
  switch (entry.kind) {
    case 'event':
      return `_${escapeInline(entry.text)}_`;
    case 'writer': {
      const lines = [
        `### ${WORKSHOP_TRANSCRIPT_WRITER_LABEL}${
          entry.privateWith ? ` · private with ${escapeInline(entry.privateWith)}` : ''
        }`
      ];
      if (entry.attachmentLabels.length > 0) {
        lines.push(`_Attached: ${entry.attachmentLabels.map(escapeInline).join(', ')}_`);
      }
      if (entry.widget) {
        lines.push(`_Composed with ${escapeInline(entry.widget.label)} · ${escapeInline(entry.widget.detail)}_`);
      }
      if (entry.content.trim()) {
        lines.push(entry.content.trim());
      }
      return lines.join('\n\n');
    }
    case 'reply': {
      const lines = [
        `### ${escapeInline(entry.speaker)}${
          entry.privateWith ? ' · private' : ''
        }`
      ];
      if (entry.truncated) {
        lines.push('_Response hit the max-token limit and was truncated._');
      }
      lines.push(entry.content.trim());
      if (entry.sources.length > 0) {
        lines.push([
          '**Sources**',
          '',
          ...entry.sources.map((source, index) =>
            `${index + 1}. [${escapeInline(source.label)}](<${linkDestination(source.url)}>)`
          )
        ].join('\n'));
      }
      return lines.join('\n\n');
    }
  }
}

/** An angle-bracket link destination cannot itself contain angle brackets. */
function linkDestination(url: string): string {
  return url.replace(/[<>]/g, (character) => encodeURIComponent(character));
}

/** Backslash-escape the inline syntax a label could accidentally trigger. */
function escapeInline(text: string): string {
  return text.replace(/[\\`*_[\]<>#|]/g, (character) => `\\${character}`);
}
