/**
 * The styled-HTML transcript's stylesheet: the Workshop thread's own rules,
 * so a shared transcript looks like the room it came from.
 *
 * Three layers, in cascade order:
 *
 * 1. PREFLIGHT — the subset of Tailwind's preflight reset the webview runs
 *    under that touches transcript markup (margins, heading sizes, list
 *    resets, box sizing). Without it the mirrored rules would sit on browser
 *    defaults and drift from the thread.
 * 2. MIRRORED — rules copied VERBATIM from the thread stylesheets, in the
 *    webview's import order. `workshopTranscriptHtmlStyles.test.ts` pins every
 *    rule here to its source rule, so restyling the thread fails that test
 *    until this copy is updated to match. Regenerate rather than hand-edit.
 * 3. PAGE — export-only rules: a document instead of a scrolling pane, a
 *    title header, and print behavior. Two deliberate departures from the
 *    thread live here too: the webview's preflight strips list markers and
 *    link styling inside replies. A static document has no other way to show
 *    that "1." begins a numbered step or that a phrase is a link, so the
 *    export restores both without changing layout.
 *
 * The page renders under `data-pm-surface="workshop"` on <body>, so the
 * mirrored selectors apply unchanged and the Workshop's pinned warm-dark
 * tokens resolve as they do in the editor.
 */

export interface WorkshopTranscriptMirroredStyles {
  /** Source stylesheet, relative to packages/core/src/presentation/webview/. */
  source: string;
  css: string;
}

export const WORKSHOP_TRANSCRIPT_PREFLIGHT_CSS = `
*,
::before,
::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: #e5e7eb;
}
html {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}
body {
  margin: 0;
  line-height: inherit;
}
hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}
a {
  color: inherit;
  text-decoration: inherit;
}
b,
strong {
  font-weight: bolder;
}
code,
kbd,
samp,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 1em;
}
table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}
blockquote,
dl,
dd,
h1,
h2,
h3,
h4,
h5,
h6,
hr,
figure,
p,
pre {
  margin: 0;
}
ol,
ul,
menu {
  list-style: none;
  margin: 0;
  padding: 0;
}
svg {
  display: block;
  vertical-align: middle;
}
`;

