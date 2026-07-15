/**
 * MarkdownRenderer component - Presentation layer
 * Renders markdown content with syntax highlighting
 */

import * as React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = ''
}) => {
  const htmlContent = React.useMemo(() => {
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
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
