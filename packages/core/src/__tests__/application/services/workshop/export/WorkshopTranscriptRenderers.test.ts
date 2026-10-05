import { projectWorkshopTranscript } from '@/application/services/workshop/export/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import {
  WORKSHOP_TRANSCRIPT_JSON_FORMAT,
  WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION,
  renderWorkshopTranscriptJson
} from '@/application/services/workshop/export/WorkshopTranscriptJson';
import {
  renderWorkshopTranscriptHtml,
  renderWorkshopTranscriptMarkdownHtml,
  safeLinkDestination
} from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { formatWorkshopTranscriptDate } from '@/application/services/workshop/export/WorkshopTranscriptDescription';
import { FIXTURE_EPOCH, fixtureTurn, representativeRoom, writerTurn } from './workshopTranscriptFixtures';

const transcript = (turns = representativeRoom(), title = 'Dock scene') =>
  projectWorkshopTranscript(turns, { title, exportedAt: FIXTURE_EPOCH });

describe('renderWorkshopTranscriptMarkdown', () => {
  it('heads the document with its title and provenance', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript());

    expect(markdown.startsWith('# Dock scene\n\n_Prose Minion Workshop · ')).toBe(true);
    expect(markdown).toContain(formatWorkshopTranscriptDate(FIXTURE_EPOCH));
    expect(markdown).toContain('7 messages · with Jill, Felix, Prose Assistant_');
  });

  it('exports message bodies verbatim under speaker headings', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript());

    expect(markdown).toContain(
      '### Writer\n\n_Attached: chapter-3.md_\n\nDoes the dock scene earn its length?\nBe blunt.'
    );
    expect(markdown).toContain('### Jill\n\n## Verdict\n\nMostly, yes.');
    expect(markdown).toContain('### Writer\n\n_Composed with Gesture Playground · 3 directions_\n\nTry these gestures.');
    expect(markdown).toContain(
      '### Felix\n\n_Response hit the max-token limit and was truncated._\n\nThe hands are doing too much.'
    );
    expect(markdown).toContain('### Writer · private with Prose Assistant\n\nWhy the pacing flag?');
    expect(markdown).toContain('### Prose Assistant · private\n\nThree long sentences in a row.');
  });

  it('renders dividers as italic rules and sources as a numbered list', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript());

    expect(markdown).toContain('---\n\n_Excerpt updated to v2_');
    expect(markdown).toContain('---\n\n### Jill\n\n## Verdict');
    expect(markdown).toContain(
      '**Sources**\n\n1. [Dock history](<https://example.com/docks>)\n2. [example.org](<https://example.org/markets>)'
    );
  });

  it('keeps writer and reply bodies byte for byte, edge whitespace included', () => {
    // Leading indentation is an indented code block; trailing spaces are the
    // writer's own. Neither may be trimmed between the speaker delimiters.
    const writerBody = '    const coin = pocket();\n\nShe said it twice.  \n';
    const replyBody = '  An edge-spaced reply.\n\n    indented block\n  ';
    const markdown = renderWorkshopTranscriptMarkdown(transcript([
      writerTurn('u-1', { content: writerBody }),
      fixtureTurn('a-1', { content: replyBody })
    ]));

    expect(markdown).toContain(`### Writer\n\n${writerBody}\n\n---\n\n### Jill`);
    expect(markdown.endsWith(`### Jill\n\n${replyBody}\n`)).toBe(true);
  });

  it('adds no body for a widget-only writer message', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript([
      writerTurn('u-1', {
        content: '   ',
        widgetCommit: {
          widgetId: 'gesture-playground',
          widgetConfigId: 'wc-1',
          rail: 'thread-artifact',
          artifactId: 'ta-2',
          selectionCount: 1
        }
      })
    ]));

    expect(markdown.endsWith('### Writer\n\n_Composed with Gesture Playground · 1 direction_\n')).toBe(true);
  });

  it('escapes inline syntax in labels so a title cannot restructure the document', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript([], 'Draft_v2 *final* [ok]'));

    expect(markdown.startsWith('# Draft\\_v2 \\*final\\* \\[ok\\]\n')).toBe(true);
  });

  it('never carries context, attachment, widget, or usage details', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript());

    for (const hidden of ['secret-notes.md', 'drafts/chapter-3.md', 'FULL DICTIONARY EVIDENCE BODY', '1000', 'ta-2']) {
      expect(markdown).not.toContain(hidden);
    }
  });
});

describe('renderWorkshopTranscriptJson', () => {
  it('writes a versioned transcript document, not a session', () => {
    const document = JSON.parse(renderWorkshopTranscriptJson(transcript()));

    expect(document).toMatchObject({
      format: WORKSHOP_TRANSCRIPT_JSON_FORMAT,
      formatVersion: WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION,
      title: 'Dock scene',
      exportedAt: '2026-10-05T14:30:00.000Z',
      participants: ['Jill', 'Felix', 'Prose Assistant'],
      messageCount: 7
    });
    expect(document).not.toHaveProperty('schemaVersion');
  });

  it('keeps each entry self-describing for an agent pipeline', () => {
    const document = JSON.parse(renderWorkshopTranscriptJson(transcript()));

    expect(document.entries[0]).toEqual({
      kind: 'event',
      timestamp: '2026-10-05T14:30:00.000Z',
      text: 'Session started · Jill hosting'
    });
    expect(document.entries[1]).toEqual({
      kind: 'writer',
      timestamp: '2026-10-05T14:30:00.000Z',
      content: 'Does the dock scene earn its length?\nBe blunt.',
      attachments: ['chapter-3.md']
    });
    expect(document.entries[2]).toMatchObject({
      kind: 'reply',
      speaker: 'Jill',
      participant: 'host',
      truncated: false,
      sources: [
        { url: 'https://example.com/docks', label: 'Dock history' },
        { url: 'https://example.org/markets', label: 'example.org' }
      ]
    });
    expect(document.entries[2]).not.toHaveProperty('turnId');
  });
});

