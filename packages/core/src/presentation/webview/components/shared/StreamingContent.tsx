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
import { formatStreamingStats } from '@formatters';

interface StreamingContentProps {
  /** Content to display (debounced from streaming hook) */
  content: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Whether in the initial buffer phase */
  isBuffering: boolean;
  /** Count of stream chunks received */
  chunkCount: number;
  /** Elapsed streaming time since request start */
  elapsedMs: number;
  /** Client-observed latency from stream start to the first chunk */
  initialLatencyMs?: number;
  /** Average chunks per second */
  chunksPerSecond: number;
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
  chunkCount,
  elapsedMs,
  initialLatencyMs,
  chunksPerSecond,
  onCancel,
  cancelDisabled,
  waitingMessage = 'Waiting for first chunks...',
  className = ''
}) => {
  const stats = formatStreamingStats({
    chunkCount,
    elapsedMs,
    initialLatencyMs,
    chunksPerSecond
  });

  return (
    <div className={`streaming-content ${className}`}>
      {isStreaming && (
        <div className="streaming-header">
          <span className="streaming-indicator">
            <span className="streaming-dot" />
            <span className="streaming-status-text">Streaming</span>
            {stats.map(stat => (
              <React.Fragment key={stat.key}>
                <span className={`streaming-stat-separator streaming-stat-separator-${stat.key}`}>·</span>
                <span className={`streaming-stat streaming-stat-${stat.key}`}>
                  {stat.label}
                </span>
              </React.Fragment>
            ))}
          </span>
          {onCancel && (
            <button onClick={onCancel} className="cancel-button" title="Cancel" disabled={cancelDisabled}>
              ✕
            </button>
          )}
        </div>
      )}

      {chunkCount === 0 ? (
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
