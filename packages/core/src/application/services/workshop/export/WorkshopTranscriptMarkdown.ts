/**
 * Markdown rendering of a Workshop transcript — the format meant for pasting
 * into another agent or a notes app. Message bodies stay verbatim, byte for
 * byte: replies are already Markdown, and the writer's text is exported
 * exactly as typed, edge whitespace included.
 *
 * Every entry opens with a horizontal rule. Replies carry their own headings
 * ("### Next steps"), so a speaker heading alone would not tell a reader —
 * or an agent — where one message ends and the next speaker begins.
 */

import {
  WORKSHOP_TRANSCRIPT_WRITER_LABEL,
  WorkshopTranscript,
  WorkshopTranscriptEntry,
  WorkshopTranscriptLine,
  countWorkshopTranscriptMessages
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { describeWorkshopTranscript } from './WorkshopTranscriptDescription';
import {
  workshopTranscriptReplyModel,
  type WorkshopTranscriptRenderOptions
} from './WorkshopTranscriptModelHeader';

export function renderWorkshopTranscriptMarkdown(
  transcript: WorkshopTranscript,
  options: WorkshopTranscriptRenderOptions = {}
): string {
  const blocks = [
    `# ${escapeInline(transcript.title)}`,
    `_${escapeInline(describeWorkshopTranscript(transcript, countWorkshopTranscriptMessages(transcript)))}_`,
    ...transcript.entries.map((entry) => `---\n\n${renderEntry(entry, options)}`)
  ];
  return `${blocks.join('\n\n')}\n`;
}

function renderEntry(entry: WorkshopTranscriptLine, options: WorkshopTranscriptRenderOptions): string {
  switch (entry.kind) {
    // A model slice (ADR 2026-11-03 D8) reads like the thread's other dividers.
    case 'model-slice':
      return `_${escapeInline(entry.text)}_`;
    case 'event':
      return `_${entry.bookmarked ? `${BOOKMARKED} · ` : ''}${escapeInline(entry.text)}_`;
    case 'writer': {
      const lines = [
        `### ${WORKSHOP_TRANSCRIPT_WRITER_LABEL}${
          entry.privateWith ? ` · private with ${escapeInline(entry.privateWith)}` : ''
        }${bookmarkSuffix(entry)}`
      ];
      if (entry.attachmentLabels.length > 0) {
        lines.push(`_Attached: ${entry.attachmentLabels.map(escapeInline).join(', ')}_`);
      }
      if (entry.widget) {
        lines.push(`_Composed with ${escapeInline(entry.widget.label)} · ${escapeInline(entry.widget.detail)}_`);
      }
      // Blank text (a widget-only message) adds no body; real text is never
      // trimmed — leading indentation can be an indented code block.
      if (entry.content.trim()) {
        lines.push(entry.content);
      }
      return lines.join('\n\n');
    }
    case 'reply': {
      // The reply's model follows its speaker, as in the thread's header (D10).
      const model = workshopTranscriptReplyModel(entry, options);
      const lines = [
        `### ${escapeInline(entry.speaker)}${
          model ? ` · ${escapeInline(model)}` : ''
        }${
          entry.privateWith ? ' · private' : ''
        }${bookmarkSuffix(entry)}`
      ];
      if (entry.truncated) {
        lines.push('_Response hit the max-token limit and was truncated._');
      }
      lines.push(entry.content);
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

/** A bookmarked turn's heading ends with the mark (ADR 2026-11-03 D10). */
const BOOKMARKED = 'Bookmarked';

function bookmarkSuffix(entry: WorkshopTranscriptEntry): string {
  return entry.bookmarked ? ` · ${BOOKMARKED}` : '';
}

/** An angle-bracket link destination cannot itself contain angle brackets. */
function linkDestination(url: string): string {
  return url.replace(/[<>]/g, (character) => encodeURIComponent(character));
}

/** Backslash-escape the inline syntax a label could accidentally trigger. */
function escapeInline(text: string): string {
  return text.replace(/[\\`*_[\]<>#|]/g, (character) => `\\${character}`);
}