describe('renderWorkshopTranscriptHtml', () => {
  it('produces a standalone page under the Workshop surface with a locked-down CSP', () => {
    const html = renderWorkshopTranscriptHtml(transcript());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
    );
    expect(html).toContain('<body data-pm-surface="workshop">');
    expect(html).toContain('<title>Dock scene</title>');
    expect(html).not.toMatch(/<script|<link|<img|@import|url\(/i);
  });

  it('uses the thread bubble markup so the mirrored thread styles apply', () => {
    const html = renderWorkshopTranscriptHtml(transcript());

    expect(html).toContain('<article class="pm-ws-turn pm-ws-turn-user" aria-label="Writer">');
    expect(html).toContain('<article class="pm-ws-turn pm-ws-turn-assistant" aria-label="Jill">');
    expect(html).toContain('<div class="markdown-content pm-ws-turn-body"><h2>Verdict</h2>');
    expect(html).toContain('<div class="pm-ws-revision-divider" role="separator"><span>Excerpt updated to v2</span></div>');
    expect(html).toContain('<p class="pm-ws-turn-truncated">');
    expect(html).toContain('<span class="pm-ws-widget-chip-meta">3 directions</span>');
    expect(html).toContain('class="pm-ws-turn pm-ws-turn-user pm-ws-turn-private" aria-label="Writer"');
    expect(html).toContain('Private · you + Prose Assistant');
    expect(html).toContain('href="https://example.com/docks"');
  });

  it('keeps the writer’s words as escaped plain text', () => {
    const html = renderWorkshopTranscriptHtml(transcript([
      writerTurn('u-1', { content: '<b>not bold</b> & **not markdown**' })
    ]));

    expect(html).toContain('&lt;b&gt;not bold&lt;/b&gt; &amp; **not markdown**');
  });

  it('escapes the title everywhere it appears', () => {
    const html = renderWorkshopTranscriptHtml(transcript([], '</title><script>x()</script>'));

    expect(html).not.toContain('<script>');
    expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;x()&lt;/script&gt;</title>');
  });
});

describe('transcript Markdown → HTML (untrusted model output)', () => {
  it.each([
    ['raw block HTML', '<script>alert(1)</script>', '<script'],
    ['inline HTML', 'hello <img src=x onerror=alert(1)> there', '<img'],
    ['an event-handler attribute', '<div onclick="steal()">x</div>', '<div onclick'],
    ['a style block', '<style>body{display:none}</style>', '<style'],
    ['an iframe', '<iframe src="https://evil.example"></iframe>', '<iframe']
  ])('renders %s as visible text, never markup', (_label, input, forbidden) => {
    const html = renderWorkshopTranscriptMarkdownHtml(input);

    expect(html).not.toContain(forbidden);
    expect(html).toContain('&lt;');
  });

  it('never emits an image fetch, keeping only the alt text', () => {
    const html = renderWorkshopTranscriptMarkdownHtml('![tracking pixel](https://evil.example/p.gif)');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('tracking pixel');
  });

  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](java\tscript:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](vbscript:msgbox)',
    '[x](file:///etc/passwd)',
    '[x](relative/path.md)'
  ])('drops an unsafe or relative destination but keeps the label: %s', (input) => {
    const html = renderWorkshopTranscriptMarkdownHtml(input);

    expect(html).not.toContain('<a');
    expect(html).toContain('x');
  });

  it('keeps web, mail, and fragment links with escaped attributes', () => {
    const html = renderWorkshopTranscriptMarkdownHtml(
      '[web](https://example.com/a?b=1&c="2") [mail](mailto:ed@example.com) [here](#notes)'
    );

    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=%222%22" rel="noreferrer noopener">web</a>');
    expect(html).toContain('<a href="mailto:ed@example.com" rel="noreferrer noopener">mail</a>');
    expect(html).toContain('<a href="#notes" rel="noreferrer noopener">here</a>');
  });

  it('renders ordinary Markdown with the thread’s gfm + line-break settings', () => {
    const html = renderWorkshopTranscriptMarkdownHtml('line one\nline two\n\n| a | b |\n|---|---|\n| 1 | 2 |');

    expect(html).toContain('line one<br>line two');
    expect(html).toContain('<table>');
  });

  it('escapes code spans and blocks', () => {
    const html = renderWorkshopTranscriptMarkdownHtml('`<b>` and\n\n```\n<script>\n```');

    expect(html).toContain('<code>&lt;b&gt;</code>');
    expect(html).not.toContain('<script>');
  });

  it('normalizes safe link destinations and rejects the rest', () => {
    expect(safeLinkDestination(' https://example.com ')).toBe('https://example.com/');
    expect(safeLinkDestination('#frag')).toBe('#frag');
    expect(safeLinkDestination('# not a fragment')).toBeUndefined();
    expect(safeLinkDestination('javascript:void(0)')).toBeUndefined();
  });

  it('does not let one reply’s HTML leak into a sibling bubble', () => {
    const html = renderWorkshopTranscriptHtml(transcript([
      fixtureTurn('a-1', { content: '</div></article><script>x()</script>' })
    ]));

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;/div&gt;&lt;/article&gt;');
    expect(html.match(/<\/article>/g)).toHaveLength(1);
  });
});
