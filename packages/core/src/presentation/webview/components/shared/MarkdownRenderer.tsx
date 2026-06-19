/**
 * MarkdownRenderer component - Presentation layer
 * Renders markdown content with syntax highlighting
 */

import * as React from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

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

      return marked(content);
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
