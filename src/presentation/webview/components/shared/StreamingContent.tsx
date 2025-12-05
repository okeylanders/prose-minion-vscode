/**
 * StreamingContent Component
 *
 * Displays progressive AI response content during streaming.
 * Shows buffering indicator during initial 5-second buffer phase,
 * then renders markdown content with smooth debounced updates.
 */

import * as React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface StreamingContentProps {
  /** Content to display (debounced from streaming hook) */
  content: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Whether in the initial buffer phase */
  isBuffering: boolean;
  /** Count of tokens received */
  tokenCount: number;
  /** Optional cancel callback */
  onCancel?: () => void;
  /** Disable cancel button (e.g., no requestId yet) */
  cancelDisabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const StreamingContent: React.FC<StreamingContentProps> = ({
  content,
  isStreaming,
  isBuffering,
  tokenCount,
  onCancel,
  cancelDisabled,
  className = ''
}) => {
  // During buffer phase, show loading indicator
  if (isBuffering && isStreaming) {
    return (
      <div className={`streaming-buffer ${className}`}>
        <div className="streaming-buffer-content">
          <div className="spinner" />
          <span className="streaming-status">
            Streaming... ({tokenCount} tokens)
          </span>
          {onCancel && (
            <button onClick={onCancel} className="cancel-button" title="Cancel" disabled={cancelDisabled}>
              ✕
            </button>
          )}
        </div>
        <p className="streaming-hint">
          Buffering response for smoother display...
        </p>
      </div>
    );
  }

  // After buffer phase, render progressive markdown
  return (
    <div className={`streaming-content ${className}`}>
      {isStreaming && (
        <div className="streaming-header">
          <span className="streaming-indicator">
            <span className="streaming-dot" />
            Streaming ({tokenCount} tokens)
          </span>
          {onCancel && (
            <button onClick={onCancel} className="cancel-button" title="Cancel" disabled={cancelDisabled}>
              ✕
            </button>
          )}
        </div>
      )}
      <MarkdownRenderer content={content} />
    </div>
  );
};
