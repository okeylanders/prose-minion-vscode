import {
  formatChunksPerSecond,
  formatDuration,
  formatInitialLatency,
  formatStreamingStats
} from '@formatters/streamingStatsFormatter';

describe('streamingStatsFormatter', () => {
  describe('formatDuration', () => {
    it('formats short durations with one decimal', () => {
      expect(formatDuration(8400)).toBe('8.4s');
    });

    it('formats normal seconds as whole seconds', () => {
      expect(formatDuration(18400)).toBe('18s');
    });

    it('formats minute durations as m:ss', () => {
      expect(formatDuration(84000)).toBe('1:24');
    });

    it('guards invalid values', () => {
      expect(formatDuration(Number.NaN)).toBe('0.0s');
      expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0.0s');
      expect(formatDuration(-1)).toBe('0.0s');
    });
  });

  describe('formatInitialLatency', () => {
    it('omits pending initial latency', () => {
      expect(formatInitialLatency(undefined)).toBeUndefined();
    });

    it('formats sub-second latency as milliseconds', () => {
      expect(formatInitialLatency(420)).toBe('first 420ms');
    });

    it('formats second latency with one decimal', () => {
      expect(formatInitialLatency(2100)).toBe('first 2.1s');
    });
  });

  describe('formatChunksPerSecond', () => {
    it('formats decimal throughput under 100', () => {
      expect(formatChunksPerSecond(16.64)).toBe('16.6 chunks/s');
    });

    it('formats large throughput as a whole number', () => {
      expect(formatChunksPerSecond(123.4)).toBe('123 chunks/s');
    });

    it('omits invalid throughput', () => {
      expect(formatChunksPerSecond(Number.NaN)).toBeUndefined();
      expect(formatChunksPerSecond(Number.POSITIVE_INFINITY)).toBeUndefined();
      expect(formatChunksPerSecond(-1)).toBeUndefined();
      expect(formatChunksPerSecond(0)).toBeUndefined();
    });
  });

  describe('formatStreamingStats', () => {
    it('formats zero state without impossible latency or throughput', () => {
      expect(formatStreamingStats({
        chunkCount: 0,
        elapsedMs: 0,
        initialLatencyMs: undefined,
        chunksPerSecond: 0
      })).toEqual([
        { key: 'count', label: '0 chunks' },
        { key: 'elapsed', label: '0.0s' }
      ]);
    });

    it('formats full streaming stats after enough data exists', () => {
      expect(formatStreamingStats({
        chunkCount: 305,
        elapsedMs: 18400,
        initialLatencyMs: 2100,
        chunksPerSecond: 16.576
      })).toEqual([
        { key: 'count', label: '305 chunks' },
        { key: 'elapsed', label: '18s' },
        { key: 'initialLatency', label: 'first 2.1s' },
        { key: 'throughput', label: '16.6 chunks/s' }
      ]);
    });

    it('hides throughput before enough elapsed time exists', () => {
      expect(formatStreamingStats({
        chunkCount: 1,
        elapsedMs: 250,
        initialLatencyMs: 200,
        chunksPerSecond: 4
      })).toEqual([
        { key: 'count', label: '1 chunk' },
        { key: 'elapsed', label: '0.3s' },
        { key: 'initialLatency', label: 'first 200ms' }
      ]);
    });
  });
});
