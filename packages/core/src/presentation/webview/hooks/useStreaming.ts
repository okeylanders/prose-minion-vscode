/**
 * useStreaming Hook
 *
 * Manages streaming state for progressive AI response display.
 * Implements 5-second initial buffer + 100ms debounce pattern for smooth UX.
 *
 * Strategy:
 * - Wait 5 seconds before first render (let buffer accumulate)
 * - After buffer period, debounce updates at 100ms for smooth rendering
 * - Track live chunk count and timing stats for user feedback during streaming
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const INITIAL_BUFFER_MS = 5000;
const DEBOUNCE_MS = 100;
const ELAPSED_UPDATE_MS = 250;

export interface StreamingState {
  /** Full accumulated buffer (all chunks received) */
  buffer: string;
  /** Content to display (debounced after initial buffer) */
  displayContent: string;
  /** Whether we're still in the initial 5-second buffer phase */
  isBuffering: boolean;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Count of stream chunks received */
  chunkCount: number;
  /** Elapsed streaming time since startStreaming() */
  elapsedMs: number;
  /** Client-observed latency from stream start to the first chunk */
  initialLatencyMs?: number;
  /** Average chunks per second over elapsed streaming time */
  chunksPerSecond: number;
}

export interface StreamingActions {
  /** Append a new stream chunk to the buffer */
  appendToken: (chunk: string) => void;
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
  const [chunkCount, setChunkCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [initialLatencyMs, setInitialLatencyMs] = useState<number | undefined>(undefined);

  const startedAtRef = useRef<number | null>(null);
  const initialLatencyCapturedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksPerSecond = elapsedMs > 0 ? chunkCount / (elapsedMs / 1000) : 0;

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
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  // Start a new streaming session
  const startStreaming = useCallback(() => {
    clearTimers();
    setBuffer('');
    setDisplayContent('');
    setIsBuffering(true);
    setIsStreaming(true);
    setChunkCount(0);
    setElapsedMs(0);
    setInitialLatencyMs(undefined);
    initialLatencyCapturedRef.current = false;
    startedAtRef.current = Date.now();

    // Set timer to end buffer phase after INITIAL_BUFFER_MS
    bufferTimerRef.current = setTimeout(() => {
      setIsBuffering(false);
    }, INITIAL_BUFFER_MS);

    elapsedTimerRef.current = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, ELAPSED_UPDATE_MS);
  }, [clearTimers]);

  // Append a stream chunk to the buffer
  const appendToken = useCallback((chunk: string) => {
    if (!initialLatencyCapturedRef.current && startedAtRef.current !== null) {
      setInitialLatencyMs(Date.now() - startedAtRef.current);
      initialLatencyCapturedRef.current = true;
    }

    setBuffer(prev => prev + chunk);
    setChunkCount(prev => prev + 1);
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
    if (startedAtRef.current !== null) {
      setElapsedMs(Date.now() - startedAtRef.current);
    }
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
    setChunkCount(0);
    setElapsedMs(0);
    setInitialLatencyMs(undefined);
    initialLatencyCapturedRef.current = false;
    startedAtRef.current = null;
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
    chunkCount,
    elapsedMs,
    initialLatencyMs,
    chunksPerSecond,
    // Actions
    appendToken,
    startStreaming,
    endStreaming,
    reset
  };
}
