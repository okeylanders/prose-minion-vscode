/**
 * useStreaming Hook
 *
 * Manages streaming state for progressive AI response display.
 * Implements 5-second initial buffer + 100ms debounce pattern for smooth UX.
 *
 * Strategy:
 * - Wait 5 seconds before first render (let buffer accumulate)
 * - After buffer period, debounce updates at 100ms for smooth rendering
 * - Track token count for user feedback during streaming
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const INITIAL_BUFFER_MS = 5000;
const DEBOUNCE_MS = 100;

export interface StreamingState {
  /** Full accumulated buffer (all tokens received) */
  buffer: string;
  /** Content to display (debounced after initial buffer) */
  displayContent: string;
  /** Whether we're still in the initial 5-second buffer phase */
  isBuffering: boolean;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Count of tokens received */
  tokenCount: number;
}

export interface StreamingActions {
  /** Append a new token to the stream */
  appendToken: (token: string) => void;
  /** Start a new streaming session */
  startStreaming: () => void;
  /** End the current streaming session */
  endStreaming: () => void;
  /** Reset all streaming state */
  reset: () => void;
}

export type UseStreamingReturn = StreamingState & StreamingActions;

export function useStreaming(): UseStreamingReturn {
  const [buffer, setBuffer] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [isBuffering, setIsBuffering] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timers
  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
  }, []);

  // Start a new streaming session
  const startStreaming = useCallback(() => {
    clearTimers();
    setBuffer('');
    setDisplayContent('');
    setIsBuffering(true);
    setIsStreaming(true);
    setTokenCount(0);
    startTimeRef.current = Date.now();

    // Set timer to end buffer phase after INITIAL_BUFFER_MS
    bufferTimerRef.current = setTimeout(() => {
      setIsBuffering(false);
    }, INITIAL_BUFFER_MS);
  }, [clearTimers]);

  // Append a token to the buffer
  const appendToken = useCallback((token: string) => {
    setBuffer(prev => prev + token);
    setTokenCount(prev => prev + 1);
  }, []);

  // Update display content when buffer changes (debounced after initial buffer)
  useEffect(() => {
    if (!isStreaming) return;

    // Still in initial buffer phase - don't update display yet
    if (isBuffering) {
      return;
    }

    // Past buffer phase - debounce updates
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDisplayContent(buffer);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [buffer, isBuffering, isStreaming]);

  // End the streaming session
  const endStreaming = useCallback(() => {
    clearTimers();
    setIsStreaming(false);
    setIsBuffering(false);
    // Final update - show full buffer immediately
    setDisplayContent(buffer);
  }, [buffer, clearTimers]);

  // Reset all state
  const reset = useCallback(() => {
    clearTimers();
    setBuffer('');
    setDisplayContent('');
    setIsBuffering(true);
    setIsStreaming(false);
    setTokenCount(0);
    startTimeRef.current = null;
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    // State
    buffer,
    displayContent,
    isBuffering,
    isStreaming,
    tokenCount,
    // Actions
    appendToken,
    startStreaming,
    endStreaming,
    reset
  };
}
