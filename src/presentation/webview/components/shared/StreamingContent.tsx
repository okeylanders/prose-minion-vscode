/**
 * StreamingContent Component
 *
 * Displays progressive AI response content during streaming.
 * Shows buffering indicator during initial 5-second buffer phase,
 * then renders markdown content with smooth debounced updates.
 */

import * as React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingIndicator } from './LoadingIndicator';

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
  /** Optional status message while waiting for first token */
  waitingMessage?: string;
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
  waitingMessage = 'Waiting for first tokens…',
  className = ''
}) => {
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

      {tokenCount === 0 ? (
        <div className="streaming-waiting">
          <LoadingIndicator
            isLoading={true}
            statusMessage={waitingMessage}
            defaultMessage={waitingMessage}
            className="streaming-waiting-indicator"
          />
        </div>
      ) : (
        <MarkdownRenderer content={content} />
      )}
    </div>
  );
};
