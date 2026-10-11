/**
 * MarkdownRenderer component - Presentation layer
 * Renders markdown content with syntax highlighting
 */

import * as React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Token, Tokens, TokensList } from 'marked';
import type { CHROMATIC_PALETTE_FENCE_LANGUAGE } from '@shared/constants/chromaticPalettes';

/**
 * Fence languages a caller may register through `fencedBlocks`. Closed on
 * purpose, like the Workshop's widget registries: widen it only by adding a
 * real, validated renderer's language (and, per the Chromatic Palettes spec,
 * an ADR once a second renderer exists).
 */
export type MarkdownFencedBlockLanguage = typeof CHROMATIC_PALETTE_FENCE_LANGUAGE;

export interface MarkdownFencedBlockRenderer {
  /** Return null to fall back to the ordinary sanitized code-block rendering. */
  render(source: string): React.ReactElement | null;
}

export type MarkdownFencedBlocks = Readonly<Partial<Record<MarkdownFencedBlockLanguage, MarkdownFencedBlockRenderer>>>;

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /**
   * Opt-in React renderers for TOP-LEVEL fenced code blocks, keyed by fence
   * language. When absent, or when no registered fence renders, output is the
   * unchanged single-pass sanitized HTML. It is a memo dependency, so pass a
   * stable (module-level) object rather than an inline literal.
   */
  fencedBlocks?: MarkdownFencedBlocks;
}

/**
 * Model output and workspace-derived evidence are untrusted HTML inputs.
 * Images are deliberately forbidden: even a harmless-looking Markdown image
 * can become an automatic network beacon carrying prompt-injected data.
 */
export const sanitizeMarkdownHtml = (html: string): string => DOMPurify.sanitize(html, {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['base', 'embed', 'form', 'iframe', 'img', 'input', 'link', 'meta', 'object', 'script', 'style'],
  FORBID_ATTR: ['style']
});

type MarkdownSegment =
  | { kind: 'markdown'; key: string; html: string }
  | { kind: 'fenced-block'; key: string; element: React.ReactElement };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  fencedBlocks
}) => {
  const fencedSegments = React.useMemo(
    () => (fencedBlocks ? renderFencedSegments(content, fencedBlocks) : null),
    [content, fencedBlocks]
  );

  const htmlContent = React.useMemo(() => {
    if (fencedSegments) {
      return '';
    }
    try {
      // Configure marked options
      marked.setOptions({
        breaks: true,
        gfm: true,
      });

      const rendered = marked(content);
      if (typeof rendered !== 'string') {
        throw new Error('Asynchronous Markdown rendering is not supported in the webview.');
      }
      return sanitizeMarkdownHtml(rendered);
    } catch (error) {
      console.error('Error parsing markdown:', error);
      // Never fall back to raw dangerouslySetInnerHTML input. If Markdown
      // parsing fails, preserve safe text while applying the same sanitizer.
      return sanitizeMarkdownHtml(content);
    }
  }, [content, fencedSegments]);

  if (fencedSegments) {
    // One `.markdown-content` root keeps every descendant rule applying; the
    // run wrappers are `display: contents` so they add no layout of their own.
    return (
      <div className={`markdown-content ${className}`}>
        {fencedSegments.map(segment => (
          segment.kind === 'markdown'
            ? <div key={segment.key} className="markdown-content-run" dangerouslySetInnerHTML={{ __html: segment.html }} />
            : <React.Fragment key={segment.key}>{segment.element}</React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

/**
 * Lexes once, then splits the TOP-LEVEL tokens into sanitized Markdown runs
 * and registered fenced-block components. Fences nested in lists or
 * blockquotes are deliberately left to the ordinary code-block rendering.
 *
 * Returns null — meaning "take the single-pass path" — when no registered
 * fence rendered, or when anything here throws.
 */
const renderFencedSegments = (
  content: string,
  fencedBlocks: MarkdownFencedBlocks
): MarkdownSegment[] | null => {
  try {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    const tokens = marked.lexer(content);
    const pieces: Array<Token[] | React.ReactElement> = [];
    let renderedFencedBlock = false;

    for (const token of tokens) {
      const element = renderFencedBlock(token, fencedBlocks);
      const previous = pieces[pieces.length - 1];
      if (element) {
        pieces.push(element);
        renderedFencedBlock = true;
      } else if (Array.isArray(previous)) {
        previous.push(token);
      } else {
        pieces.push([token]);
      }
    }

    // Mid-stream, most updates have no renderable fence yet: bail out before
    // parsing or sanitizing any run, so the caller's single pass is the only one.
    if (!renderedFencedBlock) {
      return null;
    }

    const segments: MarkdownSegment[] = [];
    for (const piece of pieces) {
      if (!Array.isArray(piece)) {
        segments.push({ kind: 'fenced-block', key: `fenced-block-${segments.length}`, element: piece });
        continue;
      }
      // Each run is parsed on its own, so it carries the document's reference
      // definitions with it.
      const run: TokensList = Object.assign(piece, { links: tokens.links });
      const html = sanitizeMarkdownHtml(marked.parser(run));
      if (html.trim().length > 0) {
        segments.push({ kind: 'markdown', key: `markdown-${segments.length}`, html });
      }
    }
    return segments;
  } catch (error) {
    console.error('Error rendering fenced Markdown blocks:', error);
    return null;
  }
};

const renderFencedBlock = (
  token: Token,
  fencedBlocks: MarkdownFencedBlocks
): React.ReactElement | null => {
  if (token.type !== 'code') {
    return null;
  }
  const code = token as Tokens.Code;
  if (code.codeBlockStyle === 'indented') {
    return null;
  }
  // Same reading of the info string as marked's own renderer: the first word.
  const language = (code.lang ?? '').trim().split(/\s+/)[0];
  if (!isRegisteredFenceLanguage(fencedBlocks, language)) {
    return null;
  }
  return fencedBlocks[language]?.render(code.text) ?? null;
};

/** Own keys only: a ```constructor fence must not reach Object.prototype. */
const isRegisteredFenceLanguage = (
  fencedBlocks: MarkdownFencedBlocks,
  language: string
): language is MarkdownFencedBlockLanguage =>
  Object.prototype.hasOwnProperty.call(fencedBlocks, language);
