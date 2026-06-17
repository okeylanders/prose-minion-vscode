/**
 * @jest-environment jsdom
 */

/**
 * useStreaming Behavioral Tests
 *
 * Validates buffer accumulation and the critical difference between
 * reset() (wipes content) vs endStreaming() (preserves content).
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useStreaming } from '@hooks/useStreaming';

describe('useStreaming', () => {
  describe('buffer accumulation', () => {
    it('should accumulate tokens in buffer', () => {
      const { result } = renderHook(() => useStreaming());

      act(() => result.current.startStreaming());
      act(() => result.current.appendToken('Hello'));
      act(() => result.current.appendToken(' world'));

      expect(result.current.buffer).toBe('Hello world');
      expect(result.current.tokenCount).toBe(2);
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
      expect(result.current.tokenCount).toBe(0);
    });
  });
});
