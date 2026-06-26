/**
 * @jest-environment jsdom
 */

/**
 * useStreaming Behavioral Tests
 *
 * Validates buffer accumulation and the critical difference between
 * reset() (wipes content) vs endStreaming() (preserves content).
 */

import { renderHook, act } from '@testing-library/react';
import { useStreaming } from '@hooks/useStreaming';

describe('useStreaming', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buffer accumulation', () => {
    it('should accumulate chunks in buffer', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => result.current.appendToken('Hello'));
      act(() => result.current.appendToken(' world'));

      expect(result.current.buffer).toBe('Hello world');
      expect(result.current.chunkCount).toBe(2);
    });
  });

  describe('streaming stats', () => {
    it('should start elapsed timing immediately', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      expect(result.current.elapsedMs).toBe(0);

      act(() => jest.advanceTimersByTime(250));
      expect(result.current.elapsedMs).toBe(250);
    });

    it('should capture initial latency from the first chunk exactly once', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => jest.advanceTimersByTime(1200));
      act(() => result.current.appendToken('first'));

      expect(result.current.initialLatencyMs).toBe(1200);

      act(() => jest.advanceTimersByTime(800));
      act(() => result.current.appendToken('second'));

      expect(result.current.initialLatencyMs).toBe(1200);
      expect(result.current.chunkCount).toBe(2);
    });

    it('should derive average chunks per second', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => jest.advanceTimersByTime(1000));
      act(() => {
        result.current.appendToken('a');
        result.current.appendToken('b');
      });

      expect(result.current.chunksPerSecond).toBe(2);
    });

    it('should stop timing when the stream ends', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => jest.advanceTimersByTime(1000));
      act(() => result.current.endStreaming());

      expect(result.current.elapsedMs).toBe(1000);

      act(() => jest.advanceTimersByTime(1000));
      expect(result.current.elapsedMs).toBe(1000);
    });

    it('should reset all streaming metrics', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => jest.advanceTimersByTime(750));
      act(() => result.current.appendToken('chunk'));
      act(() => result.current.reset());

      expect(result.current.chunkCount).toBe(0);
      expect(result.current.elapsedMs).toBe(0);
      expect(result.current.initialLatencyMs).toBeUndefined();
      expect(result.current.chunksPerSecond).toBe(0);
    });
  });

  describe('endStreaming - preserves content', () => {
    it('should flush buffer to displayContent', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => result.current.appendToken('partial content'));
      act(() => result.current.endStreaming());

      expect(result.current.buffer).toBe('partial content');
      expect(result.current.displayContent).toBe('partial content');
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('reset - wipes content', () => {
    it('should clear both buffer and displayContent', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => result.current.appendToken('partial content'));
      act(() => result.current.reset());

      expect(result.current.buffer).toBe('');
      expect(result.current.displayContent).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.chunkCount).toBe(0);
    });
  });
});