export const WORKSHOP_TRANSCRIPT_MIRRORED_STYLES: readonly WorkshopTranscriptMirroredStyles[] = [
  {
    source: 'index.css',
    css: `
:root {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
.markdown-content {
  font-family: var(--pm-mono);
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--pm-text-2);
}
.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 {
  color: var(--pm-text);
  margin-top: 16px;
  margin-bottom: 6px;
  font-weight: 700;
  line-height: 1.3;
}
.markdown-content h1 {
  font-size: 16px;
  border-bottom: 1px solid var(--pm-border-soft);
  padding-bottom: var(--spacing-sm);
}
.markdown-content h2 {
  font-size: 15px;
  border-bottom: 1px solid var(--pm-border-soft);
  padding-bottom: var(--spacing-xs);
}
.markdown-content h3 {
  font-size: 14px;
}
.markdown-content h4 {
  font-size: 13.5px;
  border-bottom: 1px solid var(--pm-border-soft);
  padding-bottom: 8px;
}
.markdown-content p {
  margin-bottom: 8px;
}
.markdown-content ul,
.markdown-content ol {
  margin-left: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}
.markdown-content li {
  margin-bottom: var(--spacing-xs);
}
.markdown-content code {
  background-color: var(--pm-surface-2);
  color: var(--pm-accent-hi);
  padding: 2px 6px;
  border-radius: 5px;
  font-family: var(--pm-mono);
  font-size: 0.9em;
}
.markdown-content pre {
  background-color: var(--pm-surface-2);
  padding: var(--spacing-md);
  border-radius: var(--pm-r-input);
  border: 1px solid var(--pm-border-soft);
  overflow-x: auto;
  margin-bottom: var(--spacing-md);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.markdown-content pre code {
  background-color: transparent;
  padding: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.markdown-content blockquote {
  border-left: 2px solid var(--pm-accent);
  padding-left: var(--spacing-md);
  margin-left: 0;
  color: var(--pm-muted);
  font-style: italic;
}
.markdown-content strong {
  font-weight: 700;
  color: var(--pm-text);
}
.markdown-content em {
  font-style: italic;
  color: var(--pm-muted);
}
.markdown-content hr {
  border: none;
  border-top: 1px solid var(--pm-border-soft);
  margin: var(--spacing-lg) 0;
}
.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
  font-family: var(--pm-mono);
  font-size: 12.5px;
}
.markdown-content th,
.markdown-content td {
  border: 1px solid var(--pm-border-soft);
  padding: 9px 11px;
  color: var(--pm-text-2);
}
.markdown-content thead th {
  background-color: var(--pm-surface-2);
  color: var(--pm-text);
  font-weight: 700;
  text-align: left;
  border-color: var(--pm-border);
}
.markdown-content tbody tr:nth-child(even) td {
  background: rgba(127, 127, 127, 0.04);
}
`
  },
  {
    source: 'styles/workshop/tokens.css',
    css: `
[data-pm-surface="workshop"] {
  --pm-bg:          #15110d;
  --pm-bg-grad-top: #211910;
  --pm-surface:     #221a13;
  --pm-surface-2:   #2b2017;
  --pm-surface-3:   #36281b;
  --pm-inset:       #1b150f;
  --pm-border:      #3a2c1f;
  --pm-border-2:    #4d3a28;
  --pm-border-soft: #2e231a;
  --pm-text:        #f3ece1;
  --pm-text-2:      #c9bbab;
  --pm-muted:       #a4937f;
  --pm-dim:         #7a6c5b;
  --pm-faint:       #5c5044;
  --pm-accent:      #e0673a;
  --pm-accent-hi:   #ee7d49;
  --pm-accent-lo:   #c8552c;
  --pm-accent-soft: rgba(224, 103, 58, 0.14);
  --pm-accent-line: linear-gradient(90deg, #e8763f 0%, #d2592f 48%, rgba(210, 89, 47, 0) 100%);
  --pm-blue:   #5aa2f0;
  --pm-green:  #6fc98a;
  --pm-pink:   #e0589e;
  --pm-amber:  #e2b24a;
  --pm-red:    #ef7d66;
  --pm-identity-0:  #ee7d49;
  --pm-identity-1:  #5aa2f0;
  --pm-identity-2:  #6fc98a;
  --pm-identity-3:  #e0589e;
  --pm-identity-4:  #e2b24a;
  --pm-identity-5:  #a78bfa;
  --pm-identity-6:  #4fc3c8;
  --pm-identity-7:  #f08aa6;
  --pm-identity-8:  #a8c95f;
  --pm-identity-9:  #7db7e8;
  --pm-identity-10: #d99a62;
  --pm-identity-11: #c69cf4;
  --pm-r-card: 12px;
  --pm-r-tile: 9px;
  --pm-r-input: 8px;
  --pm-r-button: 8px;
  --pm-r-pill: 999px;
  --pm-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --pm-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, system-ui, sans-serif;
}
`
  },
  {
    source: 'styles/workshop/shell.css',
    css: `
[data-pm-surface="workshop"] .pm-ws {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--pm-sans);
  color: var(--pm-text);
  background: var(--pm-bg);
  background-image: linear-gradient(180deg, var(--pm-bg-grad-top) 0%, var(--pm-bg) 220px);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
[data-pm-surface="workshop"] .pm-ws-eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--pm-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pm-dim);
  margin: 0;
}
[data-pm-surface="workshop"] .pm-ws-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
[data-pm-surface="workshop"] .pm-ws-revision-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--pm-dim);
  font: 10px var(--pm-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-pm-surface="workshop"] .pm-ws-revision-divider::before,
[data-pm-surface="workshop"] .pm-ws-revision-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--pm-border-soft);
}
[data-pm-surface="workshop"] .pm-ws-turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-pm-surface="workshop"] .pm-ws-turn-user {
  align-items: flex-end;
}
[data-pm-surface="workshop"] .pm-ws-turn-assistant {
  background: var(--pm-surface);
  border: 1px solid var(--pm-border-soft);
  border-radius: var(--pm-r-card);
  padding: 14px 16px;
  max-width: 860px;
}
[data-pm-surface="workshop"] .pm-ws-turn-private.pm-ws-turn-assistant {
  border-color: color-mix(in srgb, var(--pm-accent-lo) 52%, var(--pm-border-soft));
  background: color-mix(in srgb, var(--pm-accent-soft) 24%, var(--pm-surface));
}
[data-pm-surface="workshop"] .pm-ws-turn-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
[data-pm-surface="workshop"] .pm-ws-private-thread-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--pm-accent-hi);
  font-family: var(--pm-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
}
[data-pm-surface="workshop"] .pm-ws-turn-truncated {
  font-size: 11.5px;
  color: var(--pm-amber);
  margin: 2px 0 0;
}
[data-pm-surface="workshop"] .pm-ws-turn-body {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--pm-text-2);
}
[data-pm-surface="workshop"] .pm-ws-turn-body h1,
[data-pm-surface="workshop"] .pm-ws-turn-body h2,
[data-pm-surface="workshop"] .pm-ws-turn-body h3 {
  color: var(--pm-text);
  margin: 14px 0 6px;
  line-height: 1.3;
}
[data-pm-surface="workshop"] .pm-ws-turn-body p {
  margin: 8px 0;
}
[data-pm-surface="workshop"] .pm-ws-turn-body code {
  font-family: var(--pm-mono);
  font-size: 12px;
  background: var(--pm-inset);
  border: 1px solid var(--pm-border-soft);
  border-radius: 4px;
  padding: 1px 5px;
}
[data-pm-surface="workshop"] .pm-ws-turn-message {
  max-width: 640px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--pm-text);
  background: var(--pm-surface-3);
  border: 1px solid var(--pm-border-2);
  border-radius: var(--pm-r-card);
  padding: 10px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
[data-pm-surface="workshop"] .pm-ws-turn-private .pm-ws-turn-message {
  border-color: color-mix(in srgb, var(--pm-accent-lo) 52%, var(--pm-border-2));
  background: color-mix(in srgb, var(--pm-accent-soft) 28%, var(--pm-surface-3));
}
[data-pm-surface="workshop"] .pm-ws-turn-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
[data-pm-surface="workshop"] .pm-ws-turn-attachment {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pm-surface-3) 70%, transparent);
  border: 1px solid var(--pm-border);
  font-size: 10.5px;
  color: var(--pm-muted);
}
[data-pm-surface="workshop"] .pm-ws-ctx-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--pm-border-2);
  background: var(--pm-surface-2);
  border-radius: var(--pm-r-pill);
  padding: 4px 6px 4px 9px;
  font-size: 11.5px;
  color: var(--pm-text-2);
  max-width: 100%;
}
[data-pm-surface="workshop"] .pm-ws-ctx-pill-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
`
  },
  {
    source: 'styles/workshop/session.css',
    css: `
[data-pm-surface="workshop"] .pm-ws-turn-citations {
  margin: 14px 0 2px;
}
[data-pm-surface="workshop"] .pm-ws-turn-citation-pills {
  display: grid;
  justify-items: start;
  gap: 6px;
  margin: 6px 0 0;
}
[data-pm-surface="workshop"] .pm-ws-turn-citation-pill {
  cursor: pointer;
  text-decoration: none;
}
[data-pm-surface="workshop"] .pm-ws-turn-citation-number {
  font-family: var(--pm-mono);
  font-size: 10px;
  color: var(--pm-muted);
  white-space: nowrap;
}
[data-pm-surface="workshop"] .pm-ws-turn-citation-pill:hover {
  color: var(--pm-text);
  border-color: var(--pm-accent-hi);
  background: color-mix(in srgb, var(--pm-accent-hi) 10%, var(--pm-surface-2));
}
[data-pm-surface="workshop"] .pm-ws-turn-citation-pill:focus-visible {
  outline: 2px solid var(--pm-accent-hi);
  outline-offset: 2px;
}
`
  },
  {
    source: 'components/workshop/standingDirectiveRail.css',
    css: `
[data-pm-surface="workshop"] .pm-ws-widget-chipwrap {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
[data-pm-surface="workshop"] .pm-ws-widget-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid rgba(224, 103, 58, 0.45);
  background: linear-gradient(180deg, rgba(224, 103, 58, 0.16), rgba(224, 103, 58, 0.06));
  color: var(--pm-text-2);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--pm-sans);
}
[data-pm-surface="workshop"] .pm-ws-widget-chip svg {
  color: var(--pm-accent-hi);
}
[data-pm-surface="workshop"] .pm-ws-widget-chip-meta {
  font-family: var(--pm-mono);
  font-size: 9.5px;
  color: var(--pm-dim);
  border-left: 1px solid var(--pm-border);
  padding-left: 8px;
}
`
  }
];

