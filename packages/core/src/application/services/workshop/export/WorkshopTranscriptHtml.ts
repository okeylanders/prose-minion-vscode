/**
 * Styled-HTML rendering of a Workshop transcript — a standalone page meant
 * for sharing, styled like the thread it came from.
 *
 * Reply bodies are model output, so they are untrusted HTML inputs exactly as
 * they are in the webview. The extension host has no DOM for DOMPurify, so
 * this renderer is safe by construction instead:
 *
 * - raw HTML in Markdown (block or inline) renders as visible, escaped text;
 * - images render as their escaped alt text — never a network fetch;
 * - links keep only http(s)/mailto/#fragment destinations, normalized and
 *   attribute-escaped; anything else renders as its label alone;
 * - every other text path goes through marked's own escaping.
 *
 * A restrictive Content-Security-Policy backs that up: the page can load no
 * script, image, font, or stylesheet, so a renderer bug cannot become a
 * beacon. The writer's own messages are escaped plain text, as in the thread.
 */

import { Marked, type Tokens } from 'marked';
import { ICON_PATHS, IconName } from '@shared/constants/iconPaths';
import {
  WORKSHOP_TRANSCRIPT_WRITER_LABEL,
  WorkshopTranscript,
  WorkshopTranscriptEntry,
  WorkshopTranscriptReplyEntry,
  WorkshopTranscriptWriterEntry,
  countWorkshopTranscriptMessages
} from './WorkshopTranscript';
import { describeWorkshopTranscript } from './WorkshopTranscriptDescription';
import { WORKSHOP_TRANSCRIPT_HTML_CSS } from './WorkshopTranscriptHtmlStyles';

const CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'";
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },
    image({ text }: Tokens.Image): string {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link): string {
      const label = this.parser.parseInline(tokens);
      const destination = safeLinkDestination(href);
      if (!destination) {
        return label;
      }
      return `<a href="${escapeHtml(destination)}"${
        title ? ` title="${escapeHtml(title)}"` : ''
      } rel="noreferrer noopener">${label}</a>`;
    }
  }
});

export function renderWorkshopTranscriptMarkdownHtml(content: string): string {
  return markdown.parse(content, { async: false });
}

/** The normalized destination when it is safe to link to, else undefined. */
export function safeLinkDestination(href: string): string | undefined {
  const trimmed = href.trim();
  if (/^#[^\s]*$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function renderWorkshopTranscriptHtml(transcript: WorkshopTranscript): string {
  const title = escapeHtml(transcript.title);
  const description = escapeHtml(
    describeWorkshopTranscript(transcript, countWorkshopTranscriptMessages(transcript))
  );
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
    '<meta name="generator" content="Prose Minion Workshop">',
    `<title>${title}</title>`,
    `<style>\n${WORKSHOP_TRANSCRIPT_HTML_CSS}\n</style>`,
    '</head>',
    '<body data-pm-surface="workshop">',
    '<div class="pm-ws pm-ws-export">',
    '<header class="pm-ws-export-header">',
    `<div class="pm-ws-eyebrow">${icon('dialogue', 12)} Prose Minion · Workshop</div>`,
    `<h1 class="pm-ws-export-title">${title}</h1>`,
    `<p class="pm-ws-export-meta">${description}</p>`,
    '</header>',
    '<main class="pm-ws-thread">',
    ...transcript.entries.map(renderEntry),
    '</main>',
    '<footer class="pm-ws-export-footer">Exported from Prose Minion</footer>',
    '</div>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function renderEntry(entry: WorkshopTranscriptEntry): string {
  switch (entry.kind) {
    case 'event':
      return `<div class="pm-ws-revision-divider" role="separator"><span>${escapeHtml(entry.text)}</span></div>`;
    case 'writer':
      return renderWriter(entry);
    case 'reply':
      return renderReply(entry);
  }
}

function renderWriter(entry: WorkshopTranscriptWriterEntry): string {
  const parts: string[] = [];
  if (entry.attachmentLabels.length > 0) {
    parts.push(
      '<div class="pm-ws-turn-attachments" aria-label="Message attachments">' +
      entry.attachmentLabels
        .map((label) => `<span class="pm-ws-turn-attachment">${icon('doc', 11)} ${escapeHtml(label)}</span>`)
        .join('') +
      '</div>'
    );
  }
  if (entry.privateWith) {
    parts.push(privateLabel(entry.privateWith));
  }
  parts.push(`<div class="pm-ws-turn-message">${escapeHtml(entry.content)}</div>`);
  if (entry.widget) {
    parts.push(
      '<div class="pm-ws-widget-chipwrap"><span class="pm-ws-widget-chip">' +
      `${icon('hand', 13)} ${escapeHtml(entry.widget.label)} ` +
      `<span class="pm-ws-widget-chip-meta">${escapeHtml(entry.widget.detail)}</span>` +
      '</span></div>'
    );
  }
  // The thread shows no name on the writer's bubble; a reader of a shared
  // page still needs one, so the landmark carries it.
  return `<article class="pm-ws-turn pm-ws-turn-user${
    entry.privateWith ? ' pm-ws-turn-private' : ''
  }" aria-label="${WORKSHOP_TRANSCRIPT_WRITER_LABEL}">${parts.join('')}</article>`;
}

function renderReply(entry: WorkshopTranscriptReplyEntry): string {
  const head =
    '<div class="pm-ws-turn-head">' +
    `<span class="pm-ws-eyebrow">${icon(entry.participant === 'tool' ? 'sparkle' : 'person', 12)} ${
      escapeHtml(entry.speaker)
    }</span>` +
    (entry.privateWith ? privateLabel(entry.privateWith) : '') +
    '</div>';
  const truncated = entry.truncated
    ? '<p class="pm-ws-turn-truncated">Response hit the max-token limit and was truncated.</p>'
    : '';
  const body = `<div class="markdown-content pm-ws-turn-body">${
    renderWorkshopTranscriptMarkdownHtml(entry.content)
  }</div>`;
  return `<article class="pm-ws-turn pm-ws-turn-assistant${
    entry.privateWith ? ' pm-ws-turn-private' : ''
  }" aria-label="${escapeHtml(entry.speaker)}">${head}${truncated}${body}${renderSources(entry)}</article>`;
}

function renderSources(entry: WorkshopTranscriptReplyEntry): string {
  const pills = entry.sources.flatMap((source, index) => {
    const destination = safeLinkDestination(source.url);
    if (!destination) {
      return [];
    }
    return [
      `<a class="pm-ws-ctx-pill pm-ws-turn-citation-pill" href="${escapeHtml(destination)}" ` +
      `title="${escapeHtml(destination)}" rel="noreferrer noopener">` +
      `${icon('link', 12)}<span class="pm-ws-turn-citation-number">${index + 1}</span>` +
      `<span class="pm-ws-ctx-pill-label">${escapeHtml(source.label)}</span></a>`
    ];
  });
  if (pills.length === 0) {
    return '';
  }
  return '<div class="pm-ws-turn-citations" aria-label="Web sources">' +
    '<div class="pm-ws-eyebrow">Web sources</div>' +
    `<div class="pm-ws-turn-citation-pills">${pills.join('')}</div>` +
    '</div>';
}

function privateLabel(instrument: string): string {
  return `<span class="pm-ws-private-thread-label">${icon('info', 11)} Private · you + ${
    escapeHtml(instrument)
  }</span>`;
}

function icon(name: IconName, size: number): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    `aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