export const WORKSHOP_TRANSCRIPT_PAGE_CSS = `
body {
  font-size: 13px;
  background: #15110d;
}
[data-pm-surface="workshop"] .pm-ws.pm-ws-export {
  height: auto;
  min-height: 100vh;
}
[data-pm-surface="workshop"] .pm-ws-export-header,
[data-pm-surface="workshop"] .pm-ws-export-footer,
[data-pm-surface="workshop"] .pm-ws-export .pm-ws-thread {
  width: 100%;
  max-width: 924px;
  margin: 0 auto;
}
[data-pm-surface="workshop"] .pm-ws-export-header {
  padding: 40px 32px 0;
}
[data-pm-surface="workshop"] .pm-ws-export-header::after {
  content: '';
  display: block;
  height: 2px;
  margin-top: 18px;
  border-radius: 2px;
  background: var(--pm-accent-line);
}
[data-pm-surface="workshop"] .pm-ws-export-title {
  margin: 8px 0 6px;
  color: var(--pm-text);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
[data-pm-surface="workshop"] .pm-ws-export-meta {
  margin: 0;
  color: var(--pm-muted);
  font-size: 12px;
}
[data-pm-surface="workshop"] .pm-ws-export .pm-ws-thread {
  flex: none;
  overflow: visible;
}
[data-pm-surface="workshop"] .pm-ws-export-footer {
  padding: 4px 32px 40px;
  color: var(--pm-faint);
  font: 10px var(--pm-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
[data-pm-surface="workshop"] .pm-ws-export .markdown-content ul {
  list-style: disc;
}
[data-pm-surface="workshop"] .pm-ws-export .markdown-content ol {
  list-style: decimal;
}
[data-pm-surface="workshop"] .pm-ws-export .markdown-content a {
  color: var(--pm-accent-hi);
  text-decoration: underline;
  text-underline-offset: 2px;
}
[data-pm-surface="workshop"] .pm-ws-export .pm-ws-widget-chip {
  cursor: default;
}
@media (max-width: 640px) {
  [data-pm-surface="workshop"] .pm-ws-export-header {
    padding: 28px 16px 0;
  }
  [data-pm-surface="workshop"] .pm-ws-export .pm-ws-thread {
    padding: 22px 16px;
  }
  [data-pm-surface="workshop"] .pm-ws-export-footer {
    padding: 4px 16px 28px;
  }
}
@media print {
  html,
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  [data-pm-surface="workshop"] .pm-ws-turn-user,
  [data-pm-surface="workshop"] .pm-ws-revision-divider {
    break-inside: avoid;
  }
  [data-pm-surface="workshop"] .pm-ws-turn-head {
    break-after: avoid;
  }
}
`;

/** The complete stylesheet, in cascade order. */
export const WORKSHOP_TRANSCRIPT_HTML_CSS = [
  WORKSHOP_TRANSCRIPT_PREFLIGHT_CSS,
  ...WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.map(({ css }) => css),
  WORKSHOP_TRANSCRIPT_PAGE_CSS
].map((layer) => layer.trim()).join('\n');
